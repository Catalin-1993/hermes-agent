import { describe, expect, it } from 'vitest'

import { pctFromClick } from './backtest-workspace'
import type { Bar } from './market-feed'
import { newIndicator, paramsOf, planFor, shortName } from './studio-model'

const bars: Bar[] = Array.from({ length: 60 }, (_, i) => ({ close: 100 + i, high: 101 + i, low: 99 + i, open: 100 + i, time: i * 86_400, volume: 10 }))

describe('chart studio plan', () => {
  it('puts averages on the price, oscillators in panes, and volume under the candles', () => {
    const plan = planFor(bars, {
      drawings: [],
      indicators: [newIndicator('ema', 'a'), newIndicator('rsi', 'b'), newIndicator('macd', 'c'), newIndicator('volume', 'd')]
    })

    expect(plan.lines.map(line => line.id)).toEqual(['a'])
    expect(plan.panes.map(pane => pane.id)).toEqual(['b', 'c'])
    expect(plan.panes[1].lines.find(line => line.histogram)).toBeTruthy()
    expect(plan.volume).toBe(true)
  })

  it('leaves hidden indicators out and turns drawings into levels and lines', () => {
    const plan = planFor(bars, {
      drawings: [
        { id: 'f', label: '', points: [{ price: 100, time: 0 }, { price: 200, time: 86_400 }], type: 'fib' },
        { id: 't', label: '', points: [{ price: 150, time: 5 * 86_400 }, { price: 120, time: 86_400 }], type: 'trend' },
        { id: 'h', label: 'Suport', points: [{ price: 110, time: 0 }], type: 'hline' }
      ],
      indicators: [{ ...newIndicator('sma', 'x'), hidden: true }]
    })

    expect(plan.lines.map(line => line.id)).toEqual(['t'])
    expect(plan.lines[0].points[0]).toEqual({ time: 86_400, value: 120 })  // ordered in time
    expect(plan.priceLines.filter(level => level.title.startsWith('Fib'))).toHaveLength(8)
    expect(plan.priceLines.find(level => level.title === 'Suport')?.price).toBe(110)
  })

  it('holds settings to their range and names an indicator by them', () => {
    expect(paramsOf({ params: { period: 9999 }, type: 'ema' })).toEqual({ period: 400 })
    expect(shortName(newIndicator('bollinger', 'z'))).toBe('BB 20 2')
  })

  it('reads a stop or a target clicked on the chart as a percentage of the last price', () => {
    expect(pctFromClick('stop', 90, 100)).toBe(10)
    expect(pctFromClick('target', 125, 100)).toBe(25)
    expect(pctFromClick('stop', 110, 100)).toBe(0.5)  // a stop above the price is the smallest one
  })
})
