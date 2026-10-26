/**
 * The page's faces and the header switch that picks them: Overview · Board · Inbox (with its count) ·
 * Agents · Org chart · Goals · Rules. The page asks `useTeamView()` which face to show instead of the
 * lanes (null = the lanes) and renders it through `TeamViewBody`, which also hosts the agent file opened
 * from the Agents and Org chart faces.
 */

import { SegmentedControl, useValue } from '@hermes/plugin-sdk'
import type { ComponentType } from 'react'

import { AgentFileDialog } from './agent-file'
import { $boardView, type BoardView } from './api'
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
      <Face board={board} onOpen={onOpen} />
      <AgentFileDialog board={board} onOpen={onOpen} />
    </>
  )
}

export function LookSwitch({ board }: { board: KanbanBoard | null }) {
  const k = useKanban()
  const view = useValue($boardView)
  const waiting = useInboxCount(board)
  const views = k.overview.views

  return (
    <SegmentedControl<BoardView>
      onChange={next => $boardView.set(next)}
      options={[
        { id: 'overview', label: views.overview },
        { id: 'board', label: views.board },
        { id: 'inbox', label: waiting ? `${views.inbox} · ${waiting}` : views.inbox },
        { id: 'agents', label: views.agents },
        { id: 'goals', label: views.goals },
        { id: 'rules', label: views.rules },
        { id: 'journal', label: JOURNAL.tab }
      ]}
      value={view}
    />
  )
}
