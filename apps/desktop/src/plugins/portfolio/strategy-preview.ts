/**
 * What a backtest strategy reads on the chart, before it runs: its own lines (the averages it crosses,
 * the bands it trades, the channel it breaks) and where it would buy and sell on these bars. The rules
 * are the backtest service's (`portfolio_service/signals.py`), line for line, including the trend and
 * ADX filters — so the arrows are the strategy's signals. Stops and take-profits are not simulated here:
 * the run itself is the engine.
 */

import type { BacktestExecution, BacktestStrategy } from './api'
import { bollinger, donchian, ema, macd, rsi, sma, supertrend } from './indicators'
import type { Bar } from './market-feed'
import type { LineSpec, PaneSpec } from './studio-model'

type Params = Record<string, number>

const closes = (bars: Bar[]) => bars.map(bar => bar.close)

const crossWants = (a: (null | number)[], b: (null | number)[]) =>
  a.map((x, i) => x !== null && b[i] !== null && x > (b[i] as number))

function rsiWants(bars: Bar[], p: Params): boolean[] {
  let holding = false

  return rsi(closes(bars), p.period).map(value => {
    if (value !== null) {
      holding = value < p.low ? true : value > p.high ? false : holding
    }

    return holding
  })
}

function breakoutWants(bars: Bar[], p: Params): boolean[] {
  let holding = false

  return bars.map((bar, i) => {
    if (i >= p.entry && !holding && bar.close > Math.max(...bars.slice(i - p.entry, i).map(b => b.high))) {
      holding = true
    } else if (i >= p.exit && holding && bar.close < Math.min(...bars.slice(i - p.exit, i).map(b => b.low))) {
      holding = false
    }

    return holding
  })
}

function bollingerWants(bars: Bar[], p: Params): boolean[] {
  const bands = bollinger(closes(bars), p.period, p.width)
  let holding = false

  return bars.map((bar, i) => {
    const mid = bands.mid[i]

    if (mid !== null) {
      if (!holding && bar.close < (bands.lower[i] as number)) {
        holding = true
      } else if (holding && bar.close > mid) {
        holding = false
      }
    }

    return holding
  })
}

function macdWants(bars: Bar[], p: Params): boolean[] {
  const { line, signal } = macd(closes(bars), p.fast, p.slow, p.signal)

  return line.map((value, i) => value !== null && signal[i] !== null && value > (signal[i] as number))
}

const WANTS: Record<BacktestStrategy, (bars: Bar[], p: Params) => boolean[]> = {
  bollinger: bollingerWants,
  breakout: breakoutWants,
  buy_hold: bars => bars.map(() => true),
  ema_cross: (bars, p) => crossWants(ema(closes(bars), p.fast), ema(closes(bars), p.slow)),
  macd: macdWants,
  rsi_revert: rsiWants,
  sma_cross: (bars, p) => crossWants(sma(closes(bars), p.fast), sma(closes(bars), p.slow)),
  supertrend: (bars, p) => supertrend(bars, p.period, p.factor).up.map(Boolean)
}

/** The service's clean_params: fast below slow for the crossing strategies. */
function cleaned(strategy: BacktestStrategy, params: Params): Params {
  const out = { ...params }

  if (['ema_cross', 'macd', 'sma_cross'].includes(strategy) && out.fast >= out.slow) {
    out.fast = Math.max(2, Math.floor(out.slow / 4))
  }

  return out
}

/** Wilder's ADX, as the service's ADX gate reads it. */
export function adx(bars: Bar[], period = 14): (null | number)[] {
  const out: (null | number)[] = new Array(bars.length).fill(null)
  const dxs: number[] = []
  let tr = 0
  let plus = 0
  let minus = 0
  let current = 0

  for (let i = 1; i < bars.length; i += 1) {
    const up = bars[i].high - bars[i - 1].high
    const down = bars[i - 1].low - bars[i].low
    const p = up > down && up > 0 ? up : 0
    const m = down > up && down > 0 ? down : 0

    const range = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close))

    ;[tr, plus, minus] = i <= period ? [tr + range, plus + p, minus + m] : [tr - tr / period + range, plus - plus / period + p, minus - minus / period + m]

    if (i < period || tr === 0) {
      continue
    }

    const pdi = (100 * plus) / tr
    const mdi = (100 * minus) / tr
    const dx = pdi + mdi === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / (pdi + mdi)

    if (dxs.length < period) {
      dxs.push(dx)

      if (dxs.length === period) {
        current = dxs.reduce((a, b) => a + b, 0) / period
        out[i] = current
      }
    } else {
      current = (current * (period - 1) + dx) / period
      out[i] = current
    }
  }

  return out
}

/** When the strategy wants to hold, bar by bar, after the trend and ADX filters. */
export function strategyWants(bars: Bar[], strategy: BacktestStrategy, params: Params, execution: BacktestExecution): boolean[] {
  let wants = WANTS[strategy](bars, cleaned(strategy, params))

  if (execution.trend_filter > 0) {
    const average = sma(closes(bars), execution.trend_filter)
    wants = wants.map((want, i) => want && average[i] !== null && bars[i].close > (average[i] as number))
  }

  if (execution.adx_filter > 0) {
    const strength = adx(bars)
    let holding = false
    wants = wants.map((want, i) => {
      holding = !want ? false : holding || (strength[i] !== null && (strength[i] as number) >= execution.adx_filter)

      return holding
    })
  }

  return wants
}

export interface Signal {
  side: 'buy' | 'sell'
  time: number
}

/** Each change of mind: a buy where holding starts, a sell where it ends. */
export function signalsOf(bars: Bar[], wants: boolean[]): Signal[] {
  return wants.flatMap((want, i) =>
    want === (i > 0 && wants[i - 1]) ? [] : [{ side: want ? ('buy' as const) : ('sell' as const), time: bars[i].time }]
  )
}

const line = (id: string, label: string, color: string, bars: Bar[], values: (null | number)[], dashed = false): LineSpec => ({
  color,
  dashed,
  id,
  label,
  points: values.flatMap((value, i) => (value === null ? [] : [{ time: bars[i].time, value }]))
})

/** The strategy's own lines on the price, and its oscillator pane when it has one. */
export function strategyLines(bars: Bar[], strategy: BacktestStrategy, raw: Params, execution: BacktestExecution): { lines: LineSpec[]; panes: PaneSpec[] } {
  const p = cleaned(strategy, raw)
  const c = closes(bars)
  const lines: LineSpec[] = []
  const panes: PaneSpec[] = []

  const add = { bollinger: () => {
    const b = bollinger(c, p.period, p.width)
    lines.push(line('bb-up', `BB ${p.period} sus`, '#a78bfa', bars, b.upper), line('bb-mid', `BB ${p.period}`, '#a78bfa', bars, b.mid, true), line('bb-low', `BB ${p.period} jos`, '#a78bfa', bars, b.lower))
  }, breakout: () => {
    lines.push(line('dc-up', `Maxim ${p.entry}`, '#34d399', bars, donchian(bars, p.entry).upper), line('dc-low', `Minim ${p.exit}`, '#f87171', bars, donchian(bars, p.exit).lower))
  }, buy_hold: () => undefined, ema_cross: () => {
    lines.push(line('ema-f', `EMA ${p.fast}`, '#fbbf24', bars, ema(c, p.fast)), line('ema-s', `EMA ${p.slow}`, '#60a5fa', bars, ema(c, p.slow)))
  }, macd: () => {
    const m = macd(c, p.fast, p.slow, p.signal)
    panes.push({ bands: [0], id: 'macd', label: `MACD ${p.fast} ${p.slow} ${p.signal}`, lines: [line('macd', 'MACD', '#60a5fa', bars, m.line), line('macd-s', 'Semnal', '#fb923c', bars, m.signal)] })
  }, rsi_revert: () => {
    panes.push({ bands: [p.low, p.high], id: 'rsi', label: `RSI ${p.period}`, lines: [line('rsi', `RSI ${p.period}`, '#a78bfa', bars, rsi(c, p.period))] })
  }, sma_cross: () => {
    lines.push(line('sma-f', `SMA ${p.fast}`, '#fbbf24', bars, sma(c, p.fast)), line('sma-s', `SMA ${p.slow}`, '#60a5fa', bars, sma(c, p.slow)))
  }, supertrend: () => {
    lines.push(line('st', `SuperTrend ${p.period} ${p.factor}`, '#34d399', bars, supertrend(bars, p.period, p.factor).line))
  } } satisfies Record<BacktestStrategy, () => void>

  add[strategy]()

  if (execution.trend_filter > 0) {
    lines.push(line('trend', `Filtru ${execution.trend_filter}`, '#94a3b8', bars, sma(c, execution.trend_filter), true))
  }

  return { lines, panes }
}

