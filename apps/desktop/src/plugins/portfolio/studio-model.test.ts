import { describe, expect, it } from 'vitest'

import { pctFromClick } from './backtest-workspace'
import type { Bar } from './market-feed'
import { newIndicator, paramsOf, planFor, shortName } from './studio-model'

const bars: Bar[] = Array.from({ length: 60 }, (_, i) => ({
  close: 100 + i,
  high: 101 + i,
  low: 99 + i,
  open: 100 + i,
  time: i * 86_400,
  volume: 10
}))

describe('chart studio plan', () => {
  it('puts averages on the price, oscillators in panes, and volume under the candles', () => {
    const plan = planFor(bars, {
      indicators: [
        newIndicator('ema', 'a'),
        newIndicator('rsi', 'b'),
        newIndicator('macd', 'c'),
        newIndicator('volume', 'd')
      ]
    })

    expect(plan.lines.map(line => line.id)).toEqual(['a'])
    expect(plan.panes.map(pane => pane.id)).toEqual(['b', 'c'])
    expect(plan.panes[1].lines.find(line => line.histogram)).toBeTruthy()
    expect(plan.volume).toBe(true)
  })

  it('leaves hidden indicators out of the plan', () => {
    const plan = planFor(bars, {
      indicators: [{ ...newIndicator('sma', 'x'), hidden: true }, newIndicator('ema', 'y')]
    })

    expect(plan.lines.map(line => line.id)).toEqual(['y'])
  })

  it('holds settings to their range and names an indicator by them', () => {
    expect(paramsOf({ params: { period: 9999 }, type: 'ema' })).toEqual({ period: 400 })
    expect(shortName(newIndicator('bollinger', 'z'))).toBe('BB 20 2')
  })

  it('reads a stop or a target clicked on the chart as a percentage of the last price', () => {
    expect(pctFromClick('stop', 90, 100)).toBe(10)
    expect(pctFromClick('target', 125, 100)).toBe(25)
    expect(pctFromClick('stop', 110, 100)).toBe(0.5) // a stop above the price is the smallest one
  })
})
