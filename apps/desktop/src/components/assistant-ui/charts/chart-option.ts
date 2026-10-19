import type { EChartsOption } from 'echarts'

import { type ChartSpec, formatTick, formatValue } from './chart-spec'

/** The app's theme as plain colours a chart engine can parse — read once per theme. */
export interface ChartPalette {
  accent: string
  /** Shades of the accent, strongest first — one hue for parts of a whole. */
  shades: string[]
  /** Distinct hues, accent first — for series that must be told apart. */
  series: string[]
  font: string
  grid: string
  muted: string
  stroke: string
  surface: string
  text: string
}

/** Most slices a pie or donut draws in shades of the accent. */
const MAX_SHADED_SLICES = 4

export const SERIES_TOKENS = [
  '--ui-accent',
  '--ui-purple',
  '--ui-cyan',
  '--ui-orange',
  '--ui-green',
  '--ui-red',
  '--ui-yellow'
]

/** Any CSS colour (a token, `color-mix(…)`, `color(srgb …)`) as a plain `rgba()` the chart engine can
 *  parse and fade: painted on a one-pixel canvas and read back. */
function resolver() {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })

  return (css: string, fallback: string) => {
    if (!context || !css.trim()) {
      return fallback
    }

    context.clearRect(0, 0, 1, 1)
    context.fillStyle = fallback
    context.fillStyle = css
    context.fillRect(0, 0, 1, 1)

    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data

    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`
  }
}

export function readChartPalette(root: HTMLElement = document.documentElement): ChartPalette {
  const style = getComputedStyle(root)
  const token = (name: string) => style.getPropertyValue(name).trim()
  const resolve = resolver()
  const accent = resolve(token('--ui-accent'), '#2563eb')
  const surface = resolve(token('--card-surface') || token('--ui-bg-editor'), '#ffffff')

  return {
    accent,
    font: getComputedStyle(document.body).fontFamily,
    grid: resolve(`color-mix(in srgb, ${token('--ui-text-primary')} 8%, transparent)`, 'rgba(0,0,0,0.08)'),
    muted: resolve(token('--ui-text-tertiary'), '#6b7280'),
    series: SERIES_TOKENS.map(name => resolve(token(name), accent)),
    shades: [100, 74, 52, 34].map(mix => resolve(`color-mix(in srgb, ${accent} ${mix}%, ${surface})`, accent)),
    stroke: resolve(`color-mix(in srgb, ${token('--ui-text-primary')} 14%, transparent)`, 'rgba(0,0,0,0.14)'),
    surface,
    text: resolve(token('--ui-text-primary'), '#1d1d1f')
  }
}

/** `color` at `alpha` (0–1), from the hex or rgb(a) string the palette holds. */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1]

  if (hex) {
    const [r, g, b] = [0, 2, 4].map(start => parseInt(hex.slice(start, start + 2), 16))

    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color)?.[1]?.split(',').slice(0, 3)

  return rgb ? `rgba(${rgb.join(',')}, ${alpha})` : color
}

/** Long series get pan and Ctrl/⌘-wheel zoom — never plain wheel, which belongs to the chat scroll. */
const ZOOM_AFTER = 40

/** Shades of the accent read as one whole up to a few parts; past that the faint ones vanish into the card
 *  (worst on a dark theme), so more slices take the theme's distinct hues. */
const sliceColors = (spec: ChartSpec, palette: ChartPalette) =>
  spec.slices.length <= MAX_SHADED_SLICES ? palette.shades : palette.series

/** A bar chart's series as bars — unless it asks to be the line over them (a combo chart). */
const drawnAsBars = (spec: ChartSpec, entry: ChartSpec['series'][number]) =>
  spec.kind === 'bar' && entry.type !== 'line'

/** What every chart option shares, handed to the kinds drawn by their own builder. */
interface OptionContext {
  base: EChartsOption
  legend: (show: boolean) => EChartsOption['legend']
  narrow: boolean
  value: (raw: unknown) => string
}

type OptionBuilder = (spec: ChartSpec, palette: ChartPalette, context: OptionContext) => EChartsOption

/** Stages from widest to narrowest, each labelled with its share of the first. */
function funnelOption(spec: ChartSpec, palette: ChartPalette, { base, narrow, value }: OptionContext): EChartsOption {
  const top = Math.max(...spec.slices.map(slice => slice.value), 0)

  return {
    ...base,
    color: palette.shades.length >= spec.slices.length ? palette.shades : palette.series,
    series: [
      {
        bottom: 8,
        data: spec.slices.map(slice => ({ name: slice.name, value: slice.value })),
        emphasis: { label: { fontWeight: 600 } },
        gap: 3,
        itemStyle: { borderColor: palette.surface, borderWidth: 0 },
        label: {
          color: palette.text,
          fontSize: 12,
          formatter: (params: { name: string; value?: unknown }) => {
            const raw = Number(params.value)

            return `${params.name}  ·  ${value(raw)}${top > 0 && raw !== top ? `  (${Math.round((raw / top) * 100)}%)` : ''}`
          },
          position: narrow ? 'inside' : 'right'
        },
        labelLine: { lineStyle: { color: palette.stroke } },
        left: 8,
        minSize: '12%',
        right: narrow ? 8 : '34%',
        sort: 'descending',
        top: 8,
        type: 'funnel'
      }
    ],
    tooltip: { ...base.tooltip, trigger: 'item' }
  }
}

/** One reading on an arc against its maximum, the value large in the middle. */
function gaugeOption(spec: ChartSpec, palette: ChartPalette, { base, narrow, value }: OptionContext): EChartsOption {
  if (!spec.gauge) {
    return { ...base }
  }

  const { max, value: reading } = spec.gauge

  return {
    ...base,
    series: [
      {
        axisLabel: { show: false },
        axisLine: { lineStyle: { color: [[1, palette.grid]], width: 14 }, roundCap: true },
        axisTick: { show: false },
        center: ['50%', '62%'],
        data: [{ name: spec.subtitle || spec.title, value: reading }],
        detail: {
          color: palette.text,
          fontSize: narrow ? 26 : 34,
          fontWeight: 600,
          formatter: (raw: number) => value(raw),
          offsetCenter: [0, '-6%'],
          valueAnimation: true
        },
        endAngle: -20,
        max,
        min: 0,
        pointer: { show: false },
        progress: { itemStyle: { color: palette.accent }, roundCap: true, show: true, width: 14 },
        radius: '96%',
        splitLine: { show: false },
        startAngle: 200,
        title: { color: palette.muted, fontSize: 12, offsetCenter: [0, '22%'] },
        type: 'gauge'
      }
    ],
    tooltip: { show: false }
  }
}

/** A profile across its categories, one filled polygon per series. */
function radarOption(spec: ChartSpec, palette: ChartPalette, { base, legend, narrow }: OptionContext): EChartsOption {
  const top = Math.max(...spec.series.flatMap(entry => (entry.data as (number | null)[]).map(point => point ?? 0)), 1)

  return {
    ...base,
    legend: { ...legend(spec.series.length > 1), left: 'center' },
    radar: {
      axisName: { color: palette.muted, fontSize: 11 },
      axisLine: { lineStyle: { color: palette.grid } },
      indicator: spec.categories.map(name => ({ max: top, name })),
      radius: narrow ? '62%' : '70%',
      shape: 'polygon',
      splitArea: { show: false },
      splitLine: { lineStyle: { color: palette.grid } }
    },
    series: [
      {
        data: spec.series.map((entry, index) => ({
          areaStyle: { color: withAlpha(palette.series[index % palette.series.length] ?? palette.accent, 0.16) },
          name: entry.name,
          value: entry.data as number[]
        })),
        emphasis: { lineStyle: { width: 3 } },
        lineStyle: { width: 2 },
        symbolSize: 5,
        type: 'radar'
      }
    ],
    tooltip: { ...base.tooltip, trigger: 'item' }
  }
}

const SPECIAL_OPTIONS: Partial<Record<ChartSpec['kind'], OptionBuilder>> = {
  funnel: funnelOption,
  gauge: gaugeOption,
  radar: radarOption
}

/**
 * The ECharts option for a chart spec, in the app's design line: quiet axes, hairline grid, one accent
 * (more hues only when series must be told apart), soft rounded marks and tooltips that read like the
 * app's cards. `width` lets a narrow chart move its legend under the plot.
 */
export function chartOption(spec: ChartSpec, palette: ChartPalette, width: number, locale?: string): EChartsOption {
  const tick = (value: number) => formatTick(spec, value, locale)
  const value = (raw: unknown) => (typeof raw === 'number' ? formatValue(spec, raw, locale) : String(raw ?? '—'))
  const narrow = width < 480

  const base: EChartsOption = {
    animationDuration: 650,
    animationEasing: 'cubicOut',
    color: palette.series,
    textStyle: { color: palette.muted, fontFamily: palette.font, fontSize: 11 },
    tooltip: {
      backgroundColor: palette.surface,
      borderColor: palette.stroke,
      borderWidth: 1,
      confine: true,
      extraCssText: 'border-radius:12px;box-shadow:0 10px 30px -12px rgba(11,21,48,0.28);',
      padding: [8, 12],
      textStyle: { color: palette.text, fontFamily: palette.font, fontSize: 12 },
      valueFormatter: raw => value(raw)
    }
  }

  // The legend reads first, at the top left under the title — never on top of the axis labels.
  const legend = (show: boolean): EChartsOption['legend'] =>
    show
      ? {
          icon: 'roundRect',
          left: 0,
          top: 0,
          itemGap: 16,
          itemHeight: 8,
          itemWidth: 12,
          textStyle: { color: palette.muted, fontSize: 11 }
        }
      : { show: false }

  if (spec.kind === 'donut' || spec.kind === 'pie') {
    const total = spec.slices.reduce((sum, slice) => sum + slice.value, 0)
    const colors = sliceColors(spec, palette)
    const donut = spec.kind === 'donut'
    const center: [string, string] = narrow ? ['50%', '42%'] : ['30%', '50%']
    // Shares that add up to a hundred: their sum says nothing ("100"), so the well stays empty.
    const shares = spec.format === 'percent' || Math.abs(total - 100) < 0.5

    return {
      ...base,
      color: colors,
      legend: {
        formatter: name => {
          const slice = spec.slices.find(entry => entry.name === name)

          return slice && total > 0 ? `${name}   ${Math.round((slice.value / total) * 100)}%` : name
        },
        icon: 'circle',
        itemGap: 12,
        itemHeight: 8,
        itemWidth: 8,
        orient: narrow ? 'horizontal' : 'vertical',
        textStyle: { color: palette.text, fontSize: 12 },
        ...(narrow ? { bottom: 0, left: 'center' } : { left: '58%', top: 'middle' })
      },
      series: [
        {
          avoidLabelOverlap: true,
          center,
          data: spec.slices.map(slice => ({ name: slice.name, value: slice.value })),
          emphasis: { scale: true, scaleSize: 5 },
          itemStyle: { borderColor: palette.surface, borderRadius: donut ? 6 : 3, borderWidth: donut ? 0 : 2 },
          label: { show: false },
          padAngle: donut ? 1.6 : 0,
          radius: donut ? ['58%', '82%'] : ['0%', '82%'],
          type: 'pie'
        }
      ],
      title:
        donut && !shares
          ? {
              left: center[0],
              subtext: 'total',
              subtextStyle: { color: palette.muted, fontSize: 11 },
              text: value(total),
              textAlign: 'center',
              textStyle: { color: palette.text, fontSize: narrow ? 18 : 22, fontWeight: 600 },
              top: narrow ? '34%' : '42%'
            }
          : undefined,
      tooltip: { ...base.tooltip, trigger: 'item' }
    }
  }

  const special = SPECIAL_OPTIONS[spec.kind]

  if (special) {
    return special(spec, palette, { base, legend, narrow, value })
  }

  if (spec.kind === 'scatter') {
    const axis = {
      axisLabel: { color: palette.muted, formatter: tick },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.grid } },
      type: 'value' as const
    }

    return {
      ...base,
      grid: { bottom: 6, left: 6, right: 14, top: spec.series.length > 1 ? 40 : 12 },
      legend: legend(spec.series.length > 1),
      series: spec.series.map(entry => ({
        data: entry.data as [number, number][],
        emphasis: { focus: 'series' as const, scale: 1.4 },
        itemStyle: { opacity: 0.85 },
        name: entry.name,
        symbolSize: 9,
        type: 'scatter' as const
      })),
      tooltip: { ...base.tooltip, trigger: 'item' },
      xAxis: axis,
      yAxis: axis
    }
  }

  // Category charts: bar, line, area.
  const bar = spec.kind === 'bar'
  const points = spec.categories.length
  const many = spec.series.length > 1

  const categoryAxis = {
    axisLabel: { color: palette.muted, hideOverlap: true },
    axisLine: { lineStyle: { color: palette.stroke } },
    axisTick: { show: false },
    boundaryGap: bar,
    data: spec.categories,
    inverse: bar && spec.horizontal,
    type: 'category' as const
  }

  const valueAxis = {
    axisLabel: { color: palette.muted, formatter: tick },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: palette.grid } },
    type: 'value' as const
  }

  const radius = spec.stacked ? 3 : 6

  return {
    ...base,
    dataZoom:
      !bar && points > ZOOM_AFTER
        ? [{ moveOnMouseMove: true, moveOnMouseWheel: false, type: 'inside', zoomOnMouseWheel: 'ctrl' }]
        : undefined,
    grid: { bottom: 6, left: 6, right: 14, top: many ? 40 : 12 },
    legend: legend(many),
    series: spec.series.map((entry, index) => {
      const color = palette.series[index % palette.series.length] ?? palette.accent

      if (drawnAsBars(spec, entry)) {
        return {
          barMaxWidth: 44,
          data: entry.data as (number | null)[],
          emphasis: { focus: 'series' as const },
          itemStyle: { borderRadius: spec.horizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0] },
          name: entry.name,
          stack: spec.stacked ? 'total' : undefined,
          type: 'bar' as const
        }
      }

      return {
        areaStyle:
          spec.kind === 'area'
            ? {
                color: {
                  colorStops: [
                    { color: withAlpha(color, many ? 0.18 : 0.28), offset: 0 },
                    { color: withAlpha(color, 0.02), offset: 1 }
                  ],
                  type: 'linear' as const,
                  x: 0,
                  x2: 0,
                  y: 0,
                  y2: 1
                }
              }
            : undefined,
        data: entry.data as (number | null)[],
        emphasis: { focus: 'series' as const },
        lineStyle: { width: 2.5 },
        name: entry.name,
        showSymbol: points <= 12,
        smooth: 0.35,
        stack: spec.stacked ? 'total' : undefined,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line' as const
      }
    }),
    tooltip: {
      ...base.tooltip,
      axisPointer: bar
        ? { shadowStyle: { color: withAlpha(palette.text, 0.05) }, type: 'shadow' }
        : { lineStyle: { color: palette.stroke, type: 'dashed' }, type: 'line' },
      trigger: 'axis'
    },
    xAxis: bar && spec.horizontal ? valueAxis : categoryAxis,
    yAxis: bar && spec.horizontal ? categoryAxis : valueAxis
  }
}

/** How tall a chart is at `width`: proportional, within a calm band. */
export function chartHeight(spec: ChartSpec, width: number): number {
  if (spec.kind === 'gauge') {
    return Math.round(Math.min(260, Math.max(190, width * 0.34)))
  }

  if (spec.kind === 'funnel') {
    return Math.round(Math.min(360, Math.max(220, spec.slices.length * 52)))
  }

  if (spec.kind === 'radar') {
    return Math.round(Math.min(400, Math.max(280, width * 0.5)))
  }

  const ratio = spec.kind === 'donut' || spec.kind === 'pie' ? 0.42 : spec.horizontal ? 0.5 : 0.46
  const rows = spec.horizontal ? spec.categories.length * 34 + 40 : 0
  const ceiling = spec.kind === 'donut' || spec.kind === 'pie' ? 340 : 420

  return Math.round(Math.min(ceiling, Math.max(220, width * ratio, rows)))
}
