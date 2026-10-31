import { describe, expect, it } from 'vitest'

import { stageColumns, STAGES } from './stage-model'
import type { KanbanColumn, KanbanTask } from './types'

const task = (id: string, status: string): KanbanTask => ({ id, status, title: id })
const column = (name: string, ...ids: string[]): KanbanColumn => ({ name, tasks: ids.map(id => task(id, name)) })

describe('stageColumns', () => {
  it('folds every status into one of four stages, in order, losing no card', () => {
    const columns = [
      column('triage', 'a'),
      column('todo', 'b'),
      column('scheduled', 'c'),
      column('ready', 'd'),
      column('running', 'e'),
      column('blocked', 'f'),
      column('review', 'g'),
      column('done', 'h')
    ]

    const stages = stageColumns(columns)

    expect(stages.map(stage => stage.name)).toEqual(['todo', 'progress', 'needs', 'done'])
    expect(stages.map(stage => stage.tasks.map(t => t.id).join(''))).toEqual(['abcd', 'e', 'fg', 'h'])
  })

  it('covers every status the board has, and drops only on ones a person may set', () => {
    const statuses = STAGES.flatMap(stage => stage.statuses)

    for (const name of ['triage', 'todo', 'scheduled', 'ready', 'running', 'blocked', 'review', 'done', 'archived']) {
      expect(statuses).toContain(name)
    }

    expect(STAGES.map(stage => stage.drop)).toEqual(['ready', null, 'blocked', 'done'])
  })
})
