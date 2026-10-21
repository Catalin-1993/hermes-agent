/** The chart's data, cut and shaped — pure, so the component only draws. */

export interface ValuePoint {
  date: string
  value: number
}

export interface Candle {
  close: number
  date: string
  high: number
  low: number
  open: number
}

export type Range = '1m' | '1w' | '3m' | 'all'

export const RANGE_DAYS: Record<Range, number> = { '1m': 30, '1w': 7, '3m': 90, all: Infinity }

/** The last `days` calendar days of a dated series, counted back from its newest point. */
export function lastDays<T extends { date: string }>(points: readonly T[], days: number): T[] {
  if (!points.length || !Number.isFinite(days)) {
    return [...points]
  }

  const newest = Date.parse(points[points.length - 1].date)
  const cutoff = newest - days * 86_400_000

  return points.filter(point => Date.parse(point.date) >= cutoff)
}

/** Whether a series ends above where it began: green for a gain, red for a loss. */
export const isGain = (points: readonly ValuePoint[]) =>
  points.length < 2 || points[points.length - 1].value >= points[0].value
