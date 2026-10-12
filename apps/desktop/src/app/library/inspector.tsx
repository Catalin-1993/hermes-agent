import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { relativeTime } from '@/lib/time'
import { copyFilePath } from '@/store/file-actions'

import { AccessMenu } from './access-menu'
import { formatBytes, type LibraryItem, updateLibraryItem } from './data'
import { itemTypeOf } from './file-types'
import { LibraryThumb } from './library-thumb'
import type { LibraryRun } from './library-views'
import { TagDots, TagMenuItems } from './organize-ui'

const fullDate = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function Fact({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 py-1 text-xs">
      <dt className="text-(--ui-text-tertiary)">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-(--ui-text-primary)">{children}</dd>
    </div>
  )
}

function When({ seconds }: { seconds: number }) {
  return (
    <Tip label={fullDate(seconds)}>
      <span>{relativeTime(seconds * 1000)}</span>
    </Tip>
  )
}

/** One item's facts, the way Finder's Get Info lays them out. */
export function ItemFacts({ item, location, onRun }: { item: LibraryItem; location: string; onRun: LibraryRun }) {
  const { t } = useI18n()
  const copy = t.library
  const facts = copy.explorer
  const meta = item.meta ?? {}
  const local = Boolean(item.path) && !isDesktopFsRemoteMode()

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-(--ui-stroke-tertiary)">
        <LibraryThumb item={item} size="card" />
      </div>
      <p className="m-0 mt-3 break-words text-sm font-medium text-(--ui-text-primary)">
        {item.title || (item.kind === 'folder' ? copy.workspace.untitledFolder : copy.untitled)}
      </p>
      <dl className="m-0 mt-2 border-t border-(--ui-stroke-quaternary) pt-2">
        <Fact label={facts.kind}>{copy.types[itemTypeOf(item)]}</Fact>
        {item.kind === 'file' && <Fact label={facts.size}>{formatBytes(item.size)}</Fact>}
        {typeof meta.width === 'number' && typeof meta.height === 'number' && meta.width > 0 && (
          <Fact label={facts.dimensions}>
            {meta.width} × {meta.height}
          </Fact>
        )}
        {typeof meta.pages === 'number' && <Fact label={facts.pages}>{meta.pages}</Fact>}
        {item.kind === 'folder' && <Fact label={facts.contents}>{copy.workspace.items(item.child_count ?? 0)}</Fact>}
        <Fact label={facts.created}>
          <When seconds={item.created_at} />
        </Fact>
        <Fact label={facts.modified}>
          <When seconds={item.updated_at} />
        </Fact>
        <Fact label={facts.createdBy}>{item.created_by === 'agent' ? facts.hermes : facts.you}</Fact>
        <Fact label={facts.location}>{location}</Fact>
        <Fact label={copy.organize.tags}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex cursor-pointer items-center gap-1.5 rounded-md text-left hover:text-(--ui-accent)"
                type="button"
              >
                {item.tags?.length ? (
                  <>
                    <TagDots names={item.tags} />
                    <span className="truncate">{item.tags.join(', ')}</span>
                  </>
                ) : (
                  <span className="text-(--ui-text-tertiary)">{copy.organize.newTag}</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              <TagMenuItems items={[item]} />
            </DropdownMenuContent>
          </DropdownMenu>
        </Fact>
        <Fact label={copy.columns.access}>
          <AccessMenu
            onChange={visibility => void onRun(() => updateLibraryItem(item.id, { visibility }))}
            visibility={item.visibility}
          />
        </Fact>
      </dl>
      {local && (
        <div className="mt-3 flex flex-col gap-2 border-t border-(--ui-stroke-quaternary) pt-3">
          <Button className="justify-start" onClick={() => void copyFilePath(item.path!)} size="xs" variant="ghost">
            <Codicon name="copy" size="0.75rem" />
            {facts.copyPath}
          </Button>
          <p className="m-0 text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">{facts.dragOutHint}</p>
        </div>
      )}
    </>
  )
}

/**
 * The listing's side panel (⌘I): the selected item's details — kind, size, dimensions, pages, dates,
 * who made it, where it lives, Hermes's access — or, for several, how many and how big together.
 */
export function LibraryInspector({
  folderTitle,
  onClose,
  onRun,
  selected
}: {
  /** Where the listing is, for items that do not say themselves (a folder's own view). */
  folderTitle: string
  onClose: () => void
  onRun: LibraryRun
  selected: readonly LibraryItem[]
}) {
  const { t } = useI18n()
  const facts = t.library.explorer
  const total = selected.reduce((sum, item) => sum + (item.size ?? 0), 0)

  return (
    <aside
      aria-label={facts.info}
      className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-(--ui-stroke-quaternary) px-4 pb-6 pt-1"
      data-library-inspector=""
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-(--ui-text-tertiary)">{facts.info}</span>
        <Button aria-label={t.common.close} onClick={onClose} size="icon-xs" variant="ghost">
          <Codicon name="close" size="0.75rem" />
        </Button>
      </div>
      {selected.length === 1 ? (
        <ItemFacts item={selected[0]} location={selected[0].parent_title || folderTitle} onRun={onRun} />
      ) : (
        <p className="m-0 mt-6 text-center text-xs text-(--ui-text-tertiary)">
          {selected.length > 1 ? facts.selection(selected.length, total ? formatBytes(total) : '') : facts.infoEmpty}
        </p>
      )}
    </aside>
  )
}
