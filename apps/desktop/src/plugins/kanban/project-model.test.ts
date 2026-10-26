import { describe, expect, it } from 'vitest'

import { primaryGoal, summarize } from './project-model'
import type { BoardGoal, KanbanBoard, KanbanTask } from './types'

const task = (id: string, status: string): KanbanTask => ({ id, status, title: id })

const board = (...tasks: KanbanTask[]): KanbanBoard => ({
  assignees: [],
  columns: [{ name: 'all', tasks }],
  latest_event_id: 0,
  now: 0,
  tenants: []
})

const goal = (id: number, target_date: null | string, status: BoardGoal['status'] = 'active'): BoardGoal =>
  ({ id, status, target_date, title: `g${id}` }) as BoardGoal

describe('summarize', () => {
  it('puts a decision waiting on the owner before everything else', () => {
    expect(summarize(board(task('a', 'running'), task('b', 'review'))).state).toBe('needs')
  })

  it('is running, done, idle or empty otherwise', () => {
    expect(summarize(board(task('a', 'running'))).state).toBe('running')
    expect(summarize(board(task('a', 'done'))).state).toBe('done')
    expect(summarize(board(task('a', 'done'), task('b', 'todo'))).state).toBe('idle')
    expect(summarize(board()).state).toBe('empty')
  })

  it('counts progress over cards that are not archived', () => {
    const b = {
      ...board(task('a', 'done'), task('b', 'todo')),
      columns: [
        { name: 'archived', tasks: [task('z', 'done')] },
        { name: 'all', tasks: [task('a', 'done'), task('b', 'todo')] }
      ]
    }

    expect(summarize(b)).toMatchObject({ done: 1, total: 2 })
  })
})

describe('primaryGoal', () => {
  it('is the active goal due soonest, undated last', () => {
    expect(
      primaryGoal([goal(1, null), goal(2, '2026-12-31'), goal(3, '2026-11-02'), goal(4, '2026-10-01', 'achieved')])?.id
    ).toBe(3)
  })

  it('is null with no active goal', () => {
    expect(primaryGoal([goal(1, null, 'dropped')])).toBeNull()
    expect(primaryGoal(undefined)).toBeNull()
  })
})
