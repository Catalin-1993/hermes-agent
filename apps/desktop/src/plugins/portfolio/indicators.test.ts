import { describe, expect, it } from 'vitest'

import { bollinger, ema, fibLevels, rsi, sma, swingLevels, vwap, weekly } from './indicators'
import type { Bar } from './market-feed'

const bar = (time: number, close: number, extra: Partial<Bar> = {}): Bar => ({ close, high: close, low: close, open: close, time, volume: 1, ...extra })

describe('indicators', () => {
  it('averages: simple over a window, exponential seeded with the simple one', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
    expect(ema([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
  })

  it('RSI is 100 on a run of gains and the bands sit around the average', () => {
    expect(rsi([1, 2, 3, 4, 5], 3).slice(3)).toEqual([100, 100])
    const bands = bollinger([2, 2, 2], 3, 2)
    expect([bands.lower[2], bands.mid[2], bands.upper[2]]).toEqual([2, 2, 2])
  })

  it('finds a support touched twice and a resistance touched once', () => {
    const closes = [10, 9, 8, 9, 10, 12, 10, 9, 8, 9, 10]
    const levels = swingLevels(closes.map((close, i) => bar(i, close)), 2, 3)

    expect(levels[0]).toEqual({ price: 8, touches: 2 })
    expect(levels.map(level => level.price)).toContain(12)
  })

  it('Fibonacci runs 0 at the end of the move, 1 back at its start', () => {
    const levels = fibLevels(100, 200)

    expect(levels.find(level => level.ratio === 0)?.price).toBe(200)
    expect(levels.find(level => level.ratio === 0.5)?.price).toBe(150)
    expect(levels.find(level => level.ratio === 1)?.price).toBe(100)
  })

  it('VWAP restarts each day on intraday bars; weekly bars join a week, stamped with its first day', () => {
    const hourly = [bar(0, 10, { volume: 1 }), bar(3600, 20, { volume: 3 }), bar(86_400, 30, { volume: 1 })]
    expect(vwap(hourly)).toEqual([10, 17.5, 30])

    const monday = Date.UTC(2026, 9, 19) / 1000
    const days = [0, 1, 2, 7].map(d => bar(monday + d * 86_400, 10 + d, { high: 20 + d, low: 5 - d }))
    const weeks = weekly(days)
    expect(weeks.map(w => [w.time, w.close, w.high, w.low])).toEqual([
      [monday, 12, 22, 3],
      [monday + 7 * 86_400, 17, 27, -2]
    ])
  })
})
