/**
 * The chart studio's canvas: candles (or a line) with volume, the indicator lines on the price, each
 * oscillator in its own pane under it, price levels (alerts, supports, Fibonacci, stops) and markers.
 * Rebuilt when what it draws changes, keeping the zoom; the newest candle moves with every tick without a
 * rebuild. Clicks and the crosshair are reported as a time and a price on the price pane.
 */

import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  LineSeries,
  LineStyle,
  type LogicalRange,
  PriceScaleMode,
  type SeriesMarker,
  TickMarkType,
  type Time
} from 'lightweight-charts'
import { useEffect, useRef } from 'react'

import { resolveColor } from './chart-colors'
import type { Hit } from './drawing-model'
import { hitDrawings } from './drawing-model'
import { DrawingLayer } from './drawing-primitive'
import { quotePrice } from './format'
import type { Bar } from './market-feed'
import type { ChartPoint, Drawing, LineSpec, PaneSpec, PriceLineSpec } from './studio-model'
import { useThemeTick } from './use-theme-tick'

/** Candles, OHLC bars, a line of the closes, or the same line with the area under it filled. */
export type ChartMode = 'area' | 'bars' | 'candles' | 'line'

/** Another symbol's closes over this one, both read as a percentage from the first bar on screen. */
export interface CompareLine {
  color: string
  id: string
  label: string
  points: { time: number; value: number }[]
}

/** What the pointer did on the price pane, and what is under it. `moved` is true on release after a drag. */
export interface PointerInfo {
  hit: Hit | null
  moved: boolean
  point: ChartPoint | null
  type: 'down' | 'move' | 'up'
}

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

/** The series of the chart as built, and the data they were last given: when only the data changes (Replay
 *  adds a bar, a note is added) the series are fed in place; the chart is rebuilt only when its shape changes. */
interface Drawn {
  bars: Bar[]
  chart: IChartApi
  compare: ISeriesApi<'Line'>[]
  last: number
  layer: DrawingLayer
  lineSeries: ISeriesApi<'Histogram' | 'Line'>[]
  lines: LineSpec[]
  markers: ISeriesMarkersPluginApi<Time>
  paneSeries: ISeriesApi<'Histogram' | 'Line'>[][]
  panes: PaneSpec[]
  price: PriceSeries
  compareData: CompareLine[]
  volume: ISeriesApi<'Histogram'> | null
}

const linePoints = (points: { time: number; value: number }[]) =>
  points.map(point => ({ time: point.time as Time, value: point.value }))

const volumeData = (bars: Bar[]) =>
  bars.map(bar => ({
    color: resolveColor(bar.close >= bar.open ? 'var(--ui-green)' : 'var(--ui-red)', 0.35),
    time: bar.time as Time,
    value: bar.volume
  }))

const priceData = (bars: Bar[], mode: ChartMode) =>
  mode === 'candles' || mode === 'bars'
    ? bars.map(candle)
    : bars.map(bar => ({ time: bar.time as Time, value: bar.close }))

const sortedMarkers = (markers: Marker[]) =>
  [...markers].sort((a, b) => a.time - b.time).map(m => ({ ...m, time: m.time as Time })) as SeriesMarker<Time>[]

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

type PriceSeries = ISeriesApi<'Area' | 'Bar' | 'Candlestick' | 'Line'>

function priceSeries(chart: IChartApi, bars: Bar[], mode: ChartMode): PriceSeries {
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

  if (mode === 'bars') {
    const series = chart.addSeries(BarSeries, { downColor: down, upColor: up })

    series.setData(bars.map(candle))

    return series
  }

  const tone = bars[bars.length - 1].close >= bars[0].open ? up : down
  const values = bars.map(bar => ({ time: bar.time as Time, value: bar.close }))

  if (mode === 'line') {
    const series = chart.addSeries(LineSeries, { color: tone, lineWidth: 2 })

    series.setData(values)

    return series
  }

  const series = chart.addSeries(AreaSeries, {
    bottomColor: resolveColor('var(--ui-base)', 0),
    lineColor: tone,
    lineWidth: 2,
    topColor: tone.replace(/[\d.]+\)$/, '0.22)')
  })

  series.setData(values)

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

  return series
}

const DRAG_PX = 5

interface PointerSetup {
  chart: IChartApi
  element: HTMLElement
  layer: DrawingLayer
  price: PriceSeries
  /** Read at each event, so it always sees the drawings and the tool as they are now. */
  props: { current: CanvasProps }
}

/**
 * The pointer on the price pane, read from the pointer itself (the chart's own click drops a second click
 * that comes within half a second of the first). Each event goes to the page as a time, a price and what
 * drawing is under it; the page answers a press with whether it takes it (a drawing tool, a handle to drag),
 * and then the chart does not pan until release. A press that takes nothing and does not move is a click.
 */
function listenPointer({ chart, element, layer, price, props }: PointerSetup) {
  let down: { x: number; y: number } | null = null
  let taken = false

  const read = (event: PointerEvent) => {
    const box = element.getBoundingClientRect()
    const x = event.clientX - box.left
    const y = event.clientY - box.top
    const onPane = x >= 0 && x <= chart.timeScale().width() && y >= 0 && y <= (chart.panes()[0]?.getHeight() ?? 0)
    const time = onPane ? chart.timeScale().coordinateToLogical(x) : null
    const value = onPane ? price.coordinateToPrice(y) : null
    const tools = layer.tools()

    const point =
      time !== null && value !== null && value > 0 && tools ? { price: value, time: tools.proj.time(x) ?? 0 } : null

    const { drawings, selectedId } = props.current
    const hit = point && tools ? hitDrawings(drawings, selectedId ?? null, tools.proj, tools.bounds, x, y) : null

    return { hit, onPane, point, x, y }
  }

  const press = (event: PointerEvent) => {
    if (event.button !== 0) {
      down = null

      return
    }

    const { hit, onPane, point } = read(event)
    down = onPane ? { x: event.clientX, y: event.clientY } : null

    if (!onPane || !point) {
      return
    }

    taken = props.current.onPointer?.({ hit, moved: false, point, type: 'down' }) ?? false

    if (taken) {
      chart.applyOptions({ handleScale: false, handleScroll: false })
      element.setPointerCapture?.(event.pointerId)
      element.focus({ preventScroll: true })
    }
  }

  const move = (event: PointerEvent) => {
    const { hit, point } = read(event)

    props.current.onPointer?.({ hit, moved: true, point, type: 'move' })
  }

  const release = (event: PointerEvent) => {
    const moved = down ? Math.abs(event.clientX - down.x) + Math.abs(event.clientY - down.y) >= DRAG_PX : true
    const { hit, onPane, point } = read(event)
    const wasTaken = taken
    const pressed = down
    taken = false
    down = null

    if (wasTaken) {
      chart.applyOptions({ handleScale: true, handleScroll: true })
      element.releasePointerCapture?.(event.pointerId)
      props.current.onPointer?.({ hit, moved, point, type: 'up' })

      return
    }

    if (pressed && onPane && !moved && point) {
      props.current.onClick?.(point)
    }
  }

  element.addEventListener('pointerdown', press)
  element.addEventListener('pointermove', move)
  element.addEventListener('pointerup', release)
  element.addEventListener('pointercancel', release)

  return () => {
    element.removeEventListener('pointerdown', press)
    element.removeEventListener('pointermove', move)
    element.removeEventListener('pointerup', release)
    element.removeEventListener('pointercancel', release)
  }
}

export interface CanvasProps {
  bars: Bar[]
  compare?: CompareLine[]
  daily: boolean
  /** All the drawings as they are now (one being dragged shows where it is going). */
  drawings: Drawing[]
  hoverId?: null | string
  lines: LineSpec[]
  live?: Bar | null
  markers: Marker[]
  mode: ChartMode
  /** A click that took nothing: the bar's time and the price under the cursor. */
  onClick?: (point: ChartPoint) => void
  /** The bar under the crosshair (null when it leaves the chart). */
  onHover?: (bar: Bar | null) => void
  /** Return true from a press to take it: the chart then does not pan until the pointer is released. */
  onPointer?: (event: PointerInfo) => boolean | void
  panes: PaneSpec[]
  /** The drawing being made, between its first click and its second. */
  preview?: Drawing | null
  priceLines: PriceLineSpec[]
  selectedId?: null | string
  volume: boolean
}

/** What decides the chart's shape: when it changes the chart is rebuilt, otherwise the data is fed in place. */
function shapeOf(props: CanvasProps, themeTick: unknown): string {
  return JSON.stringify([
    props.mode,
    props.daily,
    props.volume,
    props.bars.length > 0,
    props.bars[0]?.time,
    themeTick,
    props.compare?.map(other => [other.id, other.color, other.label]),
    props.lines.map(line => [line.id, line.color, line.dashed, line.histogram]),
    props.panes.map(pane => [
      pane.id,
      pane.bands,
      pane.lines.map(line => [line.id, line.color, line.dashed, line.histogram])
    ]),
    props.priceLines
  ])
}

export function StudioCanvas(props: CanvasProps) {
  const { bars, compare, daily, lines, live, markers, mode, panes } = props
  const host = useRef<HTMLDivElement>(null)
  const drawn = useRef<Drawn | null>(null)
  const range = useRef<{ key: string; value: LogicalRange | null }>({ key: '', value: null })
  const handlers = useRef(props)
  handlers.current = props
  const themeTick = useThemeTick()
  const zoomKey = `${bars[0]?.time}:${daily}`
  const shape = shapeOf(props, themeTick)
  const byTime = useRef(new Map<number, Bar>())

  // The chart is a DOM-bound object kept in a ref, rebuilt whole only when its shape changes (a series added
  // or removed, another type, a theme): data that only grows — Replay's next bar — goes in below, in place.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    const element = host.current
    const now = handlers.current

    if (!element || !now.bars.length) {
      return
    }

    const chart = baseChart(element, now.daily)
    const price = priceSeries(chart, now.bars, now.mode)
    byTime.current = new Map(now.bars.map(bar => [bar.time, bar]))
    const other: ISeriesApi<'Line'>[] = []

    // Several symbols on one chart are read as percentages from the first bar on screen, as TradingView does.
    if (now.compare?.length) {
      price.priceScale().applyOptions({ mode: PriceScaleMode.Percentage })

      for (const entry of now.compare) {
        const series = chart.addSeries(LineSeries, {
          color: entry.color,
          lastValueVisible: true,
          lineWidth: 2,
          priceLineVisible: false,
          title: entry.label
        })

        series.setData(linePoints(entry.points))
        other.push(series)
      }
    }

    const lineSeries = now.lines.map(spec => addLine(chart, spec))
    const paneSeries = now.panes.map((pane, i) => addPane(chart, pane, i + 1))
    chart
      .panes()
      .slice(1)
      .forEach(pane => pane.setHeight(PANE_HEIGHT))

    for (const level of now.priceLines) {
      price.createPriceLine({
        axisLabelVisible: true,
        color: level.color,
        lineStyle: level.dashed ? LineStyle.Dashed : LineStyle.Solid,
        lineWidth: 1,
        price: level.price,
        title: level.title
      })
    }

    const plugin = createSeriesMarkers(price, sortedMarkers(now.markers))
    const layer = new DrawingLayer(now.bars.map(bar => bar.time))
    price.attachPrimitive(layer)
    layer.set({
      drawings: now.drawings,
      hoverId: now.hoverId ?? null,
      preview: now.preview ?? null,
      selectedId: now.selectedId ?? null
    })

    drawn.current = {
      bars: now.bars,
      chart,
      compare: other,
      compareData: now.compare ?? [],
      last: now.bars[now.bars.length - 1].time,
      layer,
      lineSeries,
      lines: now.lines,
      markers: plugin,
      paneSeries,
      panes: now.panes,
      price,
      volume: now.volume ? volumeSeries(chart, now.bars) : null
    }

    const unlisten = listenPointer({ chart, element, layer, price, props: handlers })
    chart.subscribeCrosshairMove(param =>
      handlers.current.onHover?.(param.time === undefined ? null : (byTime.current.get(Number(param.time)) ?? null))
    )

    if (range.current.key === zoomKey && range.current.value) {
      chart.timeScale().setVisibleLogicalRange(range.current.value)
    } else {
      chart.timeScale().fitContent()
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(value => (range.current = { key: zoomKey, value }))

    // A chart that showed all its bars shows them all again when the card is resized (full screen).
    const resizing = new ResizeObserver(() =>
      requestAnimationFrame(() => {
        const visible = chart.timeScale().getVisibleLogicalRange()
        const total = drawn.current?.bars.length ?? 0

        if (visible && visible.from <= 0.5 && visible.to >= total - 1.5) {
          chart.timeScale().fitContent()
        }
      })
    )

    resizing.observe(element)

    return () => {
      resizing.disconnect()
      unlisten()
      drawn.current = null
      chart.remove()
    }
    // `shape` stands for everything that makes the chart a different chart
     
  }, [shape, zoomKey])

  // New data in the same shape — the next Replay bar, an indicator that moved — feeds the series in place, so
  // nothing is torn down and nothing flickers; a view parked at the newest bar follows it.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    const target = drawn.current

    if (
      !target ||
      (target.bars === bars && target.compareData === compare && target.lines === lines && target.panes === panes)
    ) {
      return
    }

    const scale = target.chart.timeScale()
    const visible = scale.getVisibleLogicalRange()
    const before = target.bars.length
    const atEnd = visible ? visible.to >= before - 1 : false

    target.bars = bars
    target.compareData = compare ?? []
    target.lines = lines
    target.panes = panes
    byTime.current = new Map(bars.map(bar => [bar.time, bar]))
    target.price.setData(priceData(bars, mode) as never)
    target.volume?.setData(volumeData(bars))
    compare?.forEach((entry, i) => target.compare[i]?.setData(linePoints(entry.points)))
    lines.forEach((spec, i) => target.lineSeries[i]?.setData(linePoints(spec.points)))
    panes.forEach((pane, i) =>
      pane.lines.forEach((spec, j) => target.paneSeries[i]?.[j]?.setData(linePoints(spec.points)))
    )
    target.layer.setTimes(bars.map(bar => bar.time))
    target.last = bars[bars.length - 1]?.time ?? target.last

    if (visible && atEnd) {
      scale.setVisibleLogicalRange({
        from: visible.from + (bars.length - before),
        to: visible.to + (bars.length - before)
      })
    }
  }, [bars, compare, lines, mode, panes])

   
  useEffect(() => {
    drawn.current?.markers.setMarkers(sortedMarkers(markers))
  }, [markers])

  // The drawings repaint on their own, without rebuilding the chart (which would drop a drag in progress).
   
  useEffect(() => {
    drawn.current?.layer.set({
      drawings: props.drawings,
      hoverId: props.hoverId ?? null,
      preview: props.preview ?? null,
      selectedId: props.selectedId ?? null
    })
  }, [props.drawings, props.hoverId, props.preview, props.selectedId, shape])

   
  useEffect(() => {
    const target = drawn.current

    // The chart refuses a point older than its newest; a tick of the previous candle is simply late.
    if (!live || !target || live.time < target.last) {
      return
    }

    const ohlc = mode === 'candles' || mode === 'bars'

    target.price.update(ohlc ? candle(live) : { time: live.time as Time, value: live.close })
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
      className="flex-1 outline-none"
      data-portfolio-studio-canvas=""
      ref={host}
      style={{ minHeight: PRICE_HEIGHT + panes.length * PANE_HEIGHT }}
      tabIndex={-1}
    />
  )
}
