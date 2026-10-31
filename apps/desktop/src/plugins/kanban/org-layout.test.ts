import { describe, expect, it } from 'vitest'

import { autoLayout, bounds, cardAt, CEO, GAP, links, withPlaced } from './org-layout'
import { orgTree } from './org-model'
import type { KanbanProfile } from './types'

const agent = (name: string, reports_to = ''): KanbanProfile => ({
  description: '',
  description_auto: false,
  is_default: false,
  name,
  reports_to
})

const card = { height: 100, width: 200 }
const ceo = { height: 60, width: 240 }
const sizeOf = (name: string) => (name === CEO ? ceo : card)

describe('autoLayout', () => {
  it('centres a manager over a row of reports, under the CEO', () => {
    const { trees } = orgTree([agent('sef'), agent('a', 'sef'), agent('b', 'sef')])
    const places = autoLayout(trees, sizeOf)
    const a = places.get('a')!
    const b = places.get('b')!
    const sef = places.get('sef')!

    expect(a.y).toBe(b.y)
    expect(b.x - a.x).toBe(card.width + GAP.sibling)
    expect(sef.x + card.width / 2).toBe((a.x + b.x + card.width) / 2)
    expect(sef.y).toBeGreaterThan(places.get(CEO)!.y)
  })

  it('stacks three reports who lead nobody in one column, and four or more in two', () => {
    const three = autoLayout(orgTree([agent('s'), agent('a', 's'), agent('b', 's'), agent('c', 's')]).trees, sizeOf)
    expect(new Set(['a', 'b', 'c'].map(name => three.get(name)!.x)).size).toBe(1)

    const four = autoLayout(
      orgTree([agent('s'), agent('a', 's'), agent('b', 's'), agent('c', 's'), agent('d', 's')]).trees,
      sizeOf
    )

    expect(new Set(['a', 'b', 'c', 'd'].map(name => four.get(name)!.x)).size).toBe(2)
    expect(new Set(['a', 'b', 'c', 'd'].map(name => four.get(name)!.y)).size).toBe(2)
  })
})

describe('placing by hand', () => {
  it('keeps a card where it was put, ignores names no longer on the chart, and lines follow it', () => {
    const { trees } = orgTree([agent('sef'), agent('a', 'sef')])
    const places = withPlaced(autoLayout(trees, sizeOf), { a: { x: 900, y: 40 }, gone: { x: 1, y: 1 } }, trees)

    expect(places.get('a')).toEqual({ x: 900, y: 40 })
    expect(places.has('gone')).toBe(false)
    expect(links(trees, places, sizeOf).find(line => line.id === 'sef>a')!.d).toContain('V40')
    expect(bounds(places, sizeOf).width).toBeGreaterThanOrEqual(1100 - places.get(CEO)!.x)
  })

  it('moves the people under a card along with it', () => {
    const { trees } = orgTree([agent('sef'), agent('lead', 'sef'), agent('x', 'lead')])
    const auto = autoLayout(trees, sizeOf)
    const lead = auto.get('lead')!
    const places = withPlaced(auto, { lead: { x: lead.x + 500, y: lead.y + 70 } }, trees)

    expect(places.get('x')).toEqual({ x: auto.get('x')!.x + 500, y: auto.get('x')!.y + 70 })
    expect(places.get('sef')).toEqual(auto.get('sef'))
  })

  it('finds the card under the pointer, never the one being dragged', () => {
    const places = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 300, y: 0 }]
    ])

    expect(cardAt({ x: 350, y: 50 }, places, sizeOf, 'a')).toBe('b')
    expect(cardAt({ x: 50, y: 50 }, places, sizeOf, 'a')).toBeNull()
  })
})
