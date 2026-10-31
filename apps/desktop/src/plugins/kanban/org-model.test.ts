import { describe, expect, it } from 'vitest'

import { agentWork, canReportTo, moveInChart, orgLevels, orgTree, stacks } from './org-model'
import type { KanbanBoard, KanbanProfile } from './types'

const agent = (name: string, reports_to = '', title = ''): KanbanProfile => ({
  description: '',
  description_auto: false,
  is_default: false,
  name,
  reports_to,
  title
})

const team = [agent('sef'), agent('analist', 'sef'), agent('risc', 'analist'), agent('nou')]

describe('orgTree', () => {
  it('nests every report under its manager and keeps unplaced agents apart', () => {
    const { loose, trees } = orgTree(team)

    expect(trees.map(node => node.profile.name)).toEqual(['sef'])
    expect(trees[0].reports[0].profile.name).toBe('analist')
    expect(trees[0].reports[0].reports[0].profile.name).toBe('risc')
    expect(loose.map(profile => profile.name)).toEqual(['nou'])
  })

  it('makes an agent whose manager is gone a top of its own', () => {
    const { loose, trees } = orgTree([agent('analist', 'sters'), agent('risc', 'analist')])

    expect(trees.map(node => node.profile.name)).toEqual(['analist'])
    expect(loose).toEqual([])
  })
})

describe('canReportTo', () => {
  it('refuses itself, someone below it and an unknown manager', () => {
    expect(canReportTo(team, 'sef', 'sef')).toBe(false)
    expect(canReportTo(team, 'sef', 'risc')).toBe(false)
    expect(canReportTo(team, 'sef', 'nimeni')).toBe(false)
  })

  it('allows a sideways move and the top of the chart', () => {
    expect(canReportTo(team, 'risc', 'sef')).toBe(true)
    expect(canReportTo(team, 'analist', '')).toBe(true)
  })
})

describe('moveInChart', () => {
  it('moves the agent and recomputes who reports to whom', () => {
    const moved = moveInChart(team, 'risc', 'sef')
    const sef = moved.find(profile => profile.name === 'sef')!

    expect(sef.reports).toEqual(['analist', 'risc'])
    expect(moved.find(profile => profile.name === 'analist')!.reports).toEqual([])
  })
})

describe('orgLevels', () => {
  it('makes a top the Project Lead, a manager under it a Team Lead and the rest Executors', () => {
    const levels = orgLevels(
      orgTree([
        agent('ceo-ish'),
        agent('lead', 'ceo-ish'),
        agent('a', 'lead'),
        agent('b', 'lead'),
        agent('x', 'ceo-ish')
      ]).trees
    )

    expect(Object.fromEntries(levels)).toEqual({
      'ceo-ish': 'lead',
      lead: 'team',
      a: 'executor',
      b: 'executor',
      x: 'executor'
    })
  })

  it('leaves unplaced agents out', () => {
    expect(orgLevels(orgTree([agent('solo')]).trees).size).toBe(0)
  })
})

describe('agentWork', () => {
  const board = {
    assignees: [],
    columns: [
      { name: 'running', tasks: [{ assignee: 'a', id: 't1', status: 'running', title: 'Analyse BTC' }] },
      { name: 'done', tasks: [{ assignee: 'b', id: 't2', status: 'done', title: 'Raport LINK' }] }
    ],
    latest_event_id: 0,
    now: 0,
    tenants: []
  } as KanbanBoard

  const event = (actor: string, kind: string, task_title: string, created_at: number) => ({
    actor,
    created_at,
    id: created_at,
    kind,
    task_id: 'x',
    task_title
  })

  it('says what it is running and the newest thing it finished', () => {
    const work = agentWork(
      board,
      [
        event('a', 'completed', 'Old', 10),
        event('a', 'completed', 'Newer', 20),
        event('a', 'claimed', 'Analyse BTC', 30)
      ],
      'a'
    )

    expect(work).toEqual({ last: { at: 20, title: 'Newer' }, working: { id: 't1', title: 'Analyse BTC' } })
  })

  it('falls back to its last done card when the feed has none', () => {
    expect(agentWork(board, [], 'b')).toEqual({ last: { at: null, title: 'Raport LINK' }, working: null })
    expect(agentWork(board, [], 'nobody')).toEqual({ last: null, working: null })
  })
})

describe('stacks', () => {
  it('stacks three or more reports who lead nobody in a column, and keeps a row otherwise', () => {
    const big = orgTree([agent('sef'), agent('a', 'sef'), agent('b', 'sef'), agent('c', 'sef')]).trees[0]!
    const two = orgTree([agent('sef'), agent('a', 'sef'), agent('b', 'sef')]).trees[0]!

    const deep = orgTree([agent('sef'), agent('a', 'sef'), agent('b', 'sef'), agent('c', 'sef'), agent('d', 'a')])
      .trees[0]!

    expect(stacks(big)).toBe(true)
    expect(stacks(two)).toBe(false)
    expect(stacks(deep)).toBe(false)
  })
})
