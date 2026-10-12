/**
 * The ```chart fence: a chart described as data, drawn natively by the app (ECharts) instead of as HTML
 * the model writes. The agent says WHAT to show; the app owns how it looks — so every chart in the chat
 * shares one design line, follows the theme, resizes with the window and is interactive (tooltips,
 * legend toggling, zoom on long series).
 *
 * The format is forgiving where models drift (`x`/`labels` for categories, a single `data` array for one
 * series, `items` for slices) and strict about everything else: unknown kinds, ragged series or an
 * oversized payload are refused with a reason, and the fence then shows as code.
 */

export const CHART_KINDS = ['bar', 'line', 'area', 'donut', 'pie', 'scatter', 'kpi', 'table'] as const

export type ChartKind = (typeof CHART_KINDS)[number]

export type ChartFormat = 'compact' | 'currency' | 'number' | 'percent'

export interface ChartSeries {
  /** Category charts: one value per category. Scatter: [x, y] points. */
  data: (number | null)[] | [number, number][]
  name: string
}

export interface ChartSlice {
  name: string
  value: number
}

export interface ChartKpi {
  /** Percentage change, signed. */
  delta?: number
  label: string
  /** A number (formatted with the chart's format) or text shown as written. */
  value: number | string
  /** A small trend line under the value. */
  trend?: number[]
}

export interface ChartSpec {
  categories: string[]
  columns: string[]
  currency: string
  format: ChartFormat
  /** Bars run left to right. */
  horizontal: boolean
  kind: ChartKind
  kpis: ChartKpi[]
  rows: (number | string)[][]
  series: ChartSeries[]
  slices: ChartSlice[]
  stacked: boolean
  subtitle: string
  title: string
  /** Appended to values: "%", " kg", " ms". */
  unit: string
}

export const CHART_LIMITS = { categories: 500, kpis: 8, points: 2000, rows: 200, series: 8, slices: 12 } as const

export type ChartParse = { error: string } | { spec: ChartSpec }

type Raw = Record<string, unknown>

const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max = 160): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const FORMATS: readonly ChartFormat[] = ['compact', 'currency', 'number', 'percent']

function seriesFrom(raw: Raw, scatter: boolean): ChartSeries[] | string {
  const list = Array.isArray(raw.series)
    ? raw.series
    : Array.isArray(raw.data)
      ? [{ data: raw.data, name: raw.name }]
      : []

  if (list.length === 0) {
    return 'needs "series" (or a "data" array)'
  }

  if (list.length > CHART_LIMITS.series) {
    return `at most ${CHART_LIMITS.series} series`
  }

  const series: ChartSeries[] = []

  for (const [index, entry] of list.entries()) {
    const item: Raw = isRecord(entry) ? entry : { data: entry }
    const data = Array.isArray(item.data) ? item.data : []

    if (data.length === 0 || data.length > CHART_LIMITS.points) {
      return `series ${index + 1} needs 1–${CHART_LIMITS.points} values`
    }

    if (scatter) {
      if (!data.every(point => Array.isArray(point) && point.length === 2 && point.every(finite))) {
        return 'scatter points are [x, y] number pairs'
      }

      series.push({ data: data as [number, number][], name: text(item.name) || `Series ${index + 1}` })
    } else {
      if (!data.every(value => value === null || finite(value))) {
        return `series ${index + 1} must hold numbers (null for a gap)`
      }

      series.push({ data: data as (number | null)[], name: text(item.name) || `Series ${index + 1}` })
    }
  }

  return series
}

function slicesFrom(raw: Raw): ChartSlice[] | string {
  const source = Array.isArray(raw.slices) ? raw.slices : Array.isArray(raw.items) ? raw.items : null

  const slices: ChartSlice[] = source
    ? source.filter(isRecord).map(item => ({ name: text(item.name ?? item.label), value: item.value as number }))
    : (Array.isArray(raw.labels) ? raw.labels : Array.isArray(raw.categories) ? raw.categories : []).map(
        (name, index) => ({
          name: text(name),
          value: (Array.isArray(raw.data) ? raw.data[index] : undefined) as number
        })
      )

  if (slices.length === 0 || slices.length > CHART_LIMITS.slices) {
    return `needs 1–${CHART_LIMITS.slices} slices`
  }

  if (!slices.every(slice => slice.name && finite(slice.value) && slice.value >= 0)) {
    return 'each slice needs a name and a value of 0 or more'
  }

  return slices
}

function kpisFrom(raw: Raw): ChartKpi[] | string {
  const list = Array.isArray(raw.kpis) ? raw.kpis : Array.isArray(raw.items) ? raw.items : []

  if (list.length === 0 || list.length > CHART_LIMITS.kpis) {
    return `needs 1–${CHART_LIMITS.kpis} kpis`
  }

  const kpis: ChartKpi[] = []

  for (const entry of list) {
    if (!isRecord(entry) || !text(entry.label) || !(finite(entry.value) || text(entry.value))) {
      return 'each kpi needs a label and a value'
    }

    kpis.push({
      delta: finite(entry.delta) ? entry.delta : undefined,
      label: text(entry.label, 60),
      trend:
        Array.isArray(entry.trend) && entry.trend.length > 1 && entry.trend.every(finite)
          ? (entry.trend as number[]).slice(0, 200)
          : undefined,
      value: finite(entry.value) ? entry.value : text(entry.value, 40)
    })
  }

  return kpis
}

function tableFrom(raw: Raw): { columns: string[]; rows: (number | string)[][] } | string {
  const columns = Array.isArray(raw.columns) ? raw.columns.map(column => text(column, 60)) : []
  const rows = Array.isArray(raw.rows) ? raw.rows : []

  if (columns.length === 0 || columns.some(column => !column)) {
    return 'needs "columns" (their names)'
  }

  if (rows.length > CHART_LIMITS.rows) {
    return `at most ${CHART_LIMITS.rows} rows`
  }

  if (!rows.every(row => Array.isArray(row) && row.length === columns.length)) {
    return 'every row needs one cell per column'
  }

  return {
    columns,
    rows: rows.map(row => (row as unknown[]).map(cell => (finite(cell) ? cell : text(String(cell ?? ''), 200))))
  }
}

/** The fence's JSON, checked and normalised — or why it cannot be drawn. */
export function parseChartSpec(source: string): ChartParse {
  let raw: unknown

  try {
    raw = JSON.parse(source)
  } catch {
    return { error: 'not valid JSON' }
  }

  if (!isRecord(raw)) {
    return { error: 'expected a JSON object' }
  }

  const kind = text(raw.type ?? raw.kind).toLowerCase() as ChartKind

  if (!CHART_KINDS.includes(kind)) {
    return { error: `"type" must be one of ${CHART_KINDS.join(', ')}` }
  }

  const format = FORMATS.includes(raw.format as ChartFormat) ? (raw.format as ChartFormat) : 'number'

  const spec: ChartSpec = {
    categories: [],
    columns: [],
    currency: /^[A-Z]{3}$/.test(text(raw.currency)) ? text(raw.currency) : 'USD',
    format,
    horizontal: raw.horizontal === true,
    kind,
    kpis: [],
    rows: [],
    series: [],
    slices: [],
    stacked: raw.stacked === true,
    subtitle: text(raw.subtitle),
    title: text(raw.title),
    unit: text(raw.unit, 12)
  }

  if (kind === 'kpi') {
    const kpis = kpisFrom(raw)

    return typeof kpis === 'string' ? { error: kpis } : { spec: { ...spec, kpis } }
  }

  if (kind === 'table') {
    const table = tableFrom(raw)

    return typeof table === 'string' ? { error: table } : { spec: { ...spec, ...table } }
  }

  if (kind === 'donut' || kind === 'pie') {
    const slices = slicesFrom(raw)

    return typeof slices === 'string' ? { error: slices } : { spec: { ...spec, slices } }
  }

  const series = seriesFrom(raw, kind === 'scatter')

  if (typeof series === 'string') {
    return { error: series }
  }

  if (kind === 'scatter') {
    return { spec: { ...spec, series } }
  }

  const categories = (
    Array.isArray(raw.categories)
      ? raw.categories
      : Array.isArray(raw.x)
        ? raw.x
        : Array.isArray(raw.labels)
          ? raw.labels
          : []
  )
    .map(label => text(String(label ?? ''), 60))
    .slice(0, CHART_LIMITS.categories)

  const length = Math.max(...series.map(entry => entry.data.length))

  if (categories.length !== length) {
    return { error: `"categories" needs one label per value (${length})` }
  }

  return { spec: { ...spec, categories, series } }
}

/** How a value reads on this chart: its format, its currency and its unit. */
export function formatValue(spec: Pick<ChartSpec, 'currency' | 'format' | 'unit'>, value: number, locale?: string) {
  const options: Intl.NumberFormatOptions =
    spec.format === 'currency'
      ? { currency: spec.currency, maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2, style: 'currency' }
      : spec.format === 'percent'
        ? { maximumFractionDigits: 1, style: 'percent' }
        : spec.format === 'compact'
          ? { maximumFractionDigits: 1, notation: 'compact' }
          : { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2 }

  // Percent values arrive as percentages (12.5 means 12.5%), as people write them.
  const shown = spec.format === 'percent' ? value / 100 : value

  return `${new Intl.NumberFormat(locale, options).format(shown)}${spec.unit}`
}

/** The same value, short enough for an axis tick. */
export function formatTick(spec: Pick<ChartSpec, 'currency' | 'format' | 'unit'>, value: number, locale?: string) {
  if (spec.format === 'percent') {
    return formatValue(spec, value, locale)
  }

  const options: Intl.NumberFormatOptions = { maximumFractionDigits: 1, notation: 'compact' }

  if (spec.format === 'currency') {
    Object.assign(options, { currency: spec.currency, style: 'currency' })
  }

  return `${new Intl.NumberFormat(locale, options).format(value)}${spec.unit}`
}
