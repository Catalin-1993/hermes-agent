import { describe, expect, it } from 'vitest'

import { isGain, lastDays } from './series'

const points = ['2026-10-01', '2026-10-10', '2026-10-18', '2026-10-20'].map((date, index) => ({
  date,
  value: 100 + index
}))

describe('portfolio chart series', () => {
  it('counts a period back from the newest point, not from today', () => {
    expect(lastDays(points, 7).map(point => point.date)).toEqual(['2026-10-18', '2026-10-20'])
    expect(lastDays(points, 30)).toHaveLength(4)
  })

  it('keeps everything for the whole period', () => {
    expect(lastDays(points, Infinity)).toEqual(points)
  })

  it('reads a series as a gain or a loss by its two ends', () => {
    expect(isGain(points)).toBe(true)
    expect(isGain([...points].reverse())).toBe(false)
  })
})
