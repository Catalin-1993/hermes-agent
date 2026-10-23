/**
 * Chart indicators, computed on the bars the chart shows. Each returns one value per bar, `null` while
 * its window is still filling. The averages, RSI, ATR and SuperTrend follow the backtest service's own
 * definitions (`portfolio_service/signals.py`: EMA seeded with the simple average, Wilder smoothing), so a
 * line on the chart is the line the strategy reads.
 */

import type { Bar } from './market-feed'

export type Series = (null | number)[]

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null)
  let sum = 0

  values.forEach((value, i) => {
    sum += value

    if (i >= period) {
      sum -= values[i - period]
    }

    if (i >= period - 1) {
      out[i] = sum / period
    }
  })

  return out
}

/** Exponential average seeded with the simple average of the first `period` values. */
export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null)

  if (values.length < period) {
    return out
  }

  const alpha = 2 / (period + 1)
  let current = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period - 1] = current

  for (let i = period; i < values.length; i += 1) {
    current = alpha * values[i] + (1 - alpha) * current
    out[i] = current
  }

  return out
}

/** Wilder's RSI, 0–100. */
export function rsi(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null)
  let gain = 0
  let loss = 0

  for (let i = 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1]
    const up = Math.max(change, 0)
    const down = Math.max(-change, 0)

    if (i <= period) {
      gain += up / period
      loss += down / period
    } else {
      gain = (gain * (period - 1) + up) / period
      loss = (loss * (period - 1) + down) / period
    }

    if (i >= period) {
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
    }
  }

  return out
}

export function macd(values: number[], fast: number, slow: number, signal: number) {
  const a = ema(values, fast)
  const b = ema(values, slow)
  const line: Series = a.map((x, i) => (x === null || b[i] === null ? null : x - (b[i] as number)))
  const start = line.findIndex(value => value !== null)
  const trigger: Series = new Array(values.length).fill(null)

  if (start >= 0) {
    ema(line.slice(start) as number[], signal).forEach((value, i) => (trigger[start + i] = value))
  }

  const histogram: Series = line.map((value, i) => (value === null || trigger[i] === null ? null : value - (trigger[i] as number)))

  return { histogram, line, signal: trigger }
}

export function bollinger(values: number[], period: number, width: number) {
  const mid = sma(values, period)

  const deviation = mid.map((mean, i) => {
    if (mean === null) {
      return null
    }

    const window = values.slice(i + 1 - period, i + 1)

    return Math.sqrt(window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period)
  })

  return {
    lower: mid.map((mean, i) => (mean === null ? null : mean - width * (deviation[i] as number))),
    mid,
    upper: mid.map((mean, i) => (mean === null ? null : mean + width * (deviation[i] as number)))
  }
}

const trueRange = (bars: Bar[], i: number) =>
  i === 0
    ? bars[0].high - bars[0].low
    : Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close))

/** Wilder's average true range. */
export function atr(bars: Bar[], period: number): Series {
  const out: Series = new Array(bars.length).fill(null)
  let current = 0

  for (let i = 1; i < bars.length; i += 1) {
    const range = trueRange(bars, i)

    if (i <= period) {
      current += range / period

      if (i === period) {
        out[i] = current
      }
    } else {
      current = (current * (period - 1) + range) / period
      out[i] = current
    }
  }

  return out
}

/** SuperTrend: the line under the price while it points up, over it while down. */
export function supertrend(bars: Bar[], period: number, factor: number) {
  const ranges = atr(bars, period)
  const line: Series = new Array(bars.length).fill(null)
  const up: (boolean | null)[] = new Array(bars.length).fill(null)
  let upper: null | number = null
  let lower: null | number = null
  let trend = false

  bars.forEach((bar, i) => {
    const range = ranges[i]

    if (range === null) {
      return
    }

    const middle = (bar.high + bar.low) / 2
    const previous = bars[i - 1].close
    const basicUpper = middle + factor * range
    const basicLower = middle - factor * range

    if (upper !== null && bar.close > upper) {
      trend = true
    } else if (lower !== null && bar.close < lower) {
      trend = false
    }

    upper = upper === null || basicUpper < upper || previous > upper ? basicUpper : upper
    lower = lower === null || basicLower > lower || previous < lower ? basicLower : lower
    line[i] = trend ? lower : upper
    up[i] = trend
  })

  return { line, up }
}

/** Donchian channel: the highest high and lowest low of the previous `period` bars. */
export function donchian(bars: Bar[], period: number) {
  const upper: Series = bars.map((_, i) => (i < period ? null : Math.max(...bars.slice(i - period, i).map(b => b.high))))
  const lower: Series = bars.map((_, i) => (i < period ? null : Math.min(...bars.slice(i - period, i).map(b => b.low))))

  return { lower, upper }
}

/** Volume-weighted average price: per day on intraday bars, from the first bar on daily ones. */
export function vwap(bars: Bar[]): Series {
  const intraday = bars.length > 1 && bars[1].time - bars[0].time < 86_400
  let day = -1
  let volume = 0
  let value = 0

  return bars.map(bar => {
    const today = Math.floor(bar.time / 86_400)

    if (intraday && today !== day) {
      day = today
      volume = 0
      value = 0
    }

    volume += bar.volume
    value += ((bar.high + bar.low + bar.close) / 3) * bar.volume

    return volume > 0 ? value / volume : null
  })
}

/** Stochastic oscillator: %K (smoothed) and its average %D, 0–100. */
export function stochastic(bars: Bar[], period: number, smooth: number, signal: number) {
  const raw = bars.map((bar, i) => {
    if (i + 1 < period) {
      return null
    }

    const window = bars.slice(i + 1 - period, i + 1)
    const high = Math.max(...window.map(b => b.high))
    const low = Math.min(...window.map(b => b.low))

    return high === low ? 50 : ((bar.close - low) / (high - low)) * 100
  })

  const smoothed = averageDefined(raw, smooth)

  return { d: averageDefined(smoothed, signal), k: smoothed }
}

function averageDefined(values: Series, period: number): Series {
  const start = values.findIndex(value => value !== null)
  const out: Series = new Array(values.length).fill(null)

  if (start >= 0) {
    sma(values.slice(start) as number[], period).forEach((value, i) => (out[start + i] = value))
  }

  return out
}

export interface Level {
  price: number
  touches: number
}

/** Support and resistance: swing highs and lows (a bar's extreme beyond `width` bars each side), grouped
 *  when closer than `tolerance` (a share of the price), strongest — most touched, then most recent — first. */
export function swingLevels(bars: Bar[], width: number, count: number, tolerance = 0.015): Level[] {
  const pivots: { at: number; price: number }[] = []

  for (let i = width; i < bars.length - width; i += 1) {
    const around = bars.slice(i - width, i + width + 1)

    if (around.every(bar => bar.high <= bars[i].high)) {
      pivots.push({ at: i, price: bars[i].high })
    }

    if (around.every(bar => bar.low >= bars[i].low)) {
      pivots.push({ at: i, price: bars[i].low })
    }
  }

  const groups: { at: number; prices: number[] }[] = []

  for (const pivot of pivots) {
    const near = groups.find(group => Math.abs(group.prices[0] - pivot.price) / pivot.price <= tolerance)

    if (near) {
      near.prices.push(pivot.price)
      near.at = Math.max(near.at, pivot.at)
    } else {
      groups.push({ at: pivot.at, prices: [pivot.price] })
    }
  }

  return groups
    .sort((a, b) => b.prices.length - a.prices.length || b.at - a.at)
    .slice(0, count)
    .map(group => ({ price: group.prices.reduce((a, b) => a + b, 0) / group.prices.length, touches: group.prices.length }))
}

export const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618]

/** Fibonacci retracement from the move `from` → `to`: 0 at `to`, 1 back at `from`, 1.618 beyond it. */
export const fibLevels = (from: number, to: number) => FIB_RATIOS.map(ratio => ({ price: to + (from - to) * ratio, ratio }))

/** Daily bars as ISO-week bars stamped with each week's first day (the service's `weekly`). */
export function weekly(bars: Bar[]): Bar[] {
  const weeks = new Map<string, Bar>()

  for (const bar of bars) {
    const key = isoWeek(new Date(bar.time * 1000))
    const week = weeks.get(key)

    if (week) {
      week.high = Math.max(week.high, bar.high)
      week.low = Math.min(week.low, bar.low)
      week.close = bar.close
      week.volume += bar.volume
    } else {
      weeks.set(key, { ...bar })
    }
  }

  return [...weeks.values()]
}

function isoWeek(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1)

  return `${day.getUTCFullYear()}-${Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7)}`
}
