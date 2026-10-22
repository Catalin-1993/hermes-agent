/**
 * The team look's faces and the header switches that pick them: Classic | Team, and in the team
 * look Board · Overview · Inbox (with its count) · Agents. The page asks `useTeamView()` which face
 * to show instead of the lanes (null = the lanes) and renders it through `TeamViewBody`.
 */

import { SegmentedControl, useValue } from '@hermes/plugin-sdk'
import type { ComponentType } from 'react'

import { BoardAgents } from './agents-view'
import { $boardMode, $boardView, type BoardMode, type BoardView } from './api'
import { BoardInbox, useInboxCount } from './inbox'
import { BoardOverview } from './overview'
import type { KanbanBoard } from './types'
import { useKanban } from './ui'

type TeamFace = Exclude<BoardView, 'board'>

const FACES: Record<TeamFace, ComponentType<{ board: KanbanBoard; onOpen: (id: string) => void }>> = {
  agents: BoardAgents,
  inbox: BoardInbox,
  overview: BoardOverview
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

  return <Face board={board} onOpen={onOpen} />
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
            { id: 'agents', label: k.overview.views.agents }
          ]}
          value={view}
        />
      )}
    </>
  )
}
