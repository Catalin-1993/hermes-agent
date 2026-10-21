/**
 * The portfolio's value over time, drawn like TradingView: a line or daily candles, one switch apart,
 * over 1 week to everything. The canvas takes its colours from the theme at draw time, so a theme
 * change redraws it. Candles need the data service's daily bars; without them the switch says why.
 */

import { cn, FIGURE_CARD_CLASS } from '@hermes/plugin-sdk'
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  type MouseEventParams,
  type Time
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'

import { resolveColor } from './chart-colors'
import { COPY } from './copy'
import { dateLabel, euro } from './format'
import { Segmented } from './segmented'
import { type Candle, isGain, lastDays, type Range, RANGE_DAYS, type ValuePoint } from './series'
import { useThemeTick } from './use-theme-tick'

type Mode = 'candles' | 'line'

const RANGES: Range[] = ['1w', '1m', '3m', 'all']

interface Hover {
  candle?: Candle
  date: string
  value?: number
}

function Legend({ hover }: { hover: Hover }) {
  const copy = COPY.chart

  if (hover.candle) {
    const { close, high, low, open } = hover.candle

    return (
      <div className="flex flex-wrap gap-x-3 text-[0.75rem] tabular-nums text-(--ui-text-secondary)">
        <span className="text-(--ui-text-tertiary)">{dateLabel(hover.date)}</span>
        <span>
          {copy.open} {euro(open, 0)}
        </span>
        <span>
          {copy.high} {euro(high, 0)}
        </span>
        <span>
          {copy.low} {euro(low, 0)}
        </span>
        <span>
          {copy.close} {euro(close, 0)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex gap-x-3 text-[0.75rem] tabular-nums text-(--ui-text-secondary)">
      <span className="text-(--ui-text-tertiary)">{dateLabel(hover.date)}</span>
      <span>{euro(hover.value ?? 0, 0)}</span>
    </div>
  )
}

export function PortfolioChart({ candles, history }: { candles: Candle[]; history: ValuePoint[] }) {
  const copy = COPY.chart
  const canCandle = candles.length > 1
  const [mode, setMode] = useState<Mode>('line')
  const [range, setRange] = useState<Range>('all')
  const [hover, setHover] = useState<Hover | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const themeTick = useThemeTick()
  const shownMode: Mode = canCandle ? mode : 'line'
  // Memoised: the effect below redraws the canvas whenever they change, and hovering must not.
  const points = useMemo(() => lastDays(history, RANGE_DAYS[range]), [history, range])
  const bars = useMemo(() => lastDays(candles, RANGE_DAYS[range]), [candles, range])

  useEffect(() => {
    const element = host.current

    if (!element || points.length < 2) {
      return
    }

    const text = resolveColor('var(--ui-text-tertiary)')
    const grid = resolveColor('var(--card-well-stroke)')
    const up = resolveColor('var(--ui-green)')
    const down = resolveColor('var(--ui-red)')
    const tone = isGain(points) ? up : down

    const chart = createChart(element, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      grid: { horzLines: { color: grid }, vertLines: { visible: false } },
      layout: {
        attributionLogo: false,
        background: { color: 'transparent', type: ColorType.Solid },
        fontSize: 11,
        textColor: text
      },
      localization: {
        locale: 'ro-RO',
        priceFormatter: (price: number) => euro(price, 0)
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true }
    })

    if (shownMode === 'candles') {
      const series = chart.addSeries(CandlestickSeries, {
        borderVisible: false,
        downColor: down,
        priceLineVisible: false,
        upColor: up,
        wickDownColor: down,
        wickUpColor: up
      })

      series.setData(bars.map(({ close, date, high, low, open }) => ({ close, high, low, open, time: date as Time })))
    } else {
      const series = chart.addSeries(AreaSeries, {
        bottomColor: resolveColor('var(--ui-base)', 0),
        lineColor: tone,
        lineWidth: 2,
        priceLineVisible: false,
        topColor: tone.replace(/[\d.]+\)$/, '0.22)')
      })

      series.setData(points.map(point => ({ time: point.date as Time, value: point.value })))
    }

    chart.timeScale().fitContent()

    const byDate = new Map(bars.map(bar => [bar.date, bar]))
    const valueByDate = new Map(points.map(point => [point.date, point.value]))

    const onMove = (event: MouseEventParams<Time>) => {
      const date = typeof event.time === 'string' ? event.time : null

      if (!date) {
        return setHover(null)
      }

      setHover(shownMode === 'candles' ? { candle: byDate.get(date), date } : { date, value: valueByDate.get(date) })
    }

    chart.subscribeCrosshairMove(onMove)

    return () => {
      chart.unsubscribeCrosshairMove(onMove)
      chart.remove()
    }
  }, [bars, points, shownMode, themeTick])

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'h-full gap-3')} data-portfolio-chart={shownMode}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)">
            {copy.title}
          </div>
          <div className="mt-0.5 min-h-4 text-[0.75rem] text-(--ui-text-tertiary)">
            {hover && (hover.candle || hover.value !== undefined) ? (
              <Legend hover={hover} />
            ) : shownMode === 'candles' ? (
              copy.candlesNote
            ) : (
              copy.lineNote
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label={copy.mode}
            onSelect={setMode}
            options={[
              { id: 'line', text: copy.line },
              {
                disabled: !canCandle,
                id: 'candles',
                text: copy.candles,
                title: canCandle ? undefined : copy.candlesMissing
              }
            ]}
            value={shownMode}
          />
          <Segmented
            label={copy.range}
            onSelect={setRange}
            options={RANGES.map(id => ({ id, text: copy.ranges[id] }))}
            value={range}
          />
        </div>
      </div>
      {points.length < 2 ? (
        <div className="grid min-h-64 flex-1 place-items-center text-[0.8125rem] text-(--ui-text-tertiary)">
          {COPY.dashboard.historyWaiting}
        </div>
      ) : (
        <div className="min-h-64 flex-1" ref={host} />
      )}
    </div>
  )
}
