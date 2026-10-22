/** The overview's numbers, derived from the board the page already holds. Pure, so they are tested. */

import type { KanbanBoard, KanbanTask } from './types'

/** Queued: waiting for an agent to pick it up. */
const QUEUED = new Set(['ready', 'scheduled', 'todo', 'triage'])

export interface TeamRow {
  blocked: number
  done: number
  name: string
  queued: number
  running: number
}

const tasksOf = (board: KanbanBoard) => board.columns.flatMap(column => column.tasks)

/** Each assignee's load, the busiest first; unassigned work is not anyone's row. */
export function teamRows(board: KanbanBoard): TeamRow[] {
  const rows = new Map<string, TeamRow>()

  for (const task of tasksOf(board)) {
    if (!task.assignee || task.status === 'archived') {
      continue
    }

    const row = rows.get(task.assignee) ?? { blocked: 0, done: 0, name: task.assignee, queued: 0, running: 0 }

    if (task.status === 'running') {
      row.running += 1
    } else if (task.status === 'blocked') {
      row.blocked += 1
    } else if (task.status === 'done') {
      row.done += 1
    } else if (QUEUED.has(task.status)) {
      row.queued += 1
    }

    rows.set(task.assignee, row)
  }

  const load = (row: TeamRow) => row.running * 1000 + row.blocked * 100 + row.queued * 10 + row.done

  return [...rows.values()].sort((a, b) => load(b) - load(a) || a.name.localeCompare(b.name))
}

/** What waits on a person: blocked cards (a question first), then cards sent for review; oldest first within each. */
export function needsYou(board: KanbanBoard): KanbanTask[] {
  const rank = (task: KanbanTask) => (task.status === 'blocked' ? (task.block_kind === 'needs_input' ? 0 : 1) : 2)

  return tasksOf(board)
    .filter(task => task.status === 'blocked' || task.status === 'review')
    .sort((a, b) => rank(a) - rank(b) || (a.created_at ?? 0) - (b.created_at ?? 0))
}

/** The agents working right now: distinct assignees of running cards. */
export const agentsAtWork = (board: KanbanBoard) =>
  new Set(tasksOf(board).flatMap(task => (task.status === 'running' && task.assignee ? [task.assignee] : []))).size

/** How many cards each lane holds, in lane order, empty and archived lanes left out. */
export const statusShares = (board: KanbanBoard) =>
  board.columns
    .filter(column => column.name !== 'archived' && column.tasks.length > 0)
    .map(column => ({ count: column.tasks.length, name: column.name }))
