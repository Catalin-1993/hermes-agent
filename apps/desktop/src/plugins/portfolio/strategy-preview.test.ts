/**
 * The chart's strategy signals are the backtest service's: on the same bars and settings, every strategy
 * (and the trend and ADX filters) wants to hold on exactly the same bars as `portfolio_service/signals.py`.
 * The fixture is that module's own output (regenerate it from there when a rule changes).
 */
import { describe, expect, it } from 'vitest'

import type { BacktestStrategy } from './api'
import { DEFAULT_EXECUTION } from './backtest-strategies'
import type { Bar } from './market-feed'
import fixture from './strategy-parity.fixture.json'
import { signalsOf, strategyLines, strategyWants } from './strategy-preview'

const bars: Bar[] = fixture.bars.map(([open, high, low, close], i) => ({
  close,
  high,
  low,
  open,
  time: i * 86_400,
  volume: 0
}))

const params = fixture.params as Record<string, Record<string, number>>

describe('strategy preview', () => {
  it.each(Object.keys(fixture.wants))('%s holds on the same bars as the service', strategy => {
    const wants = strategyWants(bars, strategy as BacktestStrategy, params[strategy], DEFAULT_EXECUTION)

    expect(wants).toEqual(fixture.wants[strategy as keyof typeof fixture.wants])
  })

  it('applies the trend filter and the ADX gate as the service does', () => {
    expect(strategyWants(bars, 'sma_cross', params.sma_cross, { ...DEFAULT_EXECUTION, trend_filter: 50 })).toEqual(
      fixture.trend
    )
    expect(strategyWants(bars, 'ema_cross', params.ema_cross, { ...DEFAULT_EXECUTION, adx_filter: 20 })).toEqual(
      fixture.adx
    )
  })

  it('marks a buy where holding starts and a sell where it ends', () => {
    const at = (i: number) => bars[i].time

    expect(signalsOf(bars.slice(0, 5), [false, true, true, false, true])).toEqual([
      { side: 'buy', time: at(1) },
      { side: 'sell', time: at(3) },
      { side: 'buy', time: at(4) }
    ])
  })

  it('draws the strategy lines on the price, and an oscillator in its own pane', () => {
    expect(strategyLines(bars, 'sma_cross', params.sma_cross, DEFAULT_EXECUTION).lines.map(l => l.label)).toEqual([
      'SMA 10',
      'SMA 30'
    ])
    const rsi = strategyLines(bars, 'rsi_revert', params.rsi_revert, DEFAULT_EXECUTION)
    expect(rsi.lines).toEqual([])
    expect(rsi.panes[0].bands).toEqual([35, 65])
  })
})
