/**
 * The dashboard's main card: the portfolio's value as a large serif number with its change, the value over
 * time drawn like TradingView — a line or daily candles, one switch apart, over 1 week to everything — and
 * the strip of figures under it (today, cash, invested, fees). The canvas takes its colours from the theme
 * at draw time, so a theme change redraws it. Candles need the data service's daily bars; without them the
 * switch says why.
 */

import { cn, Codicon } from '@hermes/plugin-sdk'
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  type ISeriesApi,
  LineStyle,
  type MouseEventParams,
  type Time
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { PortfolioDashboard } from './api'
import { resolveColor } from './chart-colors'
import { MODE_ICON } from './chart-topbar'
import { COPY } from './copy'
import { dateLabel, euro, percent, signedEuro, toneClass } from './format'
import { type Candle, isGain, lastDays, type Range, RANGE_DAYS } from './series'
import { PickMenu } from './studio-toolbar'
import { StatStrip } from './summary'
import { BTN, CARD, DISPLAY, MUTED, toneFill } from './ui'
import { useThemeTick } from './use-theme-tick'

type Mode = 'candles' | 'line'

const RANGES: Range[] = ['1w', '1m', '3m', 'all']
const dayMonth = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC' })

interface Hover {
  candle?: Candle
  date: string
  value?: number
}

/** The axis label of a daily bar: "19 oct." — the chart hands a day over as a string, a date object or seconds. */
function dayLabel(time: Time): string {
  const date =
    typeof time === 'string'
      ? new Date(`${time}T00:00:00Z`)
      : typeof time === 'number'
        ? new Date(time * 1000)
        : new Date(Date.UTC(time.year, time.month - 1, time.day))

  return dayMonth.format(date)
}

function Legend({ hover }: { hover: Hover }) {
  const copy = COPY.chart

  if (hover.candle) {
    const { close, high, low, open } = hover.candle

    return (
      <span className="flex flex-wrap justify-end gap-x-3 tabular-nums text-(--ui-text-secondary)">
        <span className={MUTED}>{dateLabel(hover.date)}</span>
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
      </span>
    )
  }

  return (
    <span className="flex gap-x-3 tabular-nums text-(--ui-text-secondary)">
      <span className={MUTED}>{dateLabel(hover.date)}</span>
      <span>{euro(hover.value ?? 0, 0)}</span>
    </span>
  )
}

export function PortfolioValueCard({ data }: { data: PortfolioDashboard }) {
  const copy = COPY.chart
  const { candles, history } = data
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
        fontSize: 11.5,
        textColor: text
      },
      localization: {
        locale: 'ro-RO',
        priceFormatter: (price: number) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(price)
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { bottom: 0.08, top: 0.08 } },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time: Time) => dayLabel(time)
      }
    })

    const price: ISeriesApi<'Area' | 'Candlestick'> = (() => {
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

        return series
      }

      const series = chart.addSeries(AreaSeries, {
        bottomColor: resolveColor('var(--ui-base)', 0),
        lineColor: tone,
        lineWidth: 2,
        priceLineVisible: false,
        topColor: tone.replace(/[\d.]+\)$/, '0.22)')
      })

      series.setData(points.map(point => ({ time: point.date as Time, value: point.value })))

      return series
    })()

    // Where the portfolio started, so the eye sees at once whether it is above or below it.
    price.createPriceLine({
      axisLabelVisible: false,
      color: resolveColor('var(--ui-text-quaternary)'),
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      price: data.capital,
      title: copy.start(euro(data.capital, 0))
    })

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
  }, [bars, copy, data.capital, points, shownMode, themeTick])

  return (
    <section aria-label={copy.title} className={cn(CARD, 'overflow-hidden')} data-portfolio-chart={shownMode}>
      <div className="flex flex-wrap items-start justify-between gap-5 px-6 pt-5 pb-1">
        <div className="flex min-w-0 flex-col gap-3">
          <span className={cn('text-[0.8125rem]', MUTED)}>{COPY.dashboard.total}</span>
          <div
            className={cn(
              DISPLAY,
              'text-[3.25rem] leading-[0.92] tracking-[-0.02em] tabular-nums text-(--ui-text-primary) sm:text-[4.75rem]'
            )}
            data-portfolio-total=""
          >
            {euro(data.total, 2)}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.84375rem] font-medium tabular-nums',
                toneFill(data.pnl),
                toneClass(data.pnl)
              )}
            >
              {data.pnl !== 0 && <Codicon name={data.pnl > 0 ? 'arrow-up' : 'arrow-down'} size="0.75rem" />}
              {signedEuro(data.pnl)} · {percent(data.pnl_pct, true)}
            </span>
            <span className={cn('text-[0.84375rem]', MUTED)}>{COPY.dashboard.sinceStart(dateLabel(data.started))}</span>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_26rem] sm:max-w-[48%]">
          <StatStrip data={data} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 pt-4">
        <div className="flex items-center gap-2">
          <PickMenu
            label={copy.mode}
            onPick={setMode}
            options={[
              { icon: MODE_ICON.line, id: 'line', text: copy.line },
              { disabled: !canCandle, icon: MODE_ICON.candles, id: 'candles', text: copy.candles }
            ]}
            triggerClass={BTN}
            value={shownMode}
            width="w-44"
          >
            {MODE_ICON[shownMode]}
            {shownMode === 'candles' ? copy.candles : copy.line}
            <Codicon className="opacity-60" name="chevron-down" size="0.75rem" />
          </PickMenu>
          <PickMenu
            label={copy.range}
            onPick={setRange}
            options={RANGES.map(id => ({ id, text: copy.rangeNames[id] }))}
            triggerClass={BTN}
            value={range}
            width="w-44"
          >
            {copy.ranges[range]}
            <Codicon className="opacity-60" name="chevron-down" size="0.75rem" />
          </PickMenu>
        </div>
        <div className={cn('min-h-4 text-[0.78125rem]', MUTED)}>
          {hover && (hover.candle || hover.value !== undefined) ? (
            <Legend hover={hover} />
          ) : !canCandle ? (
            copy.candlesMissing
          ) : shownMode === 'candles' ? (
            copy.candlesNote
          ) : (
            copy.lineNote
          )}
        </div>
      </div>
      <div className="px-6 pt-2.5 pb-5">
        {points.length < 2 ? (
          <div className={cn('grid h-60 place-items-center text-[0.8125rem]', MUTED)}>
            {COPY.dashboard.historyWaiting}
          </div>
        ) : (
          <div className="h-60" ref={host} />
        )}
      </div>
    </section>
  )
}
