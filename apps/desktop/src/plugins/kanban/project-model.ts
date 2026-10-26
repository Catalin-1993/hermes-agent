/** What the Overview's project header says: the project's state and the goal it works toward. Pure, so it is tested. */

import { needsYou } from './overview-model'
import type { BoardGoal, KanbanBoard } from './types'

export type ProjectState = 'done' | 'empty' | 'idle' | 'needs' | 'running'

export interface ProjectSummary {
  done: number
  state: ProjectState
  total: number
}

/** Cards that count: archived ones are out of the picture. */
const live = (board: KanbanBoard) => board.columns.filter(column => column.name !== 'archived').flatMap(c => c.tasks)

/** Where the project stands: waiting on you first, then working, then finished, else idle. */
export function summarize(board: KanbanBoard): ProjectSummary {
  const tasks = live(board)
  const done = tasks.filter(task => task.status === 'done').length

  const state: ProjectState = !tasks.length
    ? 'empty'
    : needsYou(board).length
      ? 'needs'
      : tasks.some(task => task.status === 'running')
        ? 'running'
        : done === tasks.length
          ? 'done'
          : 'idle'

  return { done, state, total: tasks.length }
}

/** The goal the project works toward now: the active one due soonest (undated ones last), else the first. */
export function primaryGoal(goals: readonly BoardGoal[] | undefined): BoardGoal | null {
  const active = (goals ?? []).filter(goal => goal.status === 'active')
  const due = (goal: BoardGoal) => goal.target_date ?? '9999-12-31'

  return [...active].sort((a, b) => due(a).localeCompare(due(b)) || a.id - b.id)[0] ?? null
}
