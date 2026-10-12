import { IconCut } from '@tabler/icons-react'
import { type DragEvent, type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CheckboxMark } from '@/components/ui/checkbox'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { formatModifierToken } from '@/lib/keybinds/combo'
import { relativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { confirm } from '@/store/confirm'
import { copyFilePath, revealFile } from '@/store/file-actions'

import { ACCESS_META, ACCESS_ORDER } from './access'
import { AccessMenu } from './access-menu'
import { askHermesAbout } from './chat-bridge'
import {
  formatBytes,
  type LibraryItem,
  type LibraryOrder,
  type LibrarySort,
  purgeLibraryItem,
  trashLibraryItem,
  updateLibraryItem
} from './data'
import { exportItem } from './export-actions'
import { fileCategoryOf, itemTypeOf } from './file-types'
import { LibraryThumb } from './library-thumb'
import { $organizeDialog } from './organize'
import { TagDots, TagSubmenu } from './organize-ui'

export type LibraryRun = (work: () => Promise<unknown>) => Promise<void>

/** Everything a row or card needs from the browser that owns selection, rename and drag state. */
export interface LibraryViewModel {
  /** Items cut (⌘X) and waiting to move: shown faded. */
  cut: ReadonlySet<string>
  dropTarget: null | string
  /** Flat views (search, Recent, a type tab) say which folder each item lives in. */
  flat: boolean
  items: readonly LibraryItem[]
  order: LibraryOrder
  renamingId: null | string
  selected: ReadonlySet<string>
  sort: LibrarySort
  trash: boolean
  onActivate: (item: LibraryItem, event: MouseEvent) => void
  onClipboard: (items: readonly LibraryItem[], mode: 'copy' | 'cut') => void
  onDuplicate: (items: readonly LibraryItem[]) => void
  onInfo: (item: LibraryItem) => void
  onDragEnd: () => void
  onDragStart: (item: LibraryItem, event: DragEvent) => void
  onFolderDragLeave: (item: LibraryItem) => void
  onFolderDragOver: (item: LibraryItem, event: DragEvent) => void
  onFolderDrop: (item: LibraryItem, event: DragEvent) => void
  onMove: (items: LibraryItem[]) => void
  onRename: (item: LibraryItem, title: null | string) => void
  onRun: LibraryRun
  onSort: (sort: LibrarySort) => void
  onStartRename: (item: LibraryItem) => void
  onToggleSelect: (item: LibraryItem, event: MouseEvent) => void
}

/** A search hit's surrounding text with the matched words marked. */
function Snippet({ text }: { text: string }) {
  return (
    <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
      {text.split(/(\ue000[^\ue001]*\ue001)/).map((part, index) =>
        part.startsWith('\ue000') ? (
          <mark
            className="rounded-sm bg-[color-mix(in_srgb,var(--ui-yellow)_30%,transparent)] px-0.5 text-(--ui-text-primary)"
            key={index}
          >
            {part.slice(1, -1)}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  )
}

function useItemMeta() {
  const { t } = useI18n()
  const copy = t.library

  return (item: LibraryItem, flat: boolean): string => {
    const parts: string[] = []

    if (item.status === 'pending') {
      return copy.preview.processing
    }

    if (item.kind === 'folder') {
      // A trashed folder's contents went with it: its live count says nothing.
      parts.push(item.trashed_at ? copy.types.folder : copy.workspace.items(item.child_count ?? 0))
    } else if (item.kind === 'page') {
      parts.push(item.excerpt || copy.types.page)
    } else {
      parts.push(copy.types[fileCategoryOf(item)])
      const size = formatBytes(item.size)

      if (size) {
        parts.push(size)
      }
    }

    if (flat && item.parent_title) {
      parts.push(copy.workspace.inFolder(item.parent_title))
    }

    return parts.join(' · ')
  }
}

/** Inline rename: Enter or leaving the field commits, Escape keeps the old name. */
function RenameField({
  className,
  item,
  onRename
}: {
  className?: string
  item: LibraryItem
  onRename: LibraryViewModel['onRename']
}) {
  let settled = false

  const commit = (value: null | string) => {
    if (!settled) {
      settled = true
      onRename(item, value)
    }
  }

  return (
    <input
      autoFocus
      className={cn(
        'h-7 w-full min-w-0 rounded-md border border-(--ui-accent) bg-(--ui-bg-editor) px-2 text-[0.8125rem] font-medium text-(--ui-text-primary) outline-none ring-3 ring-[color-mix(in_srgb,var(--ui-accent)_18%,transparent)]',
        className
      )}
      defaultValue={item.title}
      onBlur={event => commit(event.currentTarget.value)}
      onClick={event => event.stopPropagation()}
      onFocus={event => event.currentTarget.select()}
      onKeyDown={event => {
        event.stopPropagation()

        if (event.key === 'Enter') {
          commit(event.currentTarget.value)
        } else if (event.key === 'Escape') {
          commit(null)
        }
      }}
    />
  )
}

/** The trailing controls: Restore / Delete forever in the Trash; favorite + menu elsewhere. */
export function ItemActions({
  className,
  item,
  model
}: {
  className?: string
  item: LibraryItem
  model: Pick<
    LibraryViewModel,
    'onActivate' | 'onClipboard' | 'onDuplicate' | 'onInfo' | 'onMove' | 'onRun' | 'onStartRename' | 'trash'
  >
}) {
  const { t } = useI18n()
  const copy = t.library
  const ws = copy.workspace
  const ex = copy.explorer
  const mod = formatModifierToken('mod')

  if (model.trash) {
    return (
      <span
        className={cn('flex items-center justify-end gap-0.5', className)}
        onClick={event => event.stopPropagation()}
      >
        <Tip label={copy.actions.restore}>
          <Button
            aria-label={copy.actions.restore}
            onClick={() => void model.onRun(() => trashLibraryItem(item.id, true))}
            size="icon-xs"
            variant="ghost"
          >
            <Codicon name="discard" size="0.8125rem" />
          </Button>
        </Tip>
        <Tip label={copy.actions.purge}>
          <Button
            aria-label={copy.actions.purge}
            onClick={() =>
              void confirm({
                confirmLabel: copy.purgeConfirm.confirm,
                description: copy.purgeConfirm.description(item.title || copy.untitled),
                destructive: true,
                onConfirm: () => model.onRun(() => purgeLibraryItem(item.id)),
                title: copy.purgeConfirm.title
              })
            }
            size="icon-xs"
            variant="ghost"
          >
            <Codicon className="text-(--ui-red)" name="trash" size="0.8125rem" />
          </Button>
        </Tip>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100',
        item.favorite && 'opacity-100',
        className
      )}
      onClick={event => event.stopPropagation()}
    >
      <Button
        aria-label={item.favorite ? copy.actions.unfavorite : copy.actions.favorite}
        aria-pressed={item.favorite}
        className={cn(item.favorite && 'text-[color-mix(in_srgb,var(--ui-yellow)_85%,var(--ui-text-primary))]')}
        onClick={() => void model.onRun(() => updateLibraryItem(item.id, { favorite: !item.favorite }))}
        size="icon-xs"
        variant="ghost"
      >
        <Codicon name={item.favorite ? 'star-full' : 'star-empty'} size="0.8125rem" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={copy.actions.more} size="icon-xs" variant="ghost">
            <Codicon name="kebab-vertical" size="0.8125rem" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onSelect={event => model.onActivate(item, event as unknown as MouseEvent)}>
            <Codicon name={item.kind === 'folder' ? 'folder-opened' : 'link-external'} size="0.8125rem" />
            {ws.open}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => model.onInfo(item)}>
            <Codicon name="info" size="0.8125rem" />
            {ex.details}
          </DropdownMenuItem>
          {item.kind !== 'folder' && (
            <DropdownMenuItem onSelect={() => askHermesAbout(item)}>
              <Codicon name="sparkle" size="0.8125rem" />
              {copy.chat.askHermes}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => model.onStartRename(item)}>
            <Codicon name="edit" size="0.8125rem" />
            {ws.rename}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => model.onMove([item])}>
            <Codicon name="arrow-swap" size="0.8125rem" />
            {ws.moveTo}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => model.onDuplicate([item])}>
            <Codicon name="files" size="0.8125rem" />
            {ex.duplicate}
            <DropdownMenuShortcut>
              {formatModifierToken('shift')}
              {mod}D
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => model.onClipboard([item], 'copy')}>
            <Codicon name="copy" size="0.8125rem" />
            {ex.copy}
            <DropdownMenuShortcut>{mod}C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => model.onClipboard([item], 'cut')}>
            <IconCut size={13} stroke={1.6} />
            {ex.cut}
            <DropdownMenuShortcut>{mod}X</DropdownMenuShortcut>
          </DropdownMenuItem>
          <TagSubmenu items={[item]} />
          {item.kind !== 'folder' && (
            <DropdownMenuItem onSelect={() => $organizeDialog.set({ item, kind: 'versions' })}>
              <Codicon name="history" size="0.8125rem" />
              {copy.organize.versionHistory}
            </DropdownMenuItem>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Codicon name={ACCESS_META[item.visibility].icon} size="0.8125rem" />
              {copy.access.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-56">
              <DropdownMenuRadioGroup
                onValueChange={value =>
                  void model.onRun(() => updateLibraryItem(item.id, { visibility: value as LibraryItem['visibility'] }))
                }
                value={item.visibility}
              >
                {ACCESS_ORDER.map(level => (
                  <DropdownMenuRadioItem key={level} value={level}>
                    <Codicon name={ACCESS_META[level].icon} size="0.8125rem" />
                    {copy.access[level]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {item.kind === 'file' && item.path && !isDesktopFsRemoteMode() && (
            <>
              <DropdownMenuItem onSelect={() => void revealFile(item.path!)}>
                <Codicon name="folder-opened" size="0.8125rem" />
                {copy.actions.download}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyFilePath(item.path!)}>
                <Codicon name="clippy" size="0.8125rem" />
                {ex.copyPath}
              </DropdownMenuItem>
            </>
          )}
          {item.kind === 'folder' && (
            <DropdownMenuItem onSelect={() => void exportItem(item, 'zip')}>
              <Codicon name="file-zip" size="0.8125rem" />
              {copy.export.formats.zip}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void model.onRun(() => trashLibraryItem(item.id))} variant="destructive">
            <Codicon name="trash" size="0.8125rem" />
            {copy.actions.trash}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}

/** Drag + drop wiring shared by rows and cards: everything drags (outside the Trash); folders take drops. */
function dragProps(item: LibraryItem, model: LibraryViewModel) {
  const folder = item.kind === 'folder' && !model.trash

  return {
    'data-drop-target': model.dropTarget === item.id || undefined,
    draggable: !model.trash && model.renamingId !== item.id,
    onDragEnd: model.onDragEnd,
    onDragLeave: folder ? () => model.onFolderDragLeave(item) : undefined,
    onDragOver: folder ? (event: DragEvent) => model.onFolderDragOver(item, event) : undefined,
    onDragStart: (event: DragEvent) => model.onDragStart(item, event),
    onDrop: folder ? (event: DragEvent) => model.onFolderDrop(item, event) : undefined
  }
}

function SortHeader({ children, model, sort }: { children: ReactNode; model: LibraryViewModel; sort: LibrarySort }) {
  const active = model.sort === sort

  return (
    <button
      className={cn(
        'flex w-fit cursor-pointer items-center gap-1 hover:text-(--ui-text-primary)',
        active && 'text-(--ui-text-secondary)'
      )}
      onClick={() => model.onSort(sort)}
      type="button"
    >
      {children}
      {active && <Codicon name={model.order === 'asc' ? 'arrow-up' : 'arrow-down'} size="0.625rem" />}
    </button>
  )
}

const LIST_COLUMNS = 'grid-cols-[1.25rem_minmax(0,1fr)_9rem_7.5rem_4.5rem]'

// Long folders render in steps as they scroll into view, so thousands of items stay smooth.
const RENDER_STEP = 200

function useProgressive<T>(items: readonly T[], className?: string) {
  const [count, setCount] = useState(RENDER_STEP)
  const sentinel = useRef<HTMLDivElement | null>(null)
  const more = count < items.length

  useEffect(() => {
    const node = sentinel.current

    if (!more || !node) {
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setCount(n => n + RENDER_STEP)
      }
    })

    observer.observe(node)

    return () => observer.disconnect()
  }, [more, count])

  return {
    shown: more ? items.slice(0, count) : items,
    sentinel: more ? <div aria-hidden className={cn('h-px', className)} ref={sentinel} /> : null
  }
}

export function LibraryListView({ model }: { model: LibraryViewModel }) {
  const { t } = useI18n()
  const copy = t.library
  const meta = useItemMeta()
  const selecting = model.selected.size > 0
  const { sentinel, shown } = useProgressive(model.items)

  return (
    <div className="flex flex-col" role="list">
      <div
        className={cn(
          'grid items-center gap-3 border-b border-(--ui-stroke-quaternary) px-3 pb-2 text-[0.6875rem] font-medium text-(--ui-text-tertiary)',
          LIST_COLUMNS
        )}
      >
        <span />
        <SortHeader model={model} sort="name">
          {copy.columns.name}
        </SortHeader>
        <span>{copy.columns.access}</span>
        <SortHeader model={model} sort="updated">
          {copy.columns.updated}
        </SortHeader>
        <span />
      </div>
      {shown.map(item => {
        const selected = model.selected.has(item.id)

        return (
          <div
            className={cn(
              'group grid cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-(--ui-row-hover-background)',
              'data-[drop-target]:bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] data-[drop-target]:ring-1 data-[drop-target]:ring-(--ui-accent)',
              selected &&
                'bg-[color-mix(in_srgb,var(--ui-accent)_8%,transparent)] hover:bg-[color-mix(in_srgb,var(--ui-accent)_11%,transparent)]',
              model.cut.has(item.id) && 'opacity-50',
              LIST_COLUMNS
            )}
            data-library-row={item.id}
            key={item.id}
            onClick={event => model.onActivate(item, event)}
            role="listitem"
            {...dragProps(item, model)}
          >
            <button
              aria-label={t.library.workspace.selection.select}
              aria-pressed={selected}
              className={cn(
                'grid cursor-pointer place-items-center opacity-0 transition-opacity group-hover:opacity-100',
                (selected || selecting) && 'opacity-100'
              )}
              onClick={event => {
                event.stopPropagation()
                model.onToggleSelect(item, event)
              }}
              type="button"
            >
              <CheckboxMark checked={selected} />
            </button>
            <span className="flex min-w-0 items-center gap-3">
              <LibraryThumb item={item} size="row" />
              <span className="flex min-w-0 flex-1 flex-col">
                {model.renamingId === item.id ? (
                  <RenameField item={item} onRename={model.onRename} />
                ) : (
                  <span className="truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">
                    {item.title || (item.kind === 'folder' ? copy.workspace.untitledFolder : copy.untitled)}
                  </span>
                )}
                {item.snippet ? (
                  <Snippet text={item.snippet} />
                ) : (
                  <span className="flex min-w-0 items-center gap-1 truncate text-[0.6875rem] text-(--ui-text-tertiary)">
                    {item.status === 'pending' && (
                      <Codicon className="shrink-0" name="loading" size="0.625rem" spinning />
                    )}
                    {meta(item, model.flat)}
                  </span>
                )}
              </span>
              <TagDots names={item.tags} />
              {item.created_by === 'agent' && (
                <Tip label={copy.createdByHermes}>
                  <Codicon className="shrink-0 text-(--ui-accent)" name="robot" size="0.75rem" />
                </Tip>
              )}
            </span>
            <span onClick={event => event.stopPropagation()}>
              {model.trash ? (
                <span className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.types[itemTypeOf(item)]}</span>
              ) : (
                <AccessMenu
                  onChange={visibility => void model.onRun(() => updateLibraryItem(item.id, { visibility }))}
                  visibility={item.visibility}
                />
              )}
            </span>
            <span className="text-xs tabular-nums text-(--ui-text-tertiary)">
              {relativeTime(item.updated_at * 1000)}
            </span>
            <ItemActions item={item} model={model} />
          </div>
        )
      })}
      {sentinel}
    </div>
  )
}

export function LibraryGridView({ model }: { model: LibraryViewModel }) {
  const { t } = useI18n()
  const copy = t.library
  const meta = useItemMeta()
  const selecting = model.selected.size > 0
  const { sentinel, shown } = useProgressive(model.items, 'col-span-full')

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
      {shown.map(item => {
        const selected = model.selected.has(item.id)

        return (
          <div
            className={cn(
              'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) transition-[border-color,box-shadow,transform] duration-150',
              'hover:-translate-y-px hover:border-(--ui-stroke-secondary) hover:shadow-(--composer-float-shadow)',
              'data-[drop-target]:border-(--ui-accent) data-[drop-target]:ring-2 data-[drop-target]:ring-[color-mix(in_srgb,var(--ui-accent)_25%,transparent)]',
              selected && 'border-(--ui-accent) ring-2 ring-[color-mix(in_srgb,var(--ui-accent)_22%,transparent)]',
              model.cut.has(item.id) && 'opacity-50'
            )}
            data-library-card={item.id}
            key={item.id}
            onClick={event => model.onActivate(item, event)}
            role="button"
            tabIndex={0}
            {...dragProps(item, model)}
          >
            <LibraryThumb item={item} size="card" />
            <button
              aria-label={copy.workspace.selection.select}
              aria-pressed={selected}
              className={cn(
                'absolute left-2.5 top-2.5 grid cursor-pointer place-items-center rounded-sm bg-(--ui-bg-editor) opacity-0 shadow-sm transition-opacity group-hover:opacity-100',
                (selected || selecting) && 'opacity-100'
              )}
              onClick={event => {
                event.stopPropagation()
                model.onToggleSelect(item, event)
              }}
              type="button"
            >
              <CheckboxMark checked={selected} />
            </button>
            <ItemActions
              className="absolute right-2 top-2 rounded-lg bg-[color-mix(in_srgb,var(--ui-bg-editor)_88%,transparent)] p-0.5 shadow-sm backdrop-blur-sm"
              item={item}
              model={model}
            />
            <span className="flex flex-col gap-0.5 border-t border-(--ui-stroke-quaternary) px-3 py-2.5">
              {model.renamingId === item.id ? (
                <RenameField item={item} onRename={model.onRename} />
              ) : (
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">
                    {item.title || (item.kind === 'folder' ? copy.workspace.untitledFolder : copy.untitled)}
                  </span>
                  <TagDots names={item.tags} />
                  {item.created_by === 'agent' && (
                    <Codicon className="shrink-0 text-(--ui-accent)" name="robot" size="0.6875rem" />
                  )}
                </span>
              )}
              <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
                {item.kind === 'page' ? relativeTime(item.updated_at * 1000) : meta(item, model.flat)}
              </span>
            </span>
          </div>
        )
      })}
      {sentinel}
    </div>
  )
}
