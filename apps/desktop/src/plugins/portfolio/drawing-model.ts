/**
 * What the chart's drawings are made of, TradingView style: the point(s) each one is anchored by, where
 * they land on screen for the chart's current zoom (`Projector`), what a click on them hits (a handle, to
 * stretch it, or the body, to move it whole) and how they move. Pure — the canvas paints from `geometry`
 * and the pointer handling asks `hitDrawings`; both are tested without a browser.
 */

import { fibLevels } from './indicators'
import type { ChartPoint, Drawing } from './studio-model'

export type DrawingType = Drawing['type']

export interface Pt {
  x: number
  y: number
}

/** The plot area, in pixels: the lines that run edge to edge stop at it. */
export interface Bounds {
  height: number
  width: number
}

/** Time and price to pixels and back, for the chart's current zoom and scroll. Null when off the scale. */
export interface Projector {
  price: (y: number) => null | number
  time: (x: number) => null | number
  x: (time: number) => null | number
  y: (price: number) => null | number
}

export interface Geometry {
  fill?: { x1: number; x2: number; y1: number; y2: number }
  handles: Pt[]
  levels?: { price: number; ratio: number; x1: number; x2: number; y: number }[]
  segments: [Pt, Pt][]
}

export type Hit = { id: string; part: 'body' } | { id: string; index: number; part: 'handle' }

export const DRAWING_COLOR = '#60a5fa'
export const HANDLE_RADIUS = 5
const HIT = 7

/** How many points each drawing is anchored by. */
export const pointsNeeded = (type: DrawingType): 1 | 2 => (type === 'hline' || type === 'vline' ? 1 : 2)

/** The tools that make a drawing (the rest of the toolbar is the cursor, the note and the alert). */
export const DRAWING_TOOLS: DrawingType[] = ['trend', 'ray', 'hline', 'vline', 'rect', 'fib']

export const isDrawingTool = (tool: string): tool is DrawingType => (DRAWING_TOOLS as string[]).includes(tool)

export function makeDrawing(type: DrawingType, id: string, start: ChartPoint, end?: ChartPoint): Drawing {
  return { color: null, id, label: '', points: pointsNeeded(type) === 1 ? [start] : [start, end ?? start], type }
}

/** Bar times to a fractional chart position and back: a time between two bars is between their positions,
 *  and one past either end continues at the spacing of the last two bars. */
export function timeToLogical(times: readonly number[], time: number): number {
  const n = times.length

  if (n < 2) {
    return 0
  }

  if (time <= times[0]) {
    return (time - times[0]) / (times[1] - times[0] || 1)
  }

  if (time >= times[n - 1]) {
    return n - 1 + (time - times[n - 1]) / (times[n - 1] - times[n - 2] || 1)
  }

  let low = 0
  let high = n - 1

  while (high - low > 1) {
    const mid = (low + high) >> 1

    if (times[mid] <= time) {
      low = mid
    } else {
      high = mid
    }
  }

  return low + (time - times[low]) / (times[high] - times[low])
}

export function logicalToTime(times: readonly number[], logical: number): number {
  const n = times.length

  if (n < 2) {
    return times[0] ?? 0
  }

  if (logical <= 0) {
    return Math.round(times[0] + logical * (times[1] - times[0]))
  }

  if (logical >= n - 1) {
    return Math.round(times[n - 1] + (logical - (n - 1)) * (times[n - 1] - times[n - 2]))
  }

  const i = Math.floor(logical)

  return Math.round(times[i] + (logical - i) * (times[i + 1] - times[i]))
}

const at = (proj: Projector, point: ChartPoint): null | Pt => {
  const x = proj.x(point.time)
  const y = proj.y(point.price)

  return x === null || y === null ? null : { x, y }
}

/** Where a drawing is on screen, as handles, lines to stroke, a box to fill and Fibonacci levels. */
export function geometry(drawing: Drawing, proj: Projector, bounds: Bounds): Geometry | null {
  const a = at(proj, drawing.points[0])

  if (!a) {
    return null
  }

  if (drawing.type === 'hline') {
    return {
      handles: [a],
      segments: [
        [
          { x: 0, y: a.y },
          { x: bounds.width, y: a.y }
        ]
      ]
    }
  }

  if (drawing.type === 'vline') {
    return {
      handles: [a],
      segments: [
        [
          { x: a.x, y: 0 },
          { x: a.x, y: bounds.height }
        ]
      ]
    }
  }

  const b = drawing.points[1] ? at(proj, drawing.points[1]) : null

  if (!b) {
    return null
  }

  if (drawing.type === 'trend') {
    return { handles: [a, b], segments: [[a, b]] }
  }

  if (drawing.type === 'ray') {
    return { handles: [a, b], segments: [[a, extend(a, b, bounds)]] }
  }

  if (drawing.type === 'rect') {
    const box = { x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x), y1: Math.min(a.y, b.y), y2: Math.max(a.y, b.y) }

    return {
      fill: box,
      handles: [a, b],
      segments: [
        [
          { x: box.x1, y: box.y1 },
          { x: box.x2, y: box.y1 }
        ],
        [
          { x: box.x2, y: box.y1 },
          { x: box.x2, y: box.y2 }
        ],
        [
          { x: box.x2, y: box.y2 },
          { x: box.x1, y: box.y2 }
        ],
        [
          { x: box.x1, y: box.y2 },
          { x: box.x1, y: box.y1 }
        ]
      ]
    }
  }

  const [pa, pb] = drawing.points
  const x1 = Math.min(a.x, b.x)
  const x2 = Math.max(a.x, b.x)

  const levels = fibLevels(pa.price, pb.price).flatMap(level => {
    const y = proj.y(level.price)

    return y === null ? [] : [{ price: level.price, ratio: level.ratio, x1, x2, y }]
  })

  return { handles: [a, b], levels, segments: [[a, b]] }
}

/** The far end of the ray from `a` through `b`, where it leaves the plot. */
function extend(a: Pt, b: Pt, bounds: Bounds): Pt {
  const dx = b.x - a.x
  const dy = b.y - a.y

  if (dx === 0 && dy === 0) {
    return b
  }

  const reach = Math.max(bounds.width, bounds.height) * 20 + 1000
  const scale = reach / Math.hypot(dx, dy)

  return { x: a.x + dx * scale, y: a.y + dy * scale }
}

function distanceToSegment(p: Pt, [a, b]: [Pt, Pt]): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length))

  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** What the pointer at (x, y) is on, in one drawing: a handle first, then a line or the inside of a box. */
export function hitGeometry(shape: Geometry, x: number, y: number, withHandles: boolean): 'body' | null | number {
  const p = { x, y }

  if (withHandles) {
    const index = shape.handles.findIndex(handle => Math.hypot(handle.x - x, handle.y - y) <= HIT + 2)

    if (index >= 0) {
      return index
    }
  }

  if (shape.segments.some(segment => distanceToSegment(p, segment) <= HIT)) {
    return 'body'
  }

  const box = shape.fill

  if (box && x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2) {
    return 'body'
  }

  const onLevel = shape.levels?.some(
    level => x >= level.x1 - HIT && x <= level.x2 + HIT && Math.abs(y - level.y) <= HIT
  )

  return onLevel ? 'body' : null
}

/** The topmost drawing under the pointer; the selected one answers for its handles before anything else. */
export function hitDrawings(
  drawings: readonly Drawing[],
  selectedId: null | string,
  proj: Projector,
  bounds: Bounds,
  x: number,
  y: number
): Hit | null {
  const selected = drawings.find(drawing => drawing.id === selectedId)
  const shape = selected ? geometry(selected, proj, bounds) : null
  const onHandle = selected && shape ? hitGeometry(shape, x, y, true) : null

  if (selected && typeof onHandle === 'number') {
    return { id: selected.id, index: onHandle, part: 'handle' }
  }

  for (let i = drawings.length - 1; i >= 0; i--) {
    const found = geometry(drawings[i], proj, bounds)

    if (found && hitGeometry(found, x, y, false)) {
      return { id: drawings[i].id, part: 'body' }
    }
  }

  return null
}

/** A drawing with one of its points moved. */
export function withPoint(drawing: Drawing, index: number, point: ChartPoint): Drawing {
  return { ...drawing, points: drawing.points.map((existing, i) => (i === index ? point : existing)) }
}

/** A drawing shifted whole by the way the pointer moved from `from` to `to`. */
export function shifted(drawing: Drawing, from: ChartPoint, to: ChartPoint): Drawing {
  const dt = to.time - from.time
  const dp = to.price - from.price

  return {
    ...drawing,
    points: drawing.points.map(point => ({
      price: Math.max(point.price + dp, Number.MIN_VALUE),
      time: point.time + dt
    }))
  }
}
