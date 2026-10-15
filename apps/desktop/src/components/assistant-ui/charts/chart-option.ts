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

const SERIES_TOKENS = [
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
    shades: [100, 76, 56, 40, 28, 18].map(mix => resolve(`color-mix(in srgb, ${accent} ${mix}%, ${surface})`, accent)),
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
    const colors = spec.slices.length <= palette.shades.length ? palette.shades : palette.series
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

      if (bar) {
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
  const ratio = spec.kind === 'donut' || spec.kind === 'pie' ? 0.42 : spec.horizontal ? 0.5 : 0.46
  const rows = spec.horizontal ? spec.categories.length * 34 + 40 : 0
  const ceiling = spec.kind === 'donut' || spec.kind === 'pie' ? 340 : 420

  return Math.round(Math.min(ceiling, Math.max(220, width * ratio, rows)))
}
