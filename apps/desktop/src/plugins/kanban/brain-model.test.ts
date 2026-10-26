import { describe, expect, it } from 'vitest'

import { agentsAcross, attentionAcross, isActive, projectStats, runTotals } from './brain-model'
import type { KanbanActivity, KanbanBoard, KanbanTask } from './types'

const task = (id: string, status: string, extra: Partial<KanbanTask> = {}): KanbanTask => ({
  id,
  status,
  title: id,
  ...extra
})

const board = (...tasks: KanbanTask[]): KanbanBoard => ({
  assignees: [],
  columns: [{ name: 'all', tasks }],
  latest_event_id: 0,
  now: 0,
  tenants: []
})

describe('projectStats', () => {
  it('counts progress over live cards and names the state', () => {
    const stats = projectStats(board(task('a', 'done'), task('b', 'running', { assignee: 'x' }), task('c', 'todo')))

    expect(stats).toMatchObject({ done: 1, percent: 33, state: 'running', total: 3 })
    expect(isActive(stats)).toBe(true)
  })

  it('is blocked before running, done when all done, empty with no cards', () => {
    expect(projectStats(board(task('a', 'blocked'), task('b', 'running'))).state).toBe('blocked')
    expect(projectStats(board(task('a', 'done'))).state).toBe('done')
    expect(isActive(projectStats(board(task('a', 'done'))))).toBe(false)
    expect(projectStats(undefined).state).toBe('empty')
  })
})

describe('across projects', () => {
  const one = {
    board: board(task('a', 'running', { assignee: 'ana' }), task('b', 'blocked', { block_kind: 'needs_input' })),
    meta: { slug: 'one' }
  }

  const two = { board: board(task('c', 'running', { assignee: 'ana' }), task('d', 'review')), meta: { slug: 'two' } }

  it('lists what waits on the owner, questions first', () => {
    expect(attentionAcross([two, one]).map(item => item.task.id)).toEqual(['b', 'd'])
  })

  it('groups running cards by agent over every project', () => {
    const [ana] = agentsAcross([one, two])

    expect(ana?.name).toBe('ana')
    expect(ana?.running.map(item => item.project.slug)).toEqual(['one', 'two'])
  })

  it('sums run totals only over projects whose activity loaded', () => {
    const activity = (completed: number, failed: number): KanbanActivity => ({
      days: [],
      events: [],
      now: 0,
      success_rate: null,
      totals: { blocked: 0, completed, failed, other: 0 }
    })

    expect(runTotals([one])).toBeNull()
    expect(
      runTotals([
        { ...one, activity: activity(3, 1) },
        { ...two, activity: activity(1, 0) }
      ])
    ).toEqual({
      completed: 4,
      failed: 1,
      successRate: 80
    })
  })
})
