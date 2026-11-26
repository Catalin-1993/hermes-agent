import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $gatewayState } from '@/store/session'

import { $libraryRevision, $librarySpace, type LibraryItem, listLibrary, setLibrarySpace } from '../data'
import { ITEM_TYPE_ICON, ITEM_TYPE_TINT, itemTypeOf } from '../file-types'

import { SECTION_TITLE } from './atlas-side'

const RECENT_COUNT = 5

const ROW =
  'group flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md pr-2 text-left text-[0.8125rem] text-(--ui-text-secondary) transition-colors hover:bg-(--ui-row-hover-background) hover:text-(--ui-text-primary)'

function ItemGlyph({ item }: { item: LibraryItem }) {
  const type = itemTypeOf(item)

  return item.icon ? (
    <span className="w-4 shrink-0 text-center text-[0.8125rem] leading-none">{item.icon}</span>
  ) : (
    <Codicon
      className="shrink-0 opacity-80"
      name={ITEM_TYPE_ICON[type]}
      size="0.8125rem"
      style={{ color: type === 'page' ? undefined : ITEM_TYPE_TINT[type] }}
    />
  )
}

const byFoldersThenTitle = (a: LibraryItem, b: LibraryItem) =>
  Number(b.kind === 'folder') - Number(a.kind === 'folder') || a.title.localeCompare(b.title)

/** One level of the tree; a folder or page opens its children in place, lazily. */
function Branch({ depth, onOpen, parentId }: { depth: number; onOpen: (item: LibraryItem) => void; parentId: string }) {
  const copy = useI18n().t.library
  const revision = useStore($libraryRevision)
  const space = useStore($librarySpace)
  const connected = useStore($gatewayState) === 'open'
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (!connected) {
      return
    }

    let live = true

    listLibrary({ parentId, space }).then(
      ({ items: rows }) => live && setItems(rows.filter(row => row.trashed_at == null).sort(byFoldersThenTitle)),
      () => live && setItems([])
    )

    return () => {
      live = false
    }
  }, [connected, parentId, revision, space])

  if (!items) {
    return null
  }

  if (!items.length && depth === 0) {
    return <p className="m-0 px-2 py-1 text-xs text-(--ui-text-tertiary)">{copy.home.noNotes}</p>
  }

  const toggle = (id: string) =>
    setOpen(current => {
      const next = new Set(current)

      if (!next.delete(id)) {
        next.add(id)
      }

      return next
    })

  return (
    <ul className="m-0 list-none p-0">
      {items.map(item => {
        const expandable = item.kind !== 'file'
        const expanded = open.has(item.id)

        return (
          <li key={item.id}>
            <div className={ROW} style={{ paddingLeft: `${0.25 + depth * 0.875}rem` }}>
              <button
                aria-expanded={expandable ? expanded : undefined}
                aria-label={expanded ? copy.home.collapse : copy.home.expand}
                className={cn(
                  'grid size-4 shrink-0 cursor-pointer place-items-center rounded text-(--ui-text-quaternary) hover:text-(--ui-text-primary)',
                  !expandable && 'invisible'
                )}
                onClick={() => toggle(item.id)}
                tabIndex={expandable ? 0 : -1}
                type="button"
              >
                <Codicon className={cn('transition-transform', expanded && 'rotate-90')} name="chevron-right" size="0.625rem" />
              </button>
              <button
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
                onClick={() => (item.kind === 'folder' ? toggle(item.id) : onOpen(item))}
                type="button"
              >
                <ItemGlyph item={item} />
                <span className="truncate">{item.title || copy.untitled}</span>
              </button>
            </div>
            {expanded && <Branch depth={depth + 1} onOpen={onOpen} parentId={item.id} />}
          </li>
        )
      })}
    </ul>
  )
}

function Recents({ onOpen }: { onOpen: (item: LibraryItem) => void }) {
  const copy = useI18n().t.library
  const revision = useStore($libraryRevision)
  const space = useStore($librarySpace)
  const connected = useStore($gatewayState) === 'open'
  const [items, setItems] = useState<LibraryItem[]>([])

  useEffect(() => {
    if (!connected) {
      return
    }

    let live = true

    listLibrary({ order: 'desc', sort: 'updated', space }).then(
      ({ items: rows }) =>
        live && setItems(rows.filter(row => row.kind !== 'folder' && row.trashed_at == null).slice(0, RECENT_COUNT)),
      () => live && setItems([])
    )

    return () => {
      live = false
    }
  }, [connected, revision, space])

  if (!items.length) {
    return null
  }

  return (
    <section className="mt-5">
      <h3 className={cn(SECTION_TITLE, 'px-2')}>{copy.nav.recents}</h3>
      {items.map(item => (
        <button className={cn(ROW, 'pl-2')} key={item.id} onClick={() => onOpen(item)} type="button">
          <ItemGlyph item={item} />
          <span className="truncate">{item.title || copy.untitled}</span>
        </button>
      ))}
    </section>
  )
}

/** The notes beside the memory: the owner's own or Brain's notebook, as a tree, and the latest few. */
export function NotesColumn({ onOpen }: { onOpen: (item: LibraryItem) => void }) {
  const copy = useI18n().t.library
  const space = useStore($librarySpace)

  return (
    <div className="px-3 py-4">
      <SegmentedControl
        className="mb-4 w-full"
        onChange={setLibrarySpace}
        options={[
          { id: 'user', label: copy.home.mine },
          { id: 'agent', label: copy.home.agents }
        ]}
        value={space}
      />
      <h3 className={cn(SECTION_TITLE, 'px-2')}>{copy.home.notes}</h3>
      <Branch depth={0} onOpen={onOpen} parentId="" />
      <Recents onOpen={onOpen} />
    </div>
  )
}
