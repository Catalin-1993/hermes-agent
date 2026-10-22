import { describe, expect, it } from 'vitest'

import { buildInbox, countByKind, snooze } from './inbox-model'
import type { KanbanBoard, KanbanControls, KanbanTask } from './types'

const task = (id: string, status: string, extra: Partial<KanbanTask> = {}): KanbanTask => ({
  assignee: 'analist',
  created_at: 10,
  id,
  status,
  title: id,
  ...extra
})

const board = (tasks: KanbanTask[]): KanbanBoard => ({
  assignees: [],
  columns: [{ name: 'all', tasks }],
  latest_event_id: 0,
  now: 0,
  tenants: []
})

const controls: KanbanControls = {
  agents: [
    {
      monthly_budget_usd: 5,
      month_spend_usd: 6,
      pause_reason: 'budget',
      paused: true,
      paused_at: 3,
      profile: 'risc',
      unpriced_sessions: 0
    },
    {
      monthly_budget_usd: null,
      month_spend_usd: 1,
      pause_reason: 'manual',
      paused: true,
      paused_at: 1,
      profile: 'manager',
      unpriced_sessions: 0
    }
  ],
  all_paused: false,
  all_paused_at: null,
  month_start: 0
}

const sample = board([
  task('dep', 'blocked', { block_kind: 'dependency', created_at: 1 }),
  task('rev', 'review'),
  task('ask-late', 'blocked', { block_kind: 'needs_input', created_at: 20 }),
  task('ask', 'blocked', { block_kind: 'needs_input', created_at: 5 }),
  task('broken', 'running', { warnings: { count: 2, highest_severity: 'error' } }),
  task('noise', 'ready', { warnings: { count: 1, highest_severity: 'warning' } }),
  task('fine', 'running')
])

describe('kanban inbox', () => {
  it('orders questions first, then money, reviews, blocks and problems', () => {
    expect(buildInbox(sample, controls, {}).map(item => item.id)).toEqual([
      'question:ask',
      'question:ask-late',
      'budget:risc',
      'review:rev',
      'blocked:dep',
      'problem:broken'
    ])
  })

  it('leaves out a manual pause and a mere warning: the owner chose those', () => {
    const ids = buildInbox(sample, controls, {}).map(item => item.id)

    expect(ids).not.toContain('budget:manager')
    expect(ids).not.toContain('problem:noise')
  })

  it('hides an item put off until later, and brings it back after a day', () => {
    const later = snooze({}, 'review:rev', 1000)

    expect(buildInbox(sample, controls, later, 2000).map(item => item.id)).not.toContain('review:rev')
    expect(buildInbox(sample, controls, later, 1000 + 25 * 3600 * 1000).map(item => item.id)).toContain('review:rev')
  })

  it('counts each kind for the filters', () => {
    expect(countByKind(buildInbox(sample, controls, {}))).toEqual({
      blocked: 1,
      budget: 1,
      problem: 1,
      question: 2,
      review: 1
    })
  })
})
