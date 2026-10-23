/**
 * The team look's faces and the header switches that pick them: Classic | Team, and in the team
 * look Board · Overview · Inbox (with its count) · Agents · Org chart · Goals · Rules. The page asks `useTeamView()` which
 * face to show instead of the lanes (null = the lanes) and renders it through `TeamViewBody`, which also
 * hosts the agent file opened from the Agents and Org chart faces.
 */

import { SegmentedControl, useValue } from '@hermes/plugin-sdk'
import type { ComponentType } from 'react'

import { AgentFileDialog } from './agent-file'
import { BoardAgents } from './agents-view'
import { $boardMode, $boardView, type BoardMode, type BoardView } from './api'
import { BoardGoals } from './goals-view'
import { BoardInbox, useInboxCount } from './inbox'
import { BoardOrg } from './org-view'
import { BoardOverview } from './overview'
import { BoardRules } from './rules-view'
import type { KanbanBoard } from './types'
import { useKanban } from './ui'

type TeamFace = Exclude<BoardView, 'board'>

const FACES: Record<TeamFace, ComponentType<{ board: KanbanBoard; onOpen: (id: string) => void }>> = {
  agents: BoardAgents,
  goals: BoardGoals,
  inbox: BoardInbox,
  org: BoardOrg,
  overview: BoardOverview,
  rules: BoardRules
}

/** The face to show instead of the lanes, or null for the lanes (always null in Classic). */
export function useTeamView(): null | TeamFace {
  const mode = useValue($boardMode)
  const view = useValue($boardView)

  return mode === 'team' && view !== 'board' ? view : null
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
  const mode = useValue($boardMode)
  const view = useValue($boardView)
  const waiting = useInboxCount(board)

  return (
    <>
      <SegmentedControl<BoardMode>
        onChange={next => $boardMode.set(next)}
        options={[
          { id: 'classic', label: k.overview.modes.classic },
          { id: 'team', label: k.overview.modes.team }
        ]}
        value={mode}
      />
      {mode === 'team' && (
        <SegmentedControl<BoardView>
          onChange={next => $boardView.set(next)}
          options={[
            { id: 'board', label: k.overview.views.board },
            { id: 'overview', label: k.overview.views.overview },
            { id: 'inbox', label: waiting ? `${k.overview.views.inbox} · ${waiting}` : k.overview.views.inbox },
            { id: 'agents', label: k.overview.views.agents },
            { id: 'org', label: k.overview.views.org },
            { id: 'goals', label: k.overview.views.goals },
            { id: 'rules', label: k.overview.views.rules }
          ]}
          value={view}
        />
      )}
    </>
  )
}
