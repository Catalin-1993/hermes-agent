/**
 * The chart's drawing layer: a lightweight-charts primitive that paints the owner's drawings (trend lines,
 * rays, levels, boxes, Fibonacci) on the price pane, the one being made, and the handles of the selected
 * one. The chart calls it on every zoom, scroll and price change, so the drawings stay where they were put.
 * It paints from `geometry` (`drawing-model.ts`), which the pointer handling shares for hit testing.
 */

import type {
  IChartApi,
  IPrimitivePaneRenderer,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  Time
} from 'lightweight-charts'

import {
  type Bounds,
  DRAWING_COLOR,
  geometry,
  HANDLE_RADIUS,
  logicalToTime,
  type Projector,
  timeToLogical
} from './drawing-model'
import type { Drawing } from './studio-model'

type Target = Parameters<IPrimitivePaneRenderer['draw']>[0]

export interface DrawingLayerState {
  drawings: readonly Drawing[]
  /** The one under the pointer, when it is not the selected one. */
  hoverId: null | string
  /** What is being made right now (from the first click to the second). */
  preview: Drawing | null
  selectedId: null | string
}

const EMPTY: DrawingLayerState = { drawings: [], hoverId: null, preview: null, selectedId: null }

/** The time and price of a pixel on a chart whose bars are at `times` — what the pointer handling asks. */
export function projectorFor(
  chart: IChartApi,
  series: ISeriesApi<'Area' | 'Bar' | 'Candlestick' | 'Line'>,
  times: () => readonly number[]
): Projector {
  const scale = chart.timeScale()

  return {
    price: y => series.coordinateToPrice(y),
    time: x => {
      const logical = scale.coordinateToLogical(x)

      return logical === null ? null : logicalToTime(times(), logical)
    },
    x: time => scale.logicalToCoordinate(timeToLogical(times(), time) as Logical),
    y: price => series.priceToCoordinate(price)
  }
}

export class DrawingLayer implements ISeriesPrimitive<Time> {
  private bounds: Bounds = { height: 0, width: 0 }
  private proj: null | Projector = null
  private request: () => void = () => undefined
  private state: DrawingLayerState = EMPTY

  constructor(
    private times: readonly number[],
    private readonly fallbackColor: string = DRAWING_COLOR
  ) {}

  /** The bar times the chart now has (Replay and live ticks add bars without rebuilding the chart). */
  setTimes(times: readonly number[]) {
    this.times = times
  }

  attached({ chart, requestUpdate, series }: SeriesAttachedParameter<Time>) {
    this.request = requestUpdate
    this.proj = projectorFor(chart as IChartApi, series as ISeriesApi<'Candlestick'>, () => this.times)
    this.measure = () => ({ height: chart.paneSize(0).height, width: chart.paneSize(0).width })
  }

  detached() {
    this.proj = null
    this.request = () => undefined
  }

  private measure: () => Bounds = () => this.bounds

  /** Repaints with what the owner is doing now (a drawing being dragged, the selection, the hover). */
  set(state: DrawingLayerState) {
    this.state = state
    this.request()
  }

  /** The projector the pointer handling uses, and the pane it measures against; null until attached. */
  tools(): null | { bounds: Bounds; proj: Projector } {
    return this.proj ? { bounds: this.measure(), proj: this.proj } : null
  }

  paneViews() {
    const layer = this

    return [
      {
        renderer(): IPrimitivePaneRenderer {
          return {
            draw(target: Target) {
              layer.paint(target)
            }
          }
        },
        zOrder: () => 'top' as const
      }
    ]
  }

  private paint(target: Target) {
    const proj = this.proj

    if (!proj) {
      return
    }

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const bounds = { height: mediaSize.height, width: mediaSize.width }
      this.bounds = bounds
      const { drawings, hoverId, preview, selectedId } = this.state

      for (const drawing of [...drawings, ...(preview ? [preview] : [])]) {
        const shape = geometry(drawing, proj, bounds)

        if (!shape) {
          continue
        }

        const color = drawing.color ?? this.fallbackColor
        const active = drawing.id === selectedId || drawing.id === hoverId

        context.save()
        context.strokeStyle = color
        context.fillStyle = color
        context.lineWidth = active ? 2 : 1.5
        context.lineCap = 'round'

        if (shape.fill) {
          context.globalAlpha = 0.12
          context.fillRect(shape.fill.x1, shape.fill.y1, shape.fill.x2 - shape.fill.x1, shape.fill.y2 - shape.fill.y1)
          context.globalAlpha = 1
        }

        if (shape.levels) {
          paintLevels(context, shape.levels, color)
        }

        if (preview && drawing.id === preview.id) {
          context.setLineDash([5, 4])
        } else if (shape.levels) {
          context.setLineDash([4, 4])
        }

        for (const [a, b] of shape.segments) {
          context.beginPath()
          context.moveTo(a.x, a.y)
          context.lineTo(b.x, b.y)
          context.stroke()
        }

        context.restore()

        if (drawing.id === selectedId) {
          for (const handle of shape.handles) {
            context.save()
            context.beginPath()
            context.arc(handle.x, handle.y, HANDLE_RADIUS, 0, Math.PI * 2)
            context.fillStyle = '#ffffff'
            context.fill()
            context.lineWidth = 2
            context.strokeStyle = color
            context.stroke()
            context.restore()
          }
        }
      }
    })
  }
}

const price = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 })

/** Fibonacci: a band between each pair of levels, a line and a "0.618 (price)" label on each. */
function paintLevels(
  context: CanvasRenderingContext2D,
  levels: { price: number; ratio: number; x1: number; x2: number; y: number }[],
  color: string
) {
  context.save()
  context.font = '11px system-ui, sans-serif'
  context.textBaseline = 'bottom'

  levels.forEach((level, i) => {
    const next = levels[i + 1]

    if (next) {
      context.globalAlpha = 0.06 + (i % 2) * 0.04
      context.fillRect(level.x1, Math.min(level.y, next.y), level.x2 - level.x1, Math.abs(next.y - level.y))
    }

    context.globalAlpha = 0.85
    context.setLineDash(level.ratio === 0 || level.ratio === 1 ? [] : [4, 4])
    context.beginPath()
    context.moveTo(level.x1, level.y)
    context.lineTo(level.x2, level.y)
    context.lineWidth = 1
    context.strokeStyle = color
    context.stroke()
    context.setLineDash([])
    context.globalAlpha = 1
    context.fillStyle = color
    context.fillText(`${level.ratio} (${price.format(level.price)})`, level.x1 + 4, level.y - 2)
  })

  context.restore()
}
