/** The Board's four stages: each groups the board's statuses a beginner need not tell apart, and says where a card
 *  dropped on it goes. The statuses stay as they are — every card still shows its own, and its menu moves it to
 *  any of them. Pure, so it is tested. */

import type { KanbanColumn, KanbanTask } from './types'

export type StageId = 'done' | 'needs' | 'progress' | 'todo'

export interface Stage {
  /** Where a new card made from the stage's "+" starts; null = the stage takes none. */
  add: null | string
  /** Where a card dropped on the stage goes; null = it cannot be dropped on (the dispatcher sets it). */
  drop: null | string
  id: StageId
  statuses: readonly string[]
}

export const STAGES: readonly Stage[] = [
  { add: 'triage', drop: 'ready', id: 'todo', statuses: ['triage', 'todo', 'scheduled', 'ready'] },
  { add: null, drop: null, id: 'progress', statuses: ['running'] },
  { add: null, drop: 'blocked', id: 'needs', statuses: ['blocked', 'review'] },
  { add: null, drop: 'done', id: 'done', statuses: ['done', 'archived'] }
]

/** The board's lanes folded into the four stages, each stage's cards in its statuses' order. */
export function stageColumns(columns: readonly KanbanColumn[]): { name: StageId; stage: Stage; tasks: KanbanTask[] }[] {
  const byStatus = new Map(columns.map(column => [column.name, column.tasks]))

  return STAGES.map(stage => ({
    name: stage.id,
    stage,
    tasks: stage.statuses.flatMap(status => byStatus.get(status) ?? [])
  }))
}
