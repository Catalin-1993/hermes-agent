/**
 * Projects in the app's left sidebar (the `sidebar.routeSection` area, on every page): one row per project (board)
 * with its task count, the open one highlighted; a click opens that project on its Overview, "New project" creates
 * one, the second button opens the list of all projects. It steps aside while the Projects page is on screen, which
 * lists them itself. While the plugin is on, the sidebar's session list stays plain chats (no folder Projects).
 */

import { Button, cn, Codicon, DisclosureCaret, host, Tip, useQuery, useValue } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { $boardSlug, $projectsHome, $projectsOpen, boardsKey, fetchBoards, useKanbanScope } from './api'
import { NewBoardDialog } from './board-switcher'
import { openProject } from './projects-home'

const KANBAN_PATH = '/kanban'

const COPY = { title: 'Projects', add: 'New project', all: 'All projects', toggle: 'Show or hide projects' }

/** The same 24px ghost button the Sessions header uses; `reveal` ones show on hover, like its "+". */
function HeaderButton({
  icon,
  label,
  onClick,
  reveal
}: {
  icon: string
  label: string
  onClick: () => void
  reveal?: boolean
}) {
  return (
    <Tip label={label}>
      <Button
        aria-label={label}
        className={cn(
          'text-(--ui-text-tertiary) transition-opacity hover:bg-(--ui-control-hover-background) hover:text-foreground focus-visible:opacity-100',
          reveal ? 'opacity-0 group-hover/section:opacity-100' : 'opacity-70 hover:opacity-100'
        )}
        onClick={onClick}
        size="icon-xs"
        variant="ghost"
      >
        <Codicon name={icon} size="0.75rem" />
      </Button>
    </Tip>
  )
}

export function SidebarProjects() {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const [open, setOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const onPage = useValue($projectsOpen)
  const { data } = useQuery({ queryFn: fetchBoards, queryKey: boardsKey(scope), staleTime: 30_000 })

  if (!data || onPage) {
    return null
  }

  const current = slug || data.current

  // The list shows on every page, so a pick also brings the app to Projects.
  const pick = (board: string) => {
    openProject(board, data.current)
    host.navigate(KANBAN_PATH)
  }

  const showAll = () => {
    $projectsHome.set(true)
    host.navigate(KANBAN_PATH)
  }

  return (
    <section className="flex shrink-0 flex-col pb-1" data-kanban-sidebar-projects="">
      {/* Built like the Sessions header under it: label, count and caret on the left, the "+" and one more button
          on the right, in the same 24px slots so both headers line up. The label reads a little bolder. */}
      <div className="group/section flex shrink-0 items-center justify-between gap-1 pt-1.5 pb-1">
        <button
          aria-expanded={open}
          aria-label={COPY.toggle}
          className="group/section-label flex w-fit min-w-0 cursor-pointer items-center gap-1 bg-transparent text-left leading-none"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-2 pl-2 text-[0.6875rem] font-semibold text-(--ui-text-secondary)">
            <span className="min-w-0 truncate leading-none">{COPY.title}</span>
          </span>
          <span className="shrink-0 text-[0.6875rem] font-medium text-(--ui-text-quaternary) tabular-nums">
            {data.boards.length}
          </span>
          <DisclosureCaret
            className="text-(--ui-text-tertiary) opacity-0 transition group-hover/section-label:opacity-100"
            open={open}
          />
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <HeaderButton icon="add" label={COPY.add} onClick={() => setAdding(true)} reveal />
          <HeaderButton icon="folder-library" label={COPY.all} onClick={showAll} />
        </div>
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
                  onClick={() => pick(board.slug)}
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
