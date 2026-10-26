import { describe, expect, it } from 'vitest'

import {
  geometry,
  hitDrawings,
  logicalToTime,
  makeDrawing,
  pointsNeeded,
  shifted,
  timeToLogical,
  withPoint
} from './drawing-model'
import type { Projector } from './drawing-model'

// 1 second = 1 px across, 1 price unit = 1 px up from a 400 px floor.
const proj: Projector = {
  price: y => 400 - y,
  time: x => x,
  x: time => time,
  y: price => 400 - price
}

const bounds = { height: 400, width: 800 }
const p = (time: number, price: number) => ({ price, time })

describe('time on the chart', () => {
  const times = [0, 60, 120, 180]

  it('puts a time between two bars between their positions, and continues past either end', () => {
    expect(timeToLogical(times, 90)).toBe(1.5)
    expect(timeToLogical(times, 180)).toBe(3)
    expect(timeToLogical(times, 240)).toBe(4)
    expect(timeToLogical(times, -60)).toBe(-1)
  })

  it('goes back from a position to a time', () => {
    for (const time of [-60, 0, 30, 90, 180, 300]) {
      expect(logicalToTime(times, timeToLogical(times, time))).toBe(time)
    }
  })
})

describe('drawings', () => {
  it('needs one point for a horizontal or vertical line and two for the rest', () => {
    expect(pointsNeeded('hline')).toBe(1)
    expect(pointsNeeded('vline')).toBe(1)
    expect(pointsNeeded('trend')).toBe(2)
    expect(makeDrawing('rect', 'a', p(1, 2), p(3, 4)).points).toHaveLength(2)
    expect(makeDrawing('hline', 'a', p(1, 2)).points).toHaveLength(1)
  })

  it('lays a horizontal line edge to edge and a ray out to where it leaves the plot', () => {
    const h = geometry(makeDrawing('hline', 'h', p(100, 150)), proj, bounds)!
    expect(h.segments[0]).toEqual([
      { x: 0, y: 250 },
      { x: 800, y: 250 }
    ])

    const ray = geometry(makeDrawing('ray', 'r', p(100, 100), p(200, 200)), proj, bounds)!
    expect(ray.segments[0][0]).toEqual({ x: 100, y: 300 })
    expect(ray.segments[0][1].x).toBeGreaterThan(800)
  })

  it('gives Fibonacci its levels between the two points and a rectangle its box', () => {
    const fib = geometry(makeDrawing('fib', 'f', p(100, 100), p(300, 200)), proj, bounds)!
    expect(fib.levels?.map(level => level.ratio)).toContain(0.618)
    expect(fib.levels?.[0].x1).toBe(100)
    expect(fib.levels?.[0].x2).toBe(300)

    const box = geometry(makeDrawing('rect', 'b', p(300, 200), p(100, 100)), proj, bounds)!
    expect(box.fill).toEqual({ x1: 100, x2: 300, y1: 200, y2: 300 })
  })

  it('hits a handle of the selected drawing first, then the line, then nothing', () => {
    const line = makeDrawing('trend', 't', p(100, 100), p(300, 200))
    const other = makeDrawing('hline', 'h', p(100, 100))
    const drawings = [other, line]

    // The end handle of the selected line, even though the horizontal line is under it too.
    expect(hitDrawings(drawings, 't', proj, bounds, 100, 300)).toEqual({ id: 't', index: 0, part: 'handle' })
    // Along the body of the trend line.
    expect(hitDrawings(drawings, null, proj, bounds, 200, 250)).toEqual({ id: 't', part: 'body' })
    // On the horizontal line, away from the trend line.
    expect(hitDrawings(drawings, null, proj, bounds, 600, 300)).toEqual({ id: 'h', part: 'body' })
    expect(hitDrawings(drawings, null, proj, bounds, 600, 50)).toBeNull()
  })

  it('selects a rectangle from inside it', () => {
    const box = makeDrawing('rect', 'b', p(100, 100), p(300, 200))

    expect(hitDrawings([box], null, proj, bounds, 200, 250)).toEqual({ id: 'b', part: 'body' })
  })

  it('moves one point, or the whole drawing by the way the pointer moved', () => {
    const line = makeDrawing('trend', 't', p(100, 100), p(300, 200))

    expect(withPoint(line, 1, p(400, 250)).points).toEqual([p(100, 100), p(400, 250)])
    expect(shifted(line, p(150, 120), p(170, 110)).points).toEqual([p(120, 90), p(320, 190)])
  })
})
