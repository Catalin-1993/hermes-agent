import { useStore } from '@nanostores/react'
import { atom } from 'nanostores'
import { useContext, useEffect, useRef, useState } from 'react'

import { WorkspacePageHeaderControl, WorkspacePageHeaderHostContext } from '@/app/contrib/workspace-page-header'
import { useActiveTabVisible } from '@/components/pane-shell/tree/renderer/tab-strip-scroll'
import { Codicon } from '@/components/ui/codicon'
import { PaneTab, PaneTabLabel, PaneTabStrip } from '@/components/ui/pane-tab'
import { useI18n } from '@/i18n'

import { $libraryRevision, getLibraryItem, type LibraryItem } from './data'
import { ITEM_TYPE_ICON, ITEM_TYPE_TINT, itemTypeOf } from './file-types'

/** The pages and files open in this window, in tab order (the window's session; not persisted). */
const $libraryTabs = atom<readonly string[]>([])

// The tab showing last: a newly opened item lands right after it, as in a browser.
let lastShown: null | string = null

/** Give an opened item its tab — kept where it is when already open — and mark it showing. */
export function openLibraryTab(id: string) {
  const tabs = $libraryTabs.get()

  if (!tabs.includes(id)) {
    const at = lastShown ? tabs.indexOf(lastShown) : -1

    $libraryTabs.set(at < 0 ? [...tabs, id] : [...tabs.slice(0, at + 1), id, ...tabs.slice(at + 1)])
  }

  lastShown = id
}

/** Drop a tab; returns the tab that should take over when it was the one showing. */
function closeLibraryTab(id: string): null | string {
  const tabs = $libraryTabs.get()
  const at = tabs.indexOf(id)
  const next = tabs.filter(tab => tab !== id)

  $libraryTabs.set(next)

  return next[Math.min(at, next.length - 1)] ?? null
}

/** A tab's item as it is now; a trashed or vanished item reports `gone`. */
function useTabItem(id: string) {
  const revision = useStore($libraryRevision)
  const [state, setState] = useState<{ gone: boolean; item: LibraryItem | null }>({ gone: false, item: null })

  useEffect(() => {
    let live = true

    getLibraryItem(id).then(
      ({ item }) => live && setState({ gone: item.trashed_at != null, item }),
      () => live && setState({ gone: true, item: null })
    )

    return () => {
      live = false
    }
  }, [id, revision])

  return state
}

interface TabProps {
  active: boolean
  id: string
  onActivate: (id: null | string) => void
}

function LibraryTab({ active, id, onActivate }: TabProps) {
  const { t } = useI18n()
  const { gone, item } = useTabItem(id)
  const type = item ? itemTypeOf(item) : 'page'

  const close = () => {
    const next = closeLibraryTab(id)

    if (active) {
      onActivate(next)
    }
  }

  // An item sent to the trash (here, by Hermes, in another window) takes its tab with it.
  useEffect(() => {
    if (gone) {
      close()
    }
    // `close` is rebuilt per render; the tab only reacts to the item going away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone])

  return (
    <PaneTab
      active={active}
      aria-selected={active}
      data-tree-tab={id}
      onClick={() => onActivate(id)}
      onClose={close}
      role="tab"
    >
      <PaneTabLabel>
        <span className="flex min-w-0 items-center gap-1.5">
          {item?.icon ? (
            <span className="shrink-0 text-[0.8125rem] leading-none">{item.icon}</span>
          ) : (
            <Codicon
              className="shrink-0"
              name={ITEM_TYPE_ICON[type]}
              size="0.75rem"
              style={{ color: type === 'page' ? undefined : ITEM_TYPE_TINT[type] }}
            />
          )}
          <span className="truncate">{item?.title || t.library.untitled}</span>
        </span>
      </PaneTabLabel>
    </PaneTab>
  )
}

/** The open pages and files as tabs. In the main window they sit in the top band, right after
 *  back / forward, where chat tabs go — the chat strip's own tabs; in a split tile, which has no
 *  such band, they head the Library instead. Nothing shows until something is open. */
export function LibraryTabs({
  activeId,
  onActivate
}: {
  activeId: null | string
  onActivate: (id: null | string) => void
}) {
  const tabs = useStore($libraryTabs)
  const list = useRef<HTMLDivElement | null>(null)
  const inTitlebar = useContext(WorkspacePageHeaderHostContext)

  useActiveTabVisible(list, activeId ?? '', {
    enabled: Boolean(activeId),
    last: activeId === tabs.at(-1),
    tabCount: tabs.length
  })

  if (tabs.length === 0) {
    return null
  }

  return (
    <WorkspacePageHeaderControl bare id="library:tabs">
      <PaneTabStrip
        className={
          inTitlebar
            ? undefined
            : 'h-8 bg-(--ui-editor-surface-background) px-2 pt-1 [--pane-tab-active-bg:var(--ui-editor-surface-background)] [--pane-tab-strip-bg:var(--ui-editor-surface-background)]'
        }
        data-library-tabs=""
        listRef={list}
        titlebar={inTitlebar}
      >
        {tabs.map(id => (
          <LibraryTab active={id === activeId} id={id} key={id} onActivate={onActivate} />
        ))}
      </PaneTabStrip>
    </WorkspacePageHeaderControl>
  )
}
