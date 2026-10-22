import { describe, expect, it } from 'vitest'

import { agentsAtWork, needsYou, statusShares, teamRows } from './overview-model'
import type { KanbanBoard, KanbanTask } from './types'

const task = (id: string, status: string, extra: Partial<KanbanTask> = {}): KanbanTask => ({
  id,
  status,
  title: id,
  ...extra
})

const board = (tasks: KanbanTask[]): KanbanBoard => ({
  assignees: [],
  columns: ['triage', 'ready', 'running', 'blocked', 'review', 'done', 'archived'].map(name => ({
    name,
    tasks: tasks.filter(entry => entry.status === name)
  })),
  latest_event_id: 0,
  now: 0,
  tenants: []
})

describe('kanban overview model', () => {
  const sample = board([
    task('a', 'running', { assignee: 'analist' }),
    task('b', 'running', { assignee: 'analist' }),
    task('c', 'ready', { assignee: 'risc' }),
    task('d', 'blocked', { assignee: 'risc', block_kind: 'dependency', created_at: 1 }),
    task('e', 'blocked', { assignee: 'manager', block_kind: 'needs_input', created_at: 5 }),
    task('f', 'review', { assignee: 'manager', created_at: 2 }),
    task('g', 'done', { assignee: 'manager' }),
    task('h', 'running'),
    task('i', 'archived', { assignee: 'vechi' })
  ])

  it('lists each agent by load, busiest first, without unassigned or archived work', () => {
    expect(teamRows(sample)).toEqual([
      { blocked: 0, done: 0, name: 'analist', queued: 0, running: 2 },
      { blocked: 1, done: 0, name: 'risc', queued: 1, running: 0 },
      { blocked: 1, done: 1, name: 'manager', queued: 0, running: 0 }
    ])
  })

  it('puts a question to the owner first, then other blocks, then reviews', () => {
    expect(needsYou(sample).map(entry => entry.id)).toEqual(['e', 'd', 'f'])
  })

  it('counts the agents at work, not the running cards', () => {
    expect(agentsAtWork(sample)).toBe(1)
  })

  it('shares only the lanes that hold cards', () => {
    expect(statusShares(sample)).toEqual([
      { count: 1, name: 'ready' },
      { count: 3, name: 'running' },
      { count: 2, name: 'blocked' },
      { count: 1, name: 'review' },
      { count: 1, name: 'done' }
    ])
  })
})
