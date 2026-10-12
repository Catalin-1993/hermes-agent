import { useStore } from '@nanostores/react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { openSessionFromPicker } from '@/app/open-session'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'
import { sessionTitle } from '@/lib/chat-runtime'
import { relativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { $sessions, sessionMatchesStoredId } from '@/store/session'
import type { SessionInfo } from '@/types/hermes'

import { arrangeChats } from './chats-arrange'
import { $libraryRevision, type LibraryItem, listLibrary } from './data'
import { ITEM_TYPE_ICON, ITEM_TYPE_TINT, itemTypeOf } from './file-types'
import { LibraryHeader } from './library-browser'
import { $libraryViewPrefs, type LibraryFilters, naturalOrder, NO_FILTERS } from './library-prefs'
import { LibraryThumb } from './library-thumb'
import { SearchTool, ViewToggle } from './library-tools'
import { SortFilterMenu } from './sort-filter-menu'

export interface ChatGroup {
  /** The chat's stored id to open it by — its lineage root when the list knows it. */
  chatId: string
  items: LibraryItem[]
  session: null | SessionInfo
  /** The newest change among the group's items (seconds). */
  updatedAt: number
}

/** What Hermes made or changed, one group per conversation, newest work first. A conversation that
 *  was compressed keeps one group: its ids resolve to the same session. */
export function groupByChat(items: readonly LibraryItem[], sessions: readonly SessionInfo[]): ChatGroup[] {
  const groups = new Map<string, ChatGroup>()

  for (const item of items) {
    if (!item.session_id) {
      continue
    }

    const session = sessions.find(row => sessionMatchesStoredId(row, item.session_id!)) ?? null
    const chatId = session ? (session._lineage_root_id ?? session.id) : item.session_id
    const group = groups.get(chatId) ?? { chatId, items: [], session, updatedAt: 0 }

    group.items.push(item)
    group.updatedAt = Math.max(group.updatedAt, item.updated_at)
    groups.set(chatId, group)
  }

  // A block's file sits under its page: when the page is in the group, the page stands for both.
  const shown = (group: ChatGroup) => {
    const ids = new Set(group.items.map(item => item.id))

    return group.items.filter(item => !item.parent_id || !ids.has(item.parent_id))
  }

  return [...groups.values()]
    .map(group => ({ ...group, items: shown(group).sort((a, b) => b.updated_at - a.updated_at) }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

interface ChatsViewProps {
  /** The Library header's lead action and view tabs, which this view draws under its own tools. */
  actions: ReactNode
  onCreateWithHermes: () => void
  onOpen: (item: LibraryItem) => void
  tabs: ReactNode
}

/** The Library's "From chats": each conversation that produced something, as a card with what it
 *  made and the way back into it. */
export function ChatsView({ actions, onCreateWithHermes, onOpen, tabs }: ChatsViewProps) {
  const { t } = useI18n()
  const copy = t.library.chats
  const revision = useStore($libraryRevision)
  const sessions = useStore($sessions)
  const navigate = useNavigate()
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const prefs = useStore($libraryViewPrefs)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filters, setFilters] = useState<LibraryFilters>(NO_FILTERS)
  const searchInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let live = true

    listLibrary({ order: 'desc', sort: 'updated' }).then(
      ({ items: next }) => live && setItems(next.filter(item => item.session_id)),
      () => live && setItems([])
    )

    return () => {
      live = false
    }
  }, [revision])

  const all = useMemo(() => groupByChat(items ?? [], sessions), [items, sessions])
  const titleOf = (group: ChatGroup) => (group.session ? sessionTitle(group.session) : copy.untitledChat)

  const groups = useMemo(
    () =>
      arrangeChats(all, { filters, order: prefs.order, query, sort: prefs.sort }, group =>
        group.session ? sessionTitle(group.session) : copy.untitledChat
      ),
    [all, copy.untitledChat, filters, prefs.order, prefs.sort, query]
  )

  const tools = (
    <>
      <SearchTool
        inputRef={searchInput}
        onOpenChange={setSearchOpen}
        onQueryChange={setQuery}
        open={searchOpen}
        query={query}
      />
      <SortFilterMenu
        filters={filters}
        order={prefs.order ?? naturalOrder(prefs.sort)}
        prefs={prefs}
        setFilters={setFilters}
        sortable
      />
      <ViewToggle view={prefs.view} />
    </>
  )

  const header = <LibraryHeader actions={actions} tabs={tabs} tools={tools} />

  const empty = (body: ReactNode) => (
    <div className="grid flex-1 place-items-center px-8 pb-24">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">{body}</div>
    </div>
  )

  let content: ReactNode

  if (items === null) {
    content = (
      <div className="grid flex-1 place-items-center">
        <Loader />
      </div>
    )
  } else if (all.length === 0) {
    content = empty(
      <>
        <span className="grid size-11 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] text-(--ui-accent)">
          <Codicon name="comment-discussion" size="1.25rem" />
        </span>
        <p className="text-[0.9375rem] font-medium text-(--ui-text-primary)">{copy.emptyTitle}</p>
        <p className="text-[0.8125rem] leading-relaxed text-(--ui-text-tertiary)">{copy.emptyBody}</p>
        <Button className="mt-1" onClick={onCreateWithHermes} size="sm" variant="secondary">
          <Codicon name="sparkle" size="0.8125rem" />
          {t.library.create.button}
        </Button>
      </>
    )
  } else if (groups.length === 0) {
    content = empty(
      <>
        <span className="grid size-11 place-items-center rounded-2xl bg-(--ui-row-hover-background) text-(--ui-text-tertiary)">
          <Codicon name="search" size="1.25rem" />
        </span>
        <p className="text-[0.9375rem] font-medium text-(--ui-text-primary)">{t.library.empty.search(query.trim())}</p>
      </>
    )
  } else {
    content = (
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-16">
        <div className="flex flex-col gap-4">
          {groups.map(group => (
            <section
              className="rounded-xl border border-(--ui-stroke-tertiary) bg-[color-mix(in_srgb,var(--ui-bg-elevated)_55%,transparent)] p-4"
              data-slot="library-chat-group"
              key={group.chatId}
            >
              <header className="mb-3 flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--ui-accent)_9%,transparent)] text-(--ui-accent)">
                  <Codicon name="comment-discussion" size="0.9375rem" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-(--ui-text-primary)">{titleOf(group)}</span>
                  <span className="text-xs text-(--ui-text-tertiary)">
                    {copy.summary(group.items.length, relativeTime(group.updatedAt * 1000))}
                  </span>
                </div>
                <Button
                  className="h-7 gap-1.5 px-2.5 text-xs font-normal text-(--ui-text-secondary)"
                  onClick={() => openSessionFromPicker(group.chatId, navigate)}
                  variant="ghost"
                >
                  {copy.openChat}
                  <Codicon name="arrow-right" size="0.75rem" />
                </Button>
              </header>
              {prefs.view === 'grid' ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2.5">
                  {group.items.map(item => (
                    <button
                      className="group/card flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) text-left transition-[border-color,box-shadow] hover:border-(--ui-stroke-secondary) hover:shadow-[0_6px_18px_-10px_rgb(0_0_0/0.25)]"
                      key={item.id}
                      onClick={() => onOpen(item)}
                      type="button"
                    >
                      <LibraryThumb item={item} size="card" />
                      <span className="flex min-w-0 items-center gap-1.5 px-2.5 py-2">
                        {item.icon && <span className="shrink-0 text-sm leading-none">{item.icon}</span>}
                        <span className="truncate text-xs font-medium text-(--ui-text-primary)">
                          {item.title || item.file_name || t.library.untitled}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <ul className="flex flex-col">
                  {group.items.map(item => {
                    const type = itemTypeOf(item)

                    return (
                      <li key={item.id}>
                        <button
                          className={cn(
                            'flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 text-left text-[0.8125rem] transition-colors',
                            'hover:bg-(--ui-row-hover-background)'
                          )}
                          onClick={() => onOpen(item)}
                          type="button"
                        >
                          {item.icon ? (
                            <span className="grid size-4 shrink-0 place-items-center text-sm leading-none">
                              {item.icon}
                            </span>
                          ) : (
                            <Codicon
                              name={ITEM_TYPE_ICON[type]}
                              size="0.875rem"
                              style={{ color: ITEM_TYPE_TINT[type] }}
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate font-medium text-(--ui-text-primary)">
                            {item.title || item.file_name || t.library.untitled}
                          </span>
                          <span className="shrink-0 text-xs text-(--ui-text-tertiary)">{t.library.types[type]}</span>
                          <span className="w-24 shrink-0 text-right text-xs text-(--ui-text-tertiary)">
                            {relativeTime(item.updated_at * 1000)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {header}
      {content}
    </>
  )
}
