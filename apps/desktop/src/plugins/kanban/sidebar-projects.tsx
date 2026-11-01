/**
 * Kanban's projects in the app's left sidebar, shown only while Kanban is open (the `sidebar.routeSection` area):
 * one row per project (board) with its task count, the open one highlighted; a click opens that project on its
 * Overview, "New project" creates one. While this shows, the sidebar's session list stays plain chats; elsewhere
 * the sidebar is as it always is.
 */

import { cn, Codicon, Tip, useQuery, useValue } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { $boardSlug, boardsKey, fetchBoards, useKanbanScope } from './api'
import { NewBoardDialog } from './board-switcher'
import { openProject } from './projects-home'

const COPY = { title: 'Projects', add: 'New project', toggle: 'Show or hide projects' }

export function SidebarProjects() {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const [open, setOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const { data } = useQuery({ queryFn: fetchBoards, queryKey: boardsKey(scope), staleTime: 30_000 })

  if (!data) {
    return null
  }

  const current = slug || data.current

  return (
    <section className="flex shrink-0 flex-col px-2 pt-1 pb-2" data-kanban-sidebar-projects="">
      <div className="flex h-7 items-center gap-1 px-1">
        <button
          aria-expanded={open}
          aria-label={COPY.toggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left text-[0.6875rem] font-semibold tracking-[0.06em] text-(--ui-text-tertiary) uppercase hover:text-(--ui-text-secondary)"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <Codicon name={open ? 'chevron-down' : 'chevron-right'} size="0.75rem" />
          {COPY.title}
          <span className="font-normal tabular-nums text-(--ui-text-quaternary)">{data.boards.length}</span>
        </button>
        <Tip label={COPY.add}>
          <button
            aria-label={COPY.add}
            className="grid size-6 cursor-pointer place-items-center rounded-md text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground"
            onClick={() => setAdding(true)}
            type="button"
          >
            <Codicon name="add" size="0.8rem" />
          </button>
        </Tip>
      </div>
      {open && (
        <ul className="flex flex-col gap-px">
          {data.boards.map(board => {
            const active = board.slug === current

            return (
              <li key={board.slug}>
                <button
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[0.8125rem] transition-colors',
                    active
                      ? 'bg-(--ui-row-active-background) font-medium text-foreground'
                      : 'text-(--ui-text-secondary) hover:bg-(--ui-row-hover-background) hover:text-foreground'
                  )}
                  onClick={() => openProject(board.slug, data.current)}
                  type="button"
                >
                  <Codicon
                    className={active ? 'text-foreground' : 'text-(--ui-text-tertiary)'}
                    name="folder"
                    size="0.85rem"
                  />
                  <span className="min-w-0 flex-1 truncate">{board.name || board.slug}</span>
                  {typeof board.total === 'number' && (
                    <span className="text-[0.6875rem] tabular-nums text-(--ui-text-quaternary)">{board.total}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <NewBoardDialog onClose={() => setAdding(false)} open={adding} />
    </section>
  )
}
