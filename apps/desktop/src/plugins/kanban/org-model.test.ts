import { describe, expect, it } from 'vitest'

import { canReportTo, moveInChart, orgTree } from './org-model'
import type { KanbanProfile } from './types'

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
