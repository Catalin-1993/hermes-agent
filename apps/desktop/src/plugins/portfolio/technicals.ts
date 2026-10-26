/**
 * The technical read of a chart, TradingView's "Technicals": each oscillator and each moving average votes
 * buy, neutral or sell on the last bar, and the votes are summed into a score from −1 to 1 that the gauges
 * show. Computed from the bars on screen, with the same indicators the chart draws. Pure, so it is tested.
 */

import { ema, macd, rsi, type Series, sma, stochastic } from './indicators'
import type { Bar } from './market-feed'

export type Action = 'buy' | 'neutral' | 'sell'

export type Verdict = 'buy' | 'neutral' | 'sell' | 'strongBuy' | 'strongSell'

export interface Signal {
  action: Action
  name: string
  value: null | number
}

export interface Tally {
  buy: number
  neutral: number
  sell: number
  /** (buys − sells) / votes, from −1 (all sell) to 1 (all buy). */
  score: number
  verdict: Verdict
}

export interface Technicals {
  averages: Signal[]
  oscillators: Signal[]
  summary: Tally
  averagesTally: Tally
  oscillatorsTally: Tally
}

const last = (series: Series): null | number => {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] !== null) {
      return series[i]
    }
  }

  return null
}

export function verdictOf(score: number): Verdict {
  if (score <= -0.5) {
    return 'strongSell'
  }

  if (score < -0.1) {
    return 'sell'
  }

  if (score < 0.1) {
    return 'neutral'
  }

  return score < 0.5 ? 'buy' : 'strongBuy'
}

export function tally(signals: Signal[]): Tally {
  const count = (action: Action) => signals.filter(signal => signal.action === action).length
  const [buy, neutral, sell] = [count('buy'), count('neutral'), count('sell')]
  const score = signals.length ? (buy - sell) / signals.length : 0

  return { buy, neutral, score, sell, verdict: verdictOf(score) }
}

const vote = (value: null | number, buyBelow: number, sellAbove: number): Action =>
  value === null ? 'neutral' : value < buyBelow ? 'buy' : value > sellAbove ? 'sell' : 'neutral'

/** Commodity Channel Index: how far the typical price is from its average, in mean deviations. */
function cci(bars: Bar[], period: number): null | number {
  if (bars.length < period) {
    return null
  }

  const typical = bars.slice(-period).map(bar => (bar.high + bar.low + bar.close) / 3)
  const mean = typical.reduce((a, b) => a + b, 0) / period
  const deviation = typical.reduce((a, b) => a + Math.abs(b - mean), 0) / period

  return deviation === 0 ? 0 : (typical[period - 1] - mean) / (0.015 * deviation)
}

export const AVERAGE_PERIODS = [10, 20, 30, 50, 100, 200]

export function technicals(bars: Bar[]): Technicals {
  const closes = bars.map(bar => bar.close)
  const close = closes[closes.length - 1] ?? 0
  const oscillators: Signal[] = []

  const rsiNow = last(rsi(closes, 14))
  oscillators.push({ action: vote(rsiNow, 30, 70), name: 'RSI (14)', value: rsiNow })

  const kNow = last(stochastic(bars, 14, 3, 3).k)
  oscillators.push({ action: vote(kNow, 20, 80), name: 'Stochastic %K (14, 3, 3)', value: kNow })

  const cciNow = cci(bars, 20)
  oscillators.push({ action: vote(cciNow, -100, 100), name: 'CCI (20)', value: cciNow })

  const m = macd(closes, 12, 26, 9)
  const line = last(m.line)
  const signal = last(m.signal)

  oscillators.push({
    action: line === null || signal === null ? 'neutral' : line > signal ? 'buy' : line < signal ? 'sell' : 'neutral',
    name: 'MACD (12, 26)',
    value: line
  })

  const momentum = closes.length > 10 ? close - closes[closes.length - 11] : null

  oscillators.push({
    action: momentum === null ? 'neutral' : momentum > 0 ? 'buy' : momentum < 0 ? 'sell' : 'neutral',
    name: 'Momentum (10)',
    value: momentum
  })

  const averages: Signal[] = AVERAGE_PERIODS.flatMap(period =>
    [
      { name: `EMA (${period})`, value: last(ema(closes, period)) },
      { name: `SMA (${period})`, value: last(sma(closes, period)) }
    ].map(({ name, value }): Signal => ({
      action: value === null ? 'neutral' : close > value ? 'buy' : close < value ? 'sell' : 'neutral',
      name,
      value
    }))
  )

  return {
    averages,
    averagesTally: tally(averages),
    oscillators,
    oscillatorsTally: tally(oscillators),
    summary: tally([...oscillators, ...averages])
  }
}
