/**
 * The chart studio's canvas: candles (or a line) with volume, the indicator lines on the price, each
 * oscillator in its own pane under it, price levels (alerts, supports, Fibonacci, stops) and markers.
 * Rebuilt when what it draws changes, keeping the zoom; the newest candle moves with every tick without a
 * rebuild. Clicks and the crosshair are reported as a time and a price on the price pane.
 */

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  LineSeries,
  LineStyle,
  type LogicalRange,
  type SeriesMarker,
  TickMarkType,
  type Time
} from 'lightweight-charts'
import { useEffect, useRef } from 'react'

import { resolveColor } from './chart-colors'
import { quotePrice } from './format'
import type { Bar } from './market-feed'
import type { ChartPoint, LineSpec, PaneSpec, PriceLineSpec } from './studio-model'
import { useThemeTick } from './use-theme-tick'

export type ChartMode = 'candles' | 'line'

export interface Marker {
  time: number
  color: string
  position: 'aboveBar' | 'belowBar' | 'inBar'
  shape: 'arrowDown' | 'arrowUp' | 'circle' | 'square'
  text: string
}

const PANE_HEIGHT = 120
const PRICE_HEIGHT = 430
const clock = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit' })
const dayOnly = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC', year: 'numeric' })
const full = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' })
const at = (time: Time) => new Date(Number(time) * 1000)

function tickLabel(time: Time, type: TickMarkType, daily: boolean): string {
  const timeZone = daily ? 'UTC' : undefined

  if (type === TickMarkType.Year) {
    return new Intl.DateTimeFormat('ro-RO', { timeZone, year: 'numeric' }).format(at(time))
  }

  if (type === TickMarkType.Month) {
    return new Intl.DateTimeFormat('ro-RO', { month: 'short', timeZone }).format(at(time))
  }

  return type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds
    ? clock.format(at(time))
    : new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone }).format(at(time))
}

const candle = ({ close, high, low, open, time }: Bar) => ({ close, high, low, open, time: time as Time })

interface Drawn {
  chart: IChartApi
  last: number
  price: ISeriesApi<'Area' | 'Candlestick'>
  volume: ISeriesApi<'Histogram'> | null
}

function baseChart(element: HTMLElement, daily: boolean): IChartApi {
  return createChart(element, {
    autoSize: true,
    crosshair: { mode: CrosshairMode.Normal },
    grid: { horzLines: { color: resolveColor('var(--card-well-stroke)') }, vertLines: { visible: false } },
    layout: {
      attributionLogo: false,
      background: { color: 'transparent', type: ColorType.Solid },
      fontSize: 11,
      panes: { separatorColor: resolveColor('var(--card-well-stroke)') },
      textColor: resolveColor('var(--ui-text-tertiary)')
    },
    localization: {
      priceFormatter: quotePrice,
      timeFormatter: (time: Time) => (daily ? dayOnly : full).format(at(time))
    },
    rightPriceScale: { borderVisible: false, scaleMargins: { bottom: 0.2, top: 0.08 } },
    timeScale: {
      borderVisible: false,
      rightOffset: 6,
      tickMarkFormatter: (time: Time, type: TickMarkType) => tickLabel(time, type, daily),
      timeVisible: !daily
    }
  })
}

function priceSeries(chart: IChartApi, bars: Bar[], mode: ChartMode) {
  const up = resolveColor('var(--ui-green)')
  const down = resolveColor('var(--ui-red)')

  if (mode === 'candles') {
    const series = chart.addSeries(CandlestickSeries, {
      borderVisible: false,
      downColor: down,
      upColor: up,
      wickDownColor: down,
      wickUpColor: up
    })

    series.setData(bars.map(candle))

    return series
  }

  const tone = bars[bars.length - 1].close >= bars[0].open ? up : down

  const series = chart.addSeries(AreaSeries, {
    bottomColor: resolveColor('var(--ui-base)', 0),
    lineColor: tone,
    lineWidth: 2,
    topColor: tone.replace(/[\d.]+\)$/, '0.22)')
  })

  series.setData(bars.map(bar => ({ time: bar.time as Time, value: bar.close })))

  return series
}

function volumeSeries(chart: IChartApi, bars: Bar[]) {
  const volume = chart.addSeries(HistogramSeries, {
    lastValueVisible: false,
    priceFormat: { type: 'volume' },
    priceLineVisible: false,
    priceScaleId: ''
  })

  volume.priceScale().applyOptions({ scaleMargins: { bottom: 0, top: 0.82 } })
  volume.setData(
    bars.map(bar => ({
      color: resolveColor(bar.close >= bar.open ? 'var(--ui-green)' : 'var(--ui-red)', 0.35),
      time: bar.time as Time,
      value: bar.volume
    }))
  )

  return volume
}

function addLine(chart: IChartApi, spec: LineSpec, pane = 0) {
  const options = { color: spec.color, lastValueVisible: false, priceLineVisible: false }

  const series = spec.histogram
    ? chart.addSeries(HistogramSeries, options, pane)
    : chart.addSeries(
        LineSeries,
        {
          ...options,
          crosshairMarkerVisible: false,
          lineStyle: spec.dashed ? LineStyle.Dashed : LineStyle.Solid,
          lineWidth: 2
        },
        pane
      )

  series.setData(spec.points.map(point => ({ time: point.time as Time, value: point.value })))

  return series
}

function addPane(chart: IChartApi, pane: PaneSpec, index: number) {
  const series = pane.lines.map(spec => addLine(chart, spec, index))
  const guide = resolveColor('var(--ui-text-quaternary)')

  for (const band of pane.bands) {
    series[0]?.createPriceLine({
      axisLabelVisible: false,
      color: guide,
      lineStyle: LineStyle.Dotted,
      lineWidth: 1,
      price: band,
      title: ''
    })
  }
}

/**
 * Clicks on the price pane as a bar's time and the price under the pointer. Read from the pointer itself:
 * the chart's own click event drops a second click that comes within half a second of the first away from
 * it, which is exactly how a trend line or a Fibonacci gets its second point. A press that pans is no click.
 */
function listenClicks(
  element: HTMLElement,
  chart: IChartApi,
  price: ISeriesApi<'Area' | 'Candlestick'>,
  onClick: (point: ChartPoint) => void
) {
  let down: { x: number; y: number } | null = null

  const press = (event: PointerEvent) => {
    down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null
  }

  const release = (event: PointerEvent) => {
    const moved = down ? Math.abs(event.clientX - down.x) + Math.abs(event.clientY - down.y) : Infinity
    down = null
    const box = element.getBoundingClientRect()
    const x = event.clientX - box.left
    const y = event.clientY - box.top

    if (moved >= 5 || x > chart.timeScale().width() || y > (chart.panes()[0]?.getHeight() ?? 0)) {
      return
    }

    const time = chart.timeScale().coordinateToTime(x)
    const value = price.coordinateToPrice(y)

    if (time !== null && value !== null && value > 0) {
      onClick({ price: value, time: Number(time) })
    }
  }

  element.addEventListener('pointerdown', press)
  element.addEventListener('pointerup', release)

  return () => {
    element.removeEventListener('pointerdown', press)
    element.removeEventListener('pointerup', release)
  }
}

export interface CanvasProps {
  bars: Bar[]
  daily: boolean
  lines: LineSpec[]
  live?: Bar | null
  markers: Marker[]
  mode: ChartMode
  /** A click on the price pane, as the bar's time and the price under the cursor. */
  onClick?: (point: ChartPoint) => void
  /** The bar under the crosshair (null when it leaves the chart). */
  onHover?: (bar: Bar | null) => void
  panes: PaneSpec[]
  priceLines: PriceLineSpec[]
  volume: boolean
}

export function StudioCanvas(props: CanvasProps) {
  const { bars, daily, lines, live, markers, mode, panes, priceLines, volume } = props
  const host = useRef<HTMLDivElement>(null)
  const drawn = useRef<Drawn | null>(null)
  const range = useRef<{ key: string; value: LogicalRange | null }>({ key: '', value: null })
  const handlers = useRef(props)
  handlers.current = props
  const themeTick = useThemeTick()
  const zoomKey = `${bars[0]?.time}:${daily}`

  // The chart is a DOM-bound object kept in a ref, rebuilt whole when what it draws changes.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    const element = host.current

    if (!element || !bars.length) {
      return
    }

    const chart = baseChart(element, daily)
    const price = priceSeries(chart, bars, mode)
    const byTime = new Map(bars.map(bar => [bar.time, bar]))
    lines.forEach(spec => addLine(chart, spec))
    panes.forEach((pane, i) => addPane(chart, pane, i + 1))
    chart
      .panes()
      .slice(1)
      .forEach(pane => pane.setHeight(PANE_HEIGHT))

    for (const level of priceLines) {
      price.createPriceLine({
        axisLabelVisible: true,
        color: level.color,
        lineStyle: level.dashed ? LineStyle.Dashed : LineStyle.Solid,
        lineWidth: 1,
        price: level.price,
        title: level.title
      })
    }

    createSeriesMarkers(
      price,
      [...markers].sort((a, b) => a.time - b.time).map(m => ({ ...m, time: m.time as Time })) as SeriesMarker<Time>[]
    )
    drawn.current = {
      chart,
      last: bars[bars.length - 1].time,
      price,
      volume: volume ? volumeSeries(chart, bars) : null
    }

    const unlisten = listenClicks(element, chart, price, point => handlers.current.onClick?.(point))
    chart.subscribeCrosshairMove(param =>
      handlers.current.onHover?.(param.time === undefined ? null : (byTime.get(Number(param.time)) ?? null))
    )

    if (range.current.key === zoomKey && range.current.value) {
      chart.timeScale().setVisibleLogicalRange(range.current.value)
    } else {
      chart.timeScale().fitContent()
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(value => (range.current = { key: zoomKey, value }))

    return () => {
      unlisten()
      drawn.current = null
      chart.remove()
    }
  }, [bars, daily, lines, markers, mode, panes, priceLines, themeTick, volume, zoomKey])

  useEffect(() => {
    const target = drawn.current

    // The chart refuses a point older than its newest; a tick of the previous candle is simply late.
    if (!live || !target || live.time < target.last) {
      return
    }

    target.price.update(mode === 'candles' ? candle(live) : { time: live.time as Time, value: live.close })
    target.volume?.update({
      color: resolveColor(live.close >= live.open ? 'var(--ui-green)' : 'var(--ui-red)', 0.35),
      time: live.time as Time,
      value: live.volume
    })
    target.last = live.time
  }, [live, mode])

  // The price keeps its own room whatever number of oscillator panes sit under it.
  return (
    <div
      className="flex-1"
      data-portfolio-studio-canvas=""
      ref={host}
      style={{ minHeight: PRICE_HEIGHT + panes.length * PANE_HEIGHT }}
    />
  )
}
