/**
 * The chart studio's model: the indicators it offers (with their settings), the owner's saved chart of a
 * symbol (indicators, drawings, notes — kept by the backend, `core/charts.py`), and the draw plan: the
 * lines, panes and levels the chart paints for a set of bars. Pure, so it is tested.
 */

import { atr, bollinger, donchian, ema, macd, rsi, sma, stochastic, supertrend, swingLevels, vwap } from './indicators'
import type { Bar } from './market-feed'

export type IndicatorType =
  | 'atr'
  | 'bollinger'
  | 'donchian'
  | 'ema'
  | 'levels'
  | 'macd'
  | 'rsi'
  | 'sma'
  | 'stochastic'
  | 'supertrend'
  | 'volume'
  | 'vwap'

export interface Indicator {
  id: string
  type: IndicatorType
  params: Record<string, number>
  color: null | string
  hidden: boolean
}

export interface ChartPoint {
  time: number
  price: number
}

export interface Drawing {
  id: string
  type: 'fib' | 'hline' | 'ray' | 'rect' | 'trend' | 'vline'
  /** One point for a horizontal or vertical line, two for the rest. */
  points: ChartPoint[]
  label: string
  /** `#rrggbb`, or null for the default. */
  color?: null | string
}

/** Another symbol drawn over the chart, as percentages from the same start (TradingView's "Compare"). */
export interface CompareRef {
  kind: 'crypto' | 'stocks'
  symbol: string
  color: null | string
}

export interface ChartNote {
  id: string
  text: string
  at: ChartPoint | null
  created: number
}

export interface ChartDoc {
  indicators: Indicator[]
  drawings: Drawing[]
  notes: ChartNote[]
  compare: CompareRef[]
}

export interface LineSpec {
  id: string
  label: string
  color: string
  points: { time: number; value: number }[]
  dashed?: boolean
  /** Drawn as a histogram (MACD's bars) instead of a line. */
  histogram?: boolean
}

export interface PaneSpec {
  id: string
  label: string
  lines: LineSpec[]
  /** Horizontal guide values (RSI 30 / 70, MACD 0). */
  bands: number[]
}

export interface PriceLineSpec {
  price: number
  color: string
  title: string
  dashed?: boolean
}

export interface ParamSpec {
  name: string
  label: string
  default: number
  min: number
  max: number
  step: number
}

export interface CatalogEntry {
  label: string
  /** Where it draws: on the price, or in its own pane under it. */
  pane: boolean
  color: string
  params: ParamSpec[]
}

const period = (value: number, max = 400): ParamSpec => ({
  default: value,
  label: 'Perioada',
  max,
  min: 2,
  name: 'period',
  step: 1
})

export const CATALOG: Record<IndicatorType, CatalogEntry> = {
  atr: { color: '#f472b6', label: 'ATR (volatilitate)', pane: true, params: [period(14, 100)] },
  bollinger: {
    color: '#a78bfa',
    label: 'Benzi Bollinger',
    pane: false,
    params: [period(20, 200), { default: 2, label: 'Deviații', max: 4, min: 0.5, name: 'width', step: 0.1 }]
  },
  donchian: { color: '#22d3ee', label: 'Canal Donchian', pane: false, params: [period(20, 250)] },
  ema: { color: '#fbbf24', label: 'EMA (medie exponențială)', pane: false, params: [period(21)] },
  levels: {
    color: '#94a3b8',
    label: 'Suport și rezistență (automat)',
    pane: false,
    params: [
      { default: 5, label: 'Lățime vârf (bare)', max: 30, min: 2, name: 'width', step: 1 },
      { default: 6, label: 'Câte niveluri', max: 12, min: 1, name: 'count', step: 1 }
    ]
  },
  macd: {
    color: '#60a5fa',
    label: 'MACD',
    pane: true,
    params: [
      { default: 12, label: 'Rapid', max: 100, min: 2, name: 'fast', step: 1 },
      { default: 26, label: 'Lent', max: 200, min: 5, name: 'slow', step: 1 },
      { default: 9, label: 'Semnal', max: 50, min: 2, name: 'signal', step: 1 }
    ]
  },
  rsi: {
    color: '#a78bfa',
    label: 'RSI',
    pane: true,
    params: [
      period(14, 60),
      { default: 30, label: 'Supravândut', max: 50, min: 1, name: 'low', step: 1 },
      { default: 70, label: 'Supracumpărat', max: 99, min: 50, name: 'high', step: 1 }
    ]
  },
  sma: { color: '#60a5fa', label: 'MA (medie mobilă simplă)', pane: false, params: [period(50)] },
  stochastic: {
    color: '#34d399',
    label: 'Stochastic',
    pane: true,
    params: [
      period(14, 100),
      { default: 3, label: 'Netezire', max: 10, min: 1, name: 'smooth', step: 1 },
      { default: 3, label: '%D', max: 10, min: 1, name: 'signal', step: 1 }
    ]
  },
  supertrend: {
    color: '#34d399',
    label: 'SuperTrend',
    pane: false,
    params: [period(10, 100), { default: 3, label: 'Multiplicator ATR', max: 10, min: 0.5, name: 'factor', step: 0.1 }]
  },
  volume: { color: '#94a3b8', label: 'Volum', pane: false, params: [] },
  vwap: { color: '#fb923c', label: 'VWAP', pane: false, params: [] }
}

export const INDICATOR_ORDER: IndicatorType[] = [
  'sma',
  'ema',
  'bollinger',
  'supertrend',
  'donchian',
  'vwap',
  'levels',
  'volume',
  'rsi',
  'macd',
  'stochastic',
  'atr'
]

/** The indicator's settings, each held to its range (a missing one takes its default). */
export function paramsOf(indicator: Pick<Indicator, 'params' | 'type'>): Record<string, number> {
  return Object.fromEntries(
    CATALOG[indicator.type].params.map(spec => {
      const raw = indicator.params[spec.name]
      const value = Number.isFinite(raw) ? Math.min(Math.max(raw, spec.min), spec.max) : spec.default

      return [spec.name, value]
    })
  )
}

/** "EMA 21", "Benzi Bollinger 20 2": the short name the legend shows. */
export function shortName(indicator: Pick<Indicator, 'params' | 'type'>): string {
  const base = { bollinger: 'BB', donchian: 'Donchian', levels: 'S/R', supertrend: 'SuperTrend', volume: 'Vol' }[
    indicator.type as string
  ]

  const values = Object.values(paramsOf(indicator))

  return [base ?? indicator.type.toUpperCase(), ...values.map(v => String(v))].join(' ')
}

export function newIndicator(type: IndicatorType, id: string): Indicator {
  return { color: null, hidden: false, id, params: paramsOf({ params: {}, type }), type }
}

const series = (bars: Bar[], values: (null | number)[]) =>
  values.flatMap((value, i) => (value === null ? [] : [{ time: bars[i].time, value }]))

export interface Plan {
  lines: LineSpec[]
  panes: PaneSpec[]
  priceLines: PriceLineSpec[]
  volume: boolean
}

/** `key` is the indicator's own id (two EMAs never share a series); `label` is what the legend reads. */
type Painter = (bars: Bar[], p: Record<string, number>, color: string, label: string, plan: Plan, key: string) => void

const closes = (bars: Bar[]) => bars.map(bar => bar.close)

const PAINT: Record<IndicatorType, Painter> = {
  atr: (bars, p, color, label, plan, key) => {
    plan.panes.push({
      bands: [],
      id: key,
      label,
      lines: [{ color, id: key, label, points: series(bars, atr(bars, p.period)) }]
    })
  },
  bollinger: (bars, p, color, label, plan, key) => {
    const b = bollinger(closes(bars), p.period, p.width)
    plan.lines.push(
      { color, id: `${key}-u`, label, points: series(bars, b.upper) },
      { color, dashed: true, id: `${key}-m`, label, points: series(bars, b.mid) },
      { color, id: `${key}-l`, label, points: series(bars, b.lower) }
    )
  },
  donchian: (bars, p, color, label, plan, key) => {
    const d = donchian(bars, p.period)
    plan.lines.push(
      { color, id: `${key}-u`, label, points: series(bars, d.upper) },
      { color, id: `${key}-l`, label, points: series(bars, d.lower) }
    )
  },
  ema: (bars, p, color, label, plan, key) => {
    plan.lines.push({ color, id: key, label, points: series(bars, ema(closes(bars), p.period)) })
  },
  levels: (bars, p, _color, _label, plan) => {
    const last = bars[bars.length - 1]?.close ?? 0

    for (const level of swingLevels(bars, p.width, p.count)) {
      const tone = level.price >= last ? '#f87171' : '#34d399'
      plan.priceLines.push({
        color: tone,
        dashed: true,
        price: level.price,
        title: `${level.price >= last ? 'R' : 'S'} ×${level.touches}`
      })
    }
  },
  macd: (bars, p, color, label, plan, key) => {
    const m = macd(closes(bars), p.fast, p.slow, p.signal)
    plan.panes.push({
      bands: [0],
      id: key,
      label,
      lines: [
        { color: '#94a3b8', histogram: true, id: `${key}-h`, label: 'Histogramă', points: series(bars, m.histogram) },
        { color, id: `${key}-l`, label: 'MACD', points: series(bars, m.line) },
        { color: '#fb923c', id: `${key}-s`, label: 'Semnal', points: series(bars, m.signal) }
      ]
    })
  },
  rsi: (bars, p, color, label, plan, key) => {
    plan.panes.push({
      bands: [p.low, p.high],
      id: key,
      label,
      lines: [{ color, id: key, label, points: series(bars, rsi(closes(bars), p.period)) }]
    })
  },
  sma: (bars, p, color, label, plan, key) => {
    plan.lines.push({ color, id: key, label, points: series(bars, sma(closes(bars), p.period)) })
  },
  stochastic: (bars, p, color, label, plan, key) => {
    const s = stochastic(bars, p.period, p.smooth, p.signal)
    plan.panes.push({
      bands: [20, 80],
      id: key,
      label,
      lines: [
        { color, id: `${key}-k`, label: '%K', points: series(bars, s.k) },
        { color: '#fb923c', id: `${key}-d`, label: '%D', points: series(bars, s.d) }
      ]
    })
  },
  supertrend: (bars, p, color, label, plan, key) => {
    plan.lines.push({ color, id: key, label, points: series(bars, supertrend(bars, p.period, p.factor).line) })
  },
  volume: (_bars, _p, _color, _label, plan) => {
    plan.volume = true
  },
  vwap: (bars, _p, color, label, plan, key) => {
    plan.lines.push({ color, id: key, label, points: series(bars, vwap(bars)) })
  }
}

/** Everything the visible indicators put on the chart for these bars. The drawings are painted by the
 *  chart's own drawing layer (`drawing-primitive.ts`), where they can be selected and moved. */
export function planFor(bars: Bar[], doc: Pick<ChartDoc, 'indicators'>): Plan {
  const plan: Plan = { lines: [], panes: [], priceLines: [], volume: false }

  if (!bars.length) {
    return plan
  }

  for (const indicator of doc.indicators.filter(item => !item.hidden)) {
    const entry = CATALOG[indicator.type]
    PAINT[indicator.type](
      bars,
      paramsOf(indicator),
      indicator.color ?? entry.color,
      shortName(indicator),
      plan,
      indicator.id
    )
  }

  return plan
}
