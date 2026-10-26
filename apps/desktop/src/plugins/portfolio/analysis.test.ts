import { describe, expect, it } from 'vitest'

import type { Bar } from './market-feed'
import { seasonals } from './seasonals'
import { tally, technicals, verdictOf } from './technicals'

const bar = (i: number, close: number): Bar => ({
  close,
  high: close + 1,
  low: close - 1,
  open: close - 0.5,
  time: i * 86_400,
  volume: 1
})

describe('technicals', () => {
  it('reads a steady climb as a buy and a steady fall as a sell', () => {
    const up = technicals(Array.from({ length: 260 }, (_, i) => bar(i, 100 + i)))
    const down = technicals(Array.from({ length: 260 }, (_, i) => bar(i, 400 - i)))

    expect(up.averagesTally.buy).toBe(12)
    expect(up.summary.score).toBeGreaterThan(0.3)
    expect(down.averagesTally.sell).toBe(12)
    expect(down.summary.score).toBeLessThan(-0.3)
  })

  it('names the verdict from the score and counts every vote', () => {
    expect(verdictOf(-0.8)).toBe('strongSell')
    expect(verdictOf(-0.2)).toBe('sell')
    expect(verdictOf(0)).toBe('neutral')
    expect(verdictOf(0.3)).toBe('buy')
    expect(verdictOf(0.9)).toBe('strongBuy')

    const result = tally([
      { action: 'buy', name: 'a', value: 1 },
      { action: 'sell', name: 'b', value: 1 },
      { action: 'neutral', name: 'c', value: 1 },
      { action: 'buy', name: 'd', value: 1 }
    ])

    expect(result).toMatchObject({ buy: 2, neutral: 1, sell: 1, verdict: 'buy' })
  })

  it('has no opinion on too few bars', () => {
    expect(technicals([bar(0, 10)]).summary.verdict).toBe('neutral')
  })
})

describe('seasonals', () => {
  const month = (year: number, m: number, open: number, close: number): Bar => ({
    close,
    high: Math.max(open, close),
    low: Math.min(open, close),
    open,
    time: Date.UTC(year, m, 1) / 1000,
    volume: 1
  })

  it('reads each month of each year, then the average and how often it closed up', () => {
    const result = seasonals([
      month(2024, 0, 100, 110),
      month(2025, 0, 100, 90),
      month(2026, 0, 100, 130),
      month(2026, 1, 100, 95)
    ])

    expect(result.years.map(row => row.year)).toEqual([2026, 2025, 2024])
    expect(result.years[0].returns[0]).toBeCloseTo(30)
    expect(result.average[0]).toBeCloseTo(10)
    expect(result.hitRate[0]).toBeCloseTo(66.67, 1)
    expect(result.average[1]).toBeCloseTo(-5)
    expect(result.average[5]).toBeNull()
  })
})

describe('analysis data', () => {
  it('reads Binance futures rows into funding, open interest and who is long', async () => {
    const { parseDerivatives } = await import('./analysis-data')

    const d = parseDerivatives(
      { indexPrice: '100', lastFundingRate: '0.0001', markPrice: '100.5', nextFundingTime: 7_200_000 },
      [{ fundingRate: '0.0002', fundingTime: 3_600_000 }],
      [{ sumOpenInterestValue: '5000', timestamp: 3_600_000 }],
      [{ longAccount: '0.6', longShortRatio: '1.5', shortAccount: '0.4', timestamp: 3_600_000 }]
    )

    expect(d.basisPct).toBeCloseTo(0.5)
    expect(d.fundingRate).toBeCloseTo(0.01)
    expect(d.funding).toEqual([{ time: 3600, value: 0.02 }])
    expect(d.openInterest[0]).toEqual({ time: 3600, value: 5000 })
    expect(d.longShort[0]).toMatchObject({ long: 60, ratio: 1.5, short: 40 })
  })

  it('keeps only news with a link, and reads the Fear & Greed index', async () => {
    const { parseFearGreed, parseNews } = await import('./analysis-data')

    const news = parseNews({
      Data: [
        {
          body: 'x'.repeat(500),
          id: 1,
          published_on: 10,
          source_info: { name: 'Wire' },
          title: 'A',
          url: 'https://a.example/1'
        },
        { id: 2, title: 'No link', url: 'javascript:alert(1)' }
      ]
    })

    expect(news).toHaveLength(1)
    expect(news[0]).toMatchObject({ source: 'Wire', title: 'A' })
    expect(news[0].body).toHaveLength(220)
    expect(parseFearGreed({ data: [{ timestamp: '5', value: '25', value_classification: 'Fear' }] })).toEqual({
      history: [{ time: 5, value: 25 }],
      label: 'Fear',
      value: 25
    })
    expect(parseFearGreed({})).toBeNull()
  })
})
