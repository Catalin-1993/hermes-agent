import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { MarkdownPreview } from '@/app/chat/right-rail/preview-file'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'
import { relativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import {
  bumpLibraryRevision,
  createSavedSearch,
  deleteLibraryTag,
  formatBytes,
  type LibraryItem,
  type LibraryTagColor,
  type LibraryVersionInfo,
  listLibraryVersions,
  restoreLibraryVersion,
  tagLibraryItems,
  updateLibraryTag
} from './data'
import {
  $activeSavedSearch,
  $libraryTags,
  $organizeDialog,
  refreshSavedSearches,
  TAG_COLORS,
  TAG_ORDER
} from './organize'

const strip = (label: string) => label.replace(/…$/, '')

function Dot({ color, size = 'size-2' }: { color: LibraryTagColor; size?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 rounded-full ring-1 ring-(--ui-bg-editor)', size)}
      style={{ background: TAG_COLORS[color] }}
    />
  )
}

/** The tags an item wears, as Finder's overlapping dots. */
export function TagDots({ names }: { names?: readonly string[] }) {
  const tags = useStore($libraryTags)

  if (!names?.length) {
    return null
  }

  const worn = names.flatMap(name => tags.filter(tag => tag.name.toLowerCase() === name.toLowerCase()))

  return (
    <span className="flex shrink-0 items-center -space-x-0.5" title={worn.map(tag => tag.name).join(', ')}>
      {worn.slice(0, 4).map(tag => (
        <Dot color={tag.color} key={tag.name} />
      ))}
    </span>
  )
}

function ColorPicker({ onChange, value }: { onChange: (color: LibraryTagColor) => void; value: LibraryTagColor }) {
  const { t } = useI18n()

  return (
    <div className="flex items-center gap-1.5" role="radiogroup">
      {TAG_ORDER.map(color => (
        <button
          aria-checked={value === color}
          aria-label={t.library.organize.colors[color]}
          className={cn(
            'grid size-6 cursor-pointer place-items-center rounded-full transition-transform hover:scale-110',
            value === color && 'ring-2 ring-(--ui-text-tertiary) ring-offset-2 ring-offset-(--ui-bg-editor)'
          )}
          key={color}
          onClick={() => onChange(color)}
          role="radio"
          style={{ background: TAG_COLORS[color] }}
          type="button"
        />
      ))}
    </div>
  )
}

/** Tag checkboxes for some items (all wear it: checked; some: mixed), then New tag… / Manage tags…. */
export function TagMenuItems({ items }: { items: readonly LibraryItem[] }) {
  const { t } = useI18n()
  const copy = t.library.organize
  const tags = useStore($libraryTags)
  const ids = items.map(item => item.id)

  const wearing = (name: string) =>
    items.filter(item => item.tags?.some(worn => worn.toLowerCase() === name.toLowerCase())).length

  const toggle = async (name: string, on: boolean) => {
    try {
      await tagLibraryItems(ids, name, on)
      bumpLibraryRevision()
    } catch (error) {
      notifyError(error, t.library.errors.save)
    }
  }

  return (
    <>
      {tags.map(tag => {
        const count = wearing(tag.name)

        return (
          <DropdownMenuCheckboxItem
            checked={count === items.length ? true : count > 0 ? 'indeterminate' : false}
            key={tag.name}
            onCheckedChange={() => void toggle(tag.name, count !== items.length)}
            onSelect={event => event.preventDefault()}
          >
            <Dot color={tag.color} size="size-2.5" />
            <span className="truncate">{tag.name}</span>
          </DropdownMenuCheckboxItem>
        )
      })}
      {tags.length > 0 && <DropdownMenuSeparator />}
      <DropdownMenuItem onSelect={() => $organizeDialog.set({ ids, kind: 'newTag' })}>
        <Codicon name="add" size="0.8125rem" />
        {copy.newTag}
      </DropdownMenuItem>
      {tags.length > 0 && (
        <DropdownMenuItem onSelect={() => $organizeDialog.set({ kind: 'manageTags' })}>
          <Codicon name="settings" size="0.8125rem" />
          {copy.manageTags}
        </DropdownMenuItem>
      )}
    </>
  )
}

export function TagSubmenu({ items }: { items: readonly LibraryItem[] }) {
  const { t } = useI18n()

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Codicon name="tag" size="0.8125rem" />
        {t.library.organize.tags}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-48">
        <TagMenuItems items={items} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function NewTagDialog({ ids, onClose }: { ids: readonly string[]; onClose: () => void }) {
  const { t } = useI18n()
  const copy = t.library.organize
  const used = new Set(useStore($libraryTags).map(tag => tag.color))
  const [name, setName] = useState('')
  const [color, setColor] = useState<LibraryTagColor>(TAG_ORDER.find(c => !used.has(c)) ?? 'blue')

  const create = async () => {
    if (!name.trim()) {
      return
    }

    try {
      await tagLibraryItems(ids, name.trim(), true, color)
      bumpLibraryRevision()
      onClose()
    } catch (error) {
      notifyError(error, t.library.errors.save)
    }
  }

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{strip(copy.newTag)}</DialogTitle>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={event => {
          event.preventDefault()
          void create()
        }}
      >
        <input
          aria-label={copy.tagName}
          autoFocus
          className="h-9 rounded-lg border border-(--ui-stroke-tertiary) bg-transparent px-3 text-sm outline-none focus:border-(--ui-accent)"
          maxLength={40}
          onChange={event => setName(event.target.value)}
          placeholder={copy.tagName}
          value={name}
        />
        <ColorPicker onChange={setColor} value={color} />
        <DialogFooter>
          <Button disabled={!name.trim()} type="submit">
            {copy.create}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function ManageTagsDialog() {
  const { t } = useI18n()
  const copy = t.library.organize
  const tags = useStore($libraryTags)

  const run = async (work: () => Promise<unknown>) => {
    try {
      await work()
      bumpLibraryRevision()
    } catch (error) {
      notifyError(error, t.library.errors.save)
    }
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{strip(copy.manageTags)}</DialogTitle>
      </DialogHeader>
      {tags.length === 0 ? (
        <p className="m-0 text-sm text-(--ui-text-tertiary)">{copy.noTags}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {tags.map(tag => (
            <li className="flex flex-col gap-2" key={tag.name}>
              <div className="flex items-center gap-2">
                <input
                  aria-label={copy.tagName}
                  className="h-8 min-w-0 flex-1 rounded-md border border-(--ui-stroke-tertiary) bg-transparent px-2.5 text-sm outline-none focus:border-(--ui-accent)"
                  defaultValue={tag.name}
                  maxLength={40}
                  onBlur={event => {
                    const next = event.target.value.trim()

                    if (next && next !== tag.name) {
                      void run(() => updateLibraryTag(tag.name, { new_name: next }))
                    }
                  }}
                />
                <span className="w-8 text-right text-xs tabular-nums text-(--ui-text-tertiary)">{tag.count}</span>
                <Button
                  aria-label={copy.deleteTag}
                  onClick={() => void run(() => deleteLibraryTag(tag.name))}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Codicon name="trash" size="0.8125rem" />
                </Button>
              </div>
              <ColorPicker
                onChange={color => void run(() => updateLibraryTag(tag.name, { color }))}
                value={tag.color}
              />
            </li>
          ))}
        </ul>
      )}
    </DialogContent>
  )
}

function SaveSearchDialog({ onClose, query }: { onClose: () => void; query: Parameters<typeof createSavedSearch>[1] }) {
  const { t } = useI18n()
  const copy = t.library.organize
  const [name, setName] = useState(query.query ?? '')

  const save = async () => {
    try {
      const saved = await createSavedSearch(name.trim(), query)

      await refreshSavedSearches()
      $activeSavedSearch.set(saved.id)
      onClose()
    } catch (error) {
      notifyError(error, t.library.errors.save)
    }
  }

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{copy.saveSearchTitle}</DialogTitle>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={event => {
          event.preventDefault()
          void save()
        }}
      >
        <input
          aria-label={copy.searchName}
          autoFocus
          className="h-9 rounded-lg border border-(--ui-stroke-tertiary) bg-transparent px-3 text-sm outline-none focus:border-(--ui-accent)"
          maxLength={80}
          onChange={event => setName(event.target.value)}
          placeholder={copy.searchName}
          value={name}
        />
        <DialogFooter>
          <Button disabled={!name.trim()} type="submit">
            {copy.saveSearch}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function VersionHistoryDialog({
  item,
  onClose,
  onRestored
}: {
  item: LibraryItem
  onClose: () => void
  onRestored?: (item: LibraryItem) => void
}) {
  const { t } = useI18n()
  const copy = t.library.organize
  const [versions, setVersions] = useState<LibraryVersionInfo[] | null>(null)
  const [chosen, setChosen] = useState<null | string>(null)

  useEffect(() => {
    let live = true

    listLibraryVersions(item.id).then(
      list => {
        if (live) {
          setVersions(list)
          setChosen(list[0]?.id ?? null)
        }
      },
      () => live && setVersions([])
    )

    return () => {
      live = false
    }
  }, [item.id])

  const version = versions?.find(entry => entry.id === chosen)

  const restore = async () => {
    if (!version) {
      return
    }

    try {
      const restored = await restoreLibraryVersion(item.id, version.id)

      bumpLibraryRevision()
      notify({ durationMs: 2500, kind: 'info', message: copy.restored })
      onRestored?.(restored)
      onClose()
    } catch (error) {
      notifyError(error, t.library.errors.save)
    }
  }

  return (
    <DialogContent aria-describedby={undefined} className="max-w-3xl" fitContent>
      <DialogHeader>
        <DialogTitle>{strip(copy.versionHistory)}</DialogTitle>
      </DialogHeader>
      {versions === null ? (
        <div className="grid h-48 place-items-center">
          <Loader />
        </div>
      ) : versions.length === 0 ? (
        <p className="m-0 max-w-sm text-sm text-(--ui-text-tertiary)">{copy.noVersions}</p>
      ) : (
        <div className="flex h-[min(60vh,32rem)] w-[min(80vw,46rem)] gap-3">
          <ul className="m-0 flex w-52 shrink-0 list-none flex-col gap-0.5 overflow-y-auto p-0">
            {versions.map(entry => (
              <li key={entry.id}>
                <button
                  className={cn(
                    'flex w-full cursor-pointer flex-col items-start rounded-lg px-3 py-2 text-left transition-colors hover:bg-(--ui-row-hover-background)',
                    entry.id === chosen && 'bg-(--ui-row-active-background)'
                  )}
                  onClick={() => setChosen(entry.id)}
                  type="button"
                >
                  <span className="text-sm text-(--ui-text-primary)">{relativeTime(entry.created_at * 1000)}</span>
                  <span className="text-[0.6875rem] text-(--ui-text-tertiary)">
                    {new Date(entry.created_at * 1000).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                    {entry.size ? ` · ${formatBytes(entry.size)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) px-6 py-5">
            {version?.markdown != null ? (
              <MarkdownPreview text={version.markdown} />
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-(--ui-text-tertiary)">
                <div className="flex flex-col items-center gap-2">
                  <Codicon name="history" size="1.75rem" />
                  {copy.fileVersion}
                  {version?.size ? <span className="text-xs">{formatBytes(version.size)}</span> : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {versions && versions.length > 0 && (
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-(--ui-text-tertiary)">{copy.restoreConfirm}</span>
          <Button disabled={!version} onClick={() => void restore()}>
            <Codicon name="history" size="0.8125rem" />
            {copy.restore}
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  )
}

/** The host for the Library's organizing dialogs (tags, saved searches, version history). */
export function OrganizeDialogs() {
  const dialog = useStore($organizeDialog)
  const close = () => $organizeDialog.set(null)

  return (
    <Dialog onOpenChange={open => !open && close()} open={dialog !== null}>
      {dialog?.kind === 'newTag' && <NewTagDialog ids={dialog.ids} onClose={close} />}
      {dialog?.kind === 'manageTags' && <ManageTagsDialog />}
      {dialog?.kind === 'saveSearch' && <SaveSearchDialog onClose={close} query={dialog.query} />}
      {dialog?.kind === 'versions' && (
        <VersionHistoryDialog item={dialog.item} onClose={close} onRestored={dialog.onRestored} />
      )}
    </Dialog>
  )
}
