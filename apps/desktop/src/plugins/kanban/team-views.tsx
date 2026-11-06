/**
 * The page's faces and the top bar that picks them: Overview · Board · Inbox (with its count) · Chat · Agents ·
 * Goals · Journal (Rules opens from the Overview). The page asks `useTeamView()` which face to show instead of the
 * lanes (null = the lanes) and renders it through `TeamViewBody`, which also hosts the agent file opened
 * from the Agents and Org chart faces.
 */

import { cn, Codicon, useValue } from '@hermes/plugin-sdk'
import type { ComponentType } from 'react'

import { AgentFileDialog } from './agent-file'
import { $boardView, type BoardView } from './api'
import { CHAT } from './chat-copy'
import { BoardChat } from './chat-view'
import { FaceBoundary } from './face-boundary'
import { BoardGoals } from './goals-view'
import { BoardInbox, useInboxCount } from './inbox'
import { JOURNAL } from './journal-copy'
import { BoardJournal } from './journal-view'
import { BoardOverview } from './overview'
import { BoardRules } from './rules-view'
import { BoardTeam } from './team-page'
import type { KanbanBoard } from './types'
import { useKanban } from './ui'

type TeamFace = Exclude<BoardView, 'board'>

const FACES: Record<TeamFace, ComponentType<{ board: KanbanBoard; onOpen: (id: string) => void }>> = {
  agents: BoardTeam,
  chat: BoardChat,
  goals: BoardGoals,
  inbox: BoardInbox,
  journal: BoardJournal,
  org: BoardTeam,
  overview: BoardOverview,
  rules: BoardRules
}

/** The face to show instead of the lanes, or null for the lanes (always null in Classic). */
export function useTeamView(): null | TeamFace {
  const view = useValue($boardView)

  return view === 'board' ? null : view
}

export function TeamViewBody({
  board,
  onOpen,
  view
}: {
  board: KanbanBoard
  onOpen: (id: string) => void
  view: TeamFace
}) {
  const Face = FACES[view]

  return (
    <>
      <FaceBoundary view={view}>
        <Face board={board} onOpen={onOpen} />
      </FaceBoundary>
      <AgentFileDialog board={board} onOpen={onOpen} />
    </>
  )
}

/** The page's main tabs: one row of named places with an icon each, the Inbox carrying its count. Rules has no tab
 *  of its own (it opens from the Overview's Rules card); while it is open it shows here as a closable pill. */
const TABS: { icon: string; id: BoardView }[] = [
  { icon: 'dashboard', id: 'overview' },
  { icon: 'project', id: 'board' },
  { icon: 'inbox', id: 'inbox' },
  { icon: 'comment-discussion', id: 'chat' },
  { icon: 'organization', id: 'agents' },
  { icon: 'target', id: 'goals' },
  { icon: 'book', id: 'journal' }
]

export function TopNav({ board }: { board: KanbanBoard | null }) {
  const k = useKanban()
  const view = useValue($boardView)
  const waiting = useInboxCount(board)
  const label = (id: BoardView) => NAV_LABEL[id] ?? k.overview.views[id as keyof typeof k.overview.views] ?? id

  return (
    <nav
      aria-label={NAV_LABEL.nav}
      className="kanban-nav flex min-w-0 items-center gap-0.5 [-webkit-app-region:no-drag]"
      data-kanban-nav=""
    >
      {TABS.map(tab => {
        const on = view === tab.id || (tab.id === 'agents' && view === 'org')

        return (
          <button
            aria-current={on ? 'page' : undefined}
            aria-label={label(tab.id)}
            className={cn(
              'kanban-tab relative inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-medium',
              on
                ? 'bg-(--ui-bg-elevated) text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.3),inset_0_0_0_1px_var(--ui-stroke-secondary)]'
                : 'text-(--ui-text-secondary) hover:bg-(--chrome-action-hover) hover:text-foreground'
            )}
            key={tab.id}
            onClick={() => $boardView.set(tab.id)}
            type="button"
          >
            <Codicon name={tab.icon} size="0.95rem" />
            {/* The names show while the room allows; the open page always keeps its name. */}
            <span className={on ? undefined : 'hidden @[52rem]:inline'}>{label(tab.id)}</span>
            {tab.id === 'inbox' && waiting > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#ef4444] px-1 text-[0.625rem] font-bold text-white tabular-nums">
                {waiting}
              </span>
            )}
          </button>
        )
      })}
      {view === 'rules' && (
        <button
          aria-current="page"
          className="kanban-tab inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg bg-(--ui-bg-elevated) px-2.5 text-[0.8125rem] font-medium text-foreground shadow-[inset_0_0_0_1px_var(--ui-stroke-secondary)]"
          onClick={() => $boardView.set('overview')}
          type="button"
        >
          <Codicon name="law" size="0.95rem" />
          {k.overview.views.rules}
          <Codicon className="text-(--ui-text-tertiary)" name="close" size="0.8rem" />
        </button>
      )}
    </nav>
  )
}

/** Tab names this page adds to the Kanban words (English, like the rest). */
const NAV_LABEL: Partial<Record<BoardView | 'nav', string>> = { chat: CHAT.tab, journal: JOURNAL.tab, nav: 'Projects' }
