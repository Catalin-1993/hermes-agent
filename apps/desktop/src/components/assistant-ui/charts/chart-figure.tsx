import type { EChartsOption } from 'echarts'
import { useEffect, useMemo, useRef, useState } from 'react'

import { CARD_SURFACE_CLASS } from '@/components/ui/hermes-card'
import { useThemeEpoch } from '@/hooks/use-theme-epoch'
import { cn } from '@/lib/utils'

import { useFigureArea } from '../use-figure-area'
import { WidgetToolbar } from '../widget-toolbar'

import { chartDocument } from './chart-document'
import { chartHeight, chartOption, readChartPalette } from './chart-option'
import { type ChartSpec, formatValue } from './chart-spec'
import { echarts } from './echarts-core'

const ENGINE_KINDS = new Set<ChartSpec['kind']>(['area', 'bar', 'donut', 'line', 'pie', 'scatter'])

/** One ECharts instance, kept for the life of the figure and resized with its box. */
function EChart({ height, option }: { height: number | string; option: EChartsOption }) {
  const host = useRef<HTMLDivElement>(null)
  const [chart, setChart] = useState<null | ReturnType<typeof echarts.init>>(null)

  useEffect(() => {
    if (!host.current) {
      return
    }

    const instance = echarts.init(host.current, null, { renderer: 'svg' })
    const observer = new ResizeObserver(() => instance.resize())

    observer.observe(host.current)
    setChart(instance)

    return () => {
      observer.disconnect()
      instance.dispose()
    }
  }, [])

  useEffect(() => {
    chart?.setOption(option, { notMerge: true })
  }, [chart, option])

  return <div className="w-full" ref={host} style={{ height }} />
}

function Sparkline({ points }: { points: number[] }) {
  const low = Math.min(...points)
  const span = Math.max(...points) - low || 1
  const path = points.map((point, index) => `${(index / (points.length - 1)) * 72},${23 - ((point - low) / span) * 21}`)

  return (
    <svg aria-hidden className="h-6 w-18 overflow-visible" viewBox="0 0 72 24">
      <polyline
        fill="none"
        points={path.join(' ')}
        stroke="var(--ui-accent)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function KpiGrid({ spec }: { spec: ChartSpec }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
      {spec.kpis.map(kpi => (
        <div
          className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-(--card-well-stroke) bg-(--card-well) px-4 py-3.5"
          key={kpi.label}
        >
          <span className="truncate text-[0.75rem] text-(--ui-text-tertiary)">{kpi.label}</span>
          <span className="text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] text-(--ui-text-primary) tabular-nums">
            {typeof kpi.value === 'number' ? formatValue(spec, kpi.value) : kpi.value}
          </span>
          {(kpi.delta !== undefined || kpi.trend) && (
            <span className="mt-0.5 flex items-center justify-between gap-2">
              {kpi.delta !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums',
                    kpi.delta >= 0
                      ? 'bg-[color-mix(in_srgb,var(--ui-green)_14%,transparent)] text-(--ui-green)'
                      : 'bg-[color-mix(in_srgb,var(--ui-red)_14%,transparent)] text-(--ui-red)'
                  )}
                >
                  {kpi.delta >= 0 ? '+' : ''}
                  {kpi.delta}%
                </span>
              ) : (
                <span />
              )}
              {kpi.trend && <Sparkline points={kpi.trend} />}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function DataTable({ spec }: { spec: ChartSpec }) {
  const numeric = useMemo(
    () =>
      spec.columns.map((_, index) => spec.rows.length > 0 && spec.rows.every(row => typeof row[index] === 'number')),
    [spec]
  )

  const [sort, setSort] = useState<{ column: number; direction: 1 | -1 } | null>(null)

  const rows = useMemo(() => {
    if (!sort) {
      return spec.rows
    }

    return [...spec.rows].sort((a, b) => {
      const left = a[sort.column]
      const right = b[sort.column]

      return (
        (typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right))) * sort.direction
      )
    })
  }, [sort, spec.rows])

  // The first numeric column carries a quiet bar, so the table reads at a glance.
  const barColumn = numeric.indexOf(true)
  const barMax = barColumn < 0 ? 0 : Math.max(...spec.rows.map(row => Math.abs(row[barColumn] as number)), 0)

  return (
    <div className="max-h-[26rem] overflow-auto">
      <table className="w-full border-collapse text-[0.8125rem]">
        <thead className="sticky top-0 bg-(--card-surface)">
          <tr>
            {spec.columns.map((column, index) => (
              <th
                aria-sort={sort?.column === index ? (sort.direction === 1 ? 'ascending' : 'descending') : undefined}
                className={cn(
                  'border-b border-(--card-stroke) p-0 font-medium text-(--ui-text-tertiary)',
                  numeric[index] && 'text-right'
                )}
                key={column}
              >
                <button
                  className={cn(
                    'w-full cursor-pointer px-3 py-2 text-[0.75rem] transition-colors hover:text-(--ui-text-primary)',
                    numeric[index] ? 'text-right' : 'text-left',
                    sort?.column === index && 'text-(--ui-text-primary)'
                  )}
                  onClick={() =>
                    setSort(current =>
                      current?.column === index
                        ? { column: index, direction: current.direction === 1 ? -1 : 1 }
                        : { column: index, direction: numeric[index] ? -1 : 1 }
                    )
                  }
                  type="button"
                >
                  {column}
                  {sort?.column === index && (sort.direction === 1 ? ' ↑' : ' ↓')}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr className="transition-colors hover:bg-(--card-well)" key={rowIndex}>
              {row.map((cell, index) => (
                <td
                  className={cn(
                    'border-b border-(--card-well-stroke) px-3 py-2.5 text-(--ui-text-primary)',
                    numeric[index] && 'text-right tabular-nums'
                  )}
                  key={index}
                >
                  {index === barColumn && barMax > 0 && (
                    <span
                      aria-hidden
                      className="mr-2.5 inline-block h-1.5 rounded-full bg-(--ui-accent) align-middle opacity-80"
                      style={{ width: `${(Math.abs(cell as number) / barMax) * 4}rem` }}
                    />
                  )}
                  {typeof cell === 'number' ? formatValue(spec, cell) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * A ```chart drawn by the app: a card on the figure area (the column, widened on a wide window), with
 * its title, the chart, KPI tiles or table, and on hover full screen and Add to page.
 */
export function ChartFigure({ spec }: { spec: ChartSpec }) {
  const outer = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const plot = useRef<HTMLDivElement>(null)
  const figure = useFigureArea(outer)
  const themeEpoch = useThemeEpoch()
  const [plotWidth, setPlotWidth] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  // Read when the theme repaints; the palette resolves the live tokens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const palette = useMemo(() => readChartPalette(), [themeEpoch])

  useEffect(() => {
    const element = plot.current

    if (!element) {
      return
    }

    const observer = new ResizeObserver(() => setPlotWidth(Math.round(element.clientWidth)))

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null && document.fullscreenElement === card.current)

    document.addEventListener('fullscreenchange', sync)

    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const engine = ENGINE_KINDS.has(spec.kind)

  const option = useMemo(
    () => (engine && plotWidth > 0 ? chartOption(spec, palette, plotWidth) : null),
    [engine, palette, plotWidth, spec]
  )

  const html = useMemo(() => chartDocument(spec, option), [option, spec])
  const room = figure ? Math.max(figure.area, figure.column) : 0
  const inset = figure ? (room - figure.column) / 2 : 0

  const toggleFullscreen = (next: boolean) =>
    void (next ? card.current?.requestFullscreen() : document.fullscreenElement && document.exitFullscreen())

  return (
    <div
      className="group/widget my-3 min-w-0"
      data-figure=""
      ref={outer}
      style={figure ? { marginInline: -inset, width: room } : undefined}
    >
      <div
        className={cn(
          CARD_SURFACE_CLASS,
          // not-prose: the message's markdown typography must not restyle the figure.
          'not-prose relative flex min-w-0 flex-col gap-4 px-5 pt-4 pb-5',
          fullscreen && 'rounded-none border-0 p-10'
        )}
        data-chart={spec.kind}
        ref={card}
      >
        {(spec.title || spec.subtitle) && (
          <header className="min-w-0 pr-16">
            {/* Not h3/p: the message's markdown styles would restyle them. */}
            {spec.title && (
              <div
                aria-level={3}
                className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)"
                role="heading"
              >
                {spec.title}
              </div>
            )}
            {spec.subtitle && <div className="mt-0.5 text-[0.75rem] text-(--ui-text-tertiary)">{spec.subtitle}</div>}
          </header>
        )}
        <div className={cn('min-w-0', fullscreen && 'relative min-h-0 flex-1')} ref={plot}>
          {spec.kind === 'kpi' ? (
            <KpiGrid spec={spec} />
          ) : spec.kind === 'table' ? (
            <DataTable spec={spec} />
          ) : option ? (
            fullscreen ? (
              <div className="absolute inset-0">
                <EChart height="100%" option={option} />
              </div>
            ) : (
              <EChart height={chartHeight(spec, plotWidth)} option={option} />
            )
          ) : (
            <div style={{ height: chartHeight(spec, plotWidth) }} />
          )}
        </div>
        <WidgetToolbar expanded={fullscreen} globe={null} html={html} onExpandedChange={toggleFullscreen} />
      </div>
    </div>
  )
}

/** The figure's place while its JSON is still being written. */
export function ChartSkeleton() {
  return (
    <div className="my-3" data-figure="">
      <div className={cn(CARD_SURFACE_CLASS, 'flex flex-col gap-4 px-5 pt-4 pb-5')}>
        <div className="h-3.5 w-40 animate-pulse rounded-full bg-(--card-well-stroke)" />
        <div className="h-56 animate-pulse rounded-2xl bg-(--card-well)" />
      </div>
    </div>
  )
}
