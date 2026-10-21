/**
 * A coin's chart, TradingView style: candles or a line with volume under them, local time, and the
 * newest candle moving with every trade. History is drawn once per symbol and interval; ticks only
 * update the last candle, so the chart never flickers or rescales under the cursor.
 */

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  type ISeriesApi,
  TickMarkType,
  type Time
} from 'lightweight-charts'
import { useEffect, useRef } from 'react'

import { resolveColor } from './chart-colors'
import { quotePrice } from './format'
import type { Bar } from './market-feed'
import { useThemeTick } from './use-theme-tick'

export type ChartMode = 'candles' | 'line'

const clock = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit' })
const day = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' })
const full = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' })

const at = (time: Time) => new Date(Number(time) * 1000)

interface Drawn {
  last: number
  price: ISeriesApi<'Area' | 'Candlestick'>
  volume: ISeriesApi<'Histogram'>
}

const candle = ({ close, high, low, open, time }: Bar) => ({ close, high, low, open, time: time as Time })

export function LiveChart({ bars, live, mode }: { bars: Bar[]; live: Bar | null; mode: ChartMode }) {
  const host = useRef<HTMLDivElement>(null)
  const drawn = useRef<Drawn | null>(null)
  const themeTick = useThemeTick()

  // The chart instance lives in a ref: it is a DOM-bound object, not reactive state.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    const element = host.current

    if (!element || !bars.length) {
      return
    }

    const up = resolveColor('var(--ui-green)')
    const down = resolveColor('var(--ui-red)')
    const gain = bars[bars.length - 1].close >= bars[0].open
    const tone = gain ? up : down

    const chart = createChart(element, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      grid: { horzLines: { color: resolveColor('var(--card-well-stroke)') }, vertLines: { visible: false } },
      layout: {
        attributionLogo: false,
        background: { color: 'transparent', type: ColorType.Solid },
        fontSize: 11,
        textColor: resolveColor('var(--ui-text-tertiary)')
      },
      localization: { priceFormatter: quotePrice, timeFormatter: (time: Time) => full.format(at(time)) },
      rightPriceScale: { borderVisible: false, scaleMargins: { bottom: 0.25, top: 0.08 } },
      timeScale: {
        borderVisible: false,
        rightOffset: 4,
        tickMarkFormatter: (time: Time, type: TickMarkType) =>
          type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds
            ? clock.format(at(time))
            : day.format(at(time)),
        timeVisible: true
      }
    })

    const price =
      mode === 'candles'
        ? chart.addSeries(CandlestickSeries, {
            borderVisible: false,
            downColor: down,
            priceLineVisible: true,
            upColor: up,
            wickDownColor: down,
            wickUpColor: up
          })
        : chart.addSeries(AreaSeries, {
            bottomColor: resolveColor('var(--ui-base)', 0),
            lineColor: tone,
            lineWidth: 2,
            topColor: tone.replace(/[\d.]+\)$/, '0.22)')
          })

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      priceScaleId: ''
    })

    volume.priceScale().applyOptions({ scaleMargins: { bottom: 0, top: 0.82 } })

    price.setData(
      mode === 'candles' ? bars.map(candle) : bars.map(bar => ({ time: bar.time as Time, value: bar.close }))
    )

    volume.setData(
      bars.map(bar => ({
        color: resolveColor(bar.close >= bar.open ? 'var(--ui-green)' : 'var(--ui-red)', 0.35),
        time: bar.time as Time,
        value: bar.volume
      }))
    )

    chart.timeScale().fitContent()
    drawn.current = { last: bars[bars.length - 1].time, price, volume }

    return () => {
      drawn.current = null
      chart.remove()
    }
  }, [bars, mode, themeTick])

  useEffect(() => {
    const target = drawn.current

    // The chart refuses a point older than its newest; a tick of the previous candle is simply late.
    if (!live || !target || live.time < target.last) {
      return
    }

    target.price.update(mode === 'candles' ? candle(live) : { time: live.time as Time, value: live.close })
    target.volume.update({
      color: resolveColor(live.close >= live.open ? 'var(--ui-green)' : 'var(--ui-red)', 0.35),
      time: live.time as Time,
      value: live.volume
    })
    target.last = live.time
  }, [live, mode])

  return <div className="min-h-80 flex-1" ref={host} />
}
