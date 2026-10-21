/**
 * A backtest's chart, TradingView style: either the strategy's value beside buy-and-hold's, or the
 * price with an arrow at every buy and sell. Daily points, so the axis reads in days (UTC dates).
 */

import { ColorType, createChart, createSeriesMarkers, CrosshairMode, LineSeries, type Time } from 'lightweight-charts'
import { useEffect, useRef } from 'react'

import type { BacktestRecord } from './api'
import { resolveColor } from './chart-colors'
import { COPY } from './copy'
import { quotePrice } from './format'
import { useThemeTick } from './use-theme-tick'

export type BacktestView = 'equity' | 'price'

const dayLabel = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC', year: 'numeric' })
const tickLabel = new Intl.DateTimeFormat('ro-RO', { month: 'short', timeZone: 'UTC', year: '2-digit' })

const points = (rows: [number, number][]) => rows.map(([time, value]) => ({ time: time as Time, value }))

function markersFor(record: BacktestRecord, up: string, down: string) {
  const copy = COPY.backtest.chart

  return record.result.trades.flatMap(trade => [
    {
      color: up,
      position: 'belowBar' as const,
      shape: 'arrowUp' as const,
      text: copy.buy,
      time: trade.entry_ts as Time
    },
    ...(trade.exit_ts === null
      ? []
      : [
          {
            color: down,
            position: 'aboveBar' as const,
            shape: 'arrowDown' as const,
            text: copy.sell,
            time: trade.exit_ts as Time
          }
        ])
  ])
}

export function BacktestChart({ record, view }: { record: BacktestRecord; view: BacktestView }) {
  const host = useRef<HTMLDivElement>(null)
  const themeTick = useThemeTick()

  useEffect(() => {
    const element = host.current

    if (!element) {
      return
    }

    const up = resolveColor('var(--ui-green)')
    const down = resolveColor('var(--ui-red)')
    const primary = resolveColor('var(--ui-blue)')
    const muted = resolveColor('var(--ui-text-tertiary)')

    const chart = createChart(element, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      grid: { horzLines: { color: resolveColor('var(--card-well-stroke)') }, vertLines: { visible: false } },
      layout: {
        attributionLogo: false,
        background: { color: 'transparent', type: ColorType.Solid },
        fontSize: 11,
        textColor: muted
      },
      localization: {
        priceFormatter: quotePrice,
        timeFormatter: (time: Time) => dayLabel.format(new Date(Number(time) * 1000))
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time: Time) => tickLabel.format(new Date(Number(time) * 1000))
      }
    })

    if (view === 'equity') {
      chart
        .addSeries(LineSeries, {
          color: muted,
          lineStyle: 2,
          lineWidth: 2,
          priceLineVisible: false,
          title: COPY.backtest.chart.benchmark
        })
        .setData(points(record.benchmark.curve))
      chart
        .addSeries(LineSeries, {
          color: primary,
          lineWidth: 2,
          priceLineVisible: false,
          title: COPY.backtest.chart.strategy
        })
        .setData(points(record.result.curve))
    } else {
      const price = chart.addSeries(LineSeries, { color: primary, lineWidth: 2, priceLineVisible: false })
      price.setData(points(record.prices))
      createSeriesMarkers(price, markersFor(record, up, down))
    }

    chart.timeScale().fitContent()

    return () => chart.remove()
  }, [record, themeTick, view])

  return <div className="min-h-80 flex-1" ref={host} />
}
