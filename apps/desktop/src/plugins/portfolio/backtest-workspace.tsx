/**
 * Backtesting's chart: the symbol's history over the chosen period (the bars the backtest itself runs on),
 * the strategy's own lines, where it would buy and sell with the current settings — or, once a run of this
 * symbol is open, that run's real trades — and its stop-loss and take-profit as levels, each set by a click
 * on the chart. Period, bar length and the owner's own indicators, drawings and notes are on the chart too.
 */

import { cn, FIGURE_CARD_CLASS, useQuery } from '@hermes/plugin-sdk'
import { useMemo, useState } from 'react'

import { type BacktestRecord, type BacktestRequest, fetchBacktestPrices } from './api'
import { DEFAULT_EXECUTION, executionField, YEARS } from './backtest-strategies'
import { ChartStudio, type PricePick } from './chart-studio'
import { COPY } from './copy'
import { weekly } from './indicators'
import type { Bar } from './market-feed'
import { Segmented } from './segmented'
import { signalsOf, strategyLines, strategyWants } from './strategy-preview'
import type { Marker } from './studio-canvas'
import type { PriceLineSpec } from './studio-model'

const TITLE = 'text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)'
const UP = '#34d399'
const DOWN = '#f87171'

type Target = 'stop' | 'target'

const toBar = ([time, open, high, low, close, volume]: number[]): Bar => ({ close, high, low, open, time, volume: volume ?? 0 })

function buyMarker(time: number): Marker {
  return { color: UP, position: 'belowBar', shape: 'arrowUp', text: COPY.backtest.chart.buy, time }
}

function sellMarker(time: number): Marker {
  return { color: DOWN, position: 'aboveBar', shape: 'arrowDown', text: COPY.backtest.chart.sell, time }
}

/** The run's own trades, moved onto the bars drawn (a weekly chart shows a trade on its week's bar). */
function tradeMarkers(record: BacktestRecord, bars: Bar[]): Marker[] {
  const onBar = (ts: number) => [...bars].reverse().find(bar => bar.time <= ts)?.time ?? ts

  return record.result.trades.flatMap(trade => [
    buyMarker(onBar(trade.entry_ts)),
    ...(trade.exit_ts === null ? [] : [sellMarker(onBar(trade.exit_ts))])
  ])
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step

/** The stop-loss or take-profit percentage a click at `price` means, held to the field's range. */
export function pctFromClick(which: Target, price: number, last: number): number {
  const field = executionField(which === 'stop' ? 'stop_loss_pct' : 'take_profit_pct')
  const raw = which === 'stop' ? ((last - price) / last) * 100 : ((price - last) / last) * 100

  return Math.min(Math.max(roundTo(raw, field.step), Math.max(field.min, field.step)), field.max)
}

function protectionLines(request: BacktestRequest, last: number): PriceLineSpec[] {
  const copy = COPY.backtest.workspace
  const { execution } = request
  const lines: PriceLineSpec[] = []

  if (execution.stop_mode === 'pct' && execution.stop_loss_pct > 0) {
    lines.push({ color: DOWN, dashed: true, price: last * (1 - execution.stop_loss_pct / 100), title: copy.stopLine(execution.stop_loss_pct) })
  }

  if (execution.take_profit_pct > 0) {
    lines.push({ color: UP, dashed: true, price: last * (1 + execution.take_profit_pct / 100), title: copy.targetLine(execution.take_profit_pct) })
  }

  return lines
}

function useHistory(request: BacktestRequest, enabled: boolean) {
  const { data, error, isLoading } = useQuery({
    enabled,
    queryFn: () => fetchBacktestPrices(request.symbol, request.kind, request.years),
    queryKey: ['portfolio', 'backtest', 'prices', request.kind, request.symbol, request.years],
    staleTime: 10 * 60_000
  })

  const daily = useMemo(() => (data?.bars ?? []).map(toBar), [data])
  const bars = useMemo(() => (request.execution.timeframe === '1w' ? weekly(daily) : daily), [daily, request.execution.timeframe])
  const failed = error || data?.error

  return { bars, message: isLoading ? COPY.backtest.workspace.loading : failed ? COPY.backtest.workspace.failed : null }
}

export function BacktestWorkspace({
  canLoad,
  onChange,
  record,
  request
}: {
  /** False while the market-data service is not ready. */
  canLoad: boolean
  onChange: (next: BacktestRequest) => void
  /** The open run, when it is of this symbol: its trades replace the estimated signals. */
  record: BacktestRecord | null
  request: BacktestRequest
}) {
  const copy = COPY.backtest.workspace
  const { bars, message } = useHistory(request, canLoad)
  const [picking, setPicking] = useState<null | Target>(null)
  const [showRun, setShowRun] = useState(true)
  const last = bars[bars.length - 1]?.close ?? 0
  const run = record && record.request.symbol === request.symbol && record.request.kind === request.kind ? record : null

  const extras = useMemo(() => {
    // The open run's trades are drawn with that run's own strategy lines, the estimate with the current settings.
    const basis = run && showRun ? { ...run.request, execution: { ...DEFAULT_EXECUTION, ...run.execution } } : request
    const own = strategyLines(bars, basis.strategy, basis.params, basis.execution)
    const signals = signalsOf(bars, strategyWants(bars, request.strategy, request.params, request.execution))

    const markers = run && showRun
      ? tradeMarkers(run, bars)
      : signals.map(signal => (signal.side === 'buy' ? buyMarker(signal.time) : sellMarker(signal.time)))

    return { buys: signals.filter(s => s.side === 'buy').length, lines: own.lines, markers, panes: own.panes, priceLines: protectionLines(request, last) }
  }, [bars, last, request, run, showRun])

  const pick: null | PricePick = picking
    ? {
        onPick: price => {
          const pct = pctFromClick(picking, price, last)
          const field = picking === 'stop' ? { stop_loss_pct: pct, stop_mode: 'pct' as const } : { take_profit_pct: pct }
          onChange({ ...request, execution: { ...request.execution, ...field } })
          setPicking(null)
        }
      }
    : null

  const pickButton = (which: Target, label: string) => (
    <button
      aria-pressed={picking === which}
      className={cn(
        'h-7 cursor-pointer rounded-full px-3 text-[0.75rem] font-medium transition-colors',
        picking === which ? 'bg-(--card-surface) text-(--ui-text-primary) shadow-(--card-shadow)' : 'bg-(--card-well) text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
      )}
      onClick={() => setPicking(picking === which ? null : which)}
      type="button"
    >
      {label}
    </button>
  )

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'min-h-[36rem] gap-3')} data-portfolio-backtest-workspace="">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={TITLE}>{copy.title(request.symbol)}</div>
          <div className="mt-0.5 max-w-3xl text-[0.75rem] text-(--ui-text-tertiary)">{copy.subtitle}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {run && (
            <Segmented
              label={copy.trades}
              onSelect={value => setShowRun(value === 'run')}
              options={[
                { id: 'run', text: copy.trades },
                { id: 'signals', text: copy.signals }
              ]}
              value={showRun ? 'run' : 'signals'}
            />
          )}
          {!(run && showRun) && <span className="text-[0.75rem] text-(--ui-text-tertiary)">{copy.signalsHint(extras.buys)}</span>}
        </div>
      </div>
      <ChartStudio
        bars={bars}
        controls={
          <>
            {pickButton('stop', copy.setStop)}
            {pickButton('target', copy.setTarget)}
            <Segmented
              label={COPY.backtest.settings.period}
              onSelect={value => onChange({ ...request, years: Number(value) })}
              options={YEARS.map(years => ({ id: String(years), text: COPY.backtest.settings.years(years) }))}
              value={String(request.years)}
            />
            <Segmented
              label={COPY.backtest.execution.timeframe}
              onSelect={timeframe => onChange({ ...request, execution: { ...request.execution, timeframe } })}
              options={(['1d', '1w'] as const).map(id => ({ id, text: COPY.backtest.execution.timeframes[id] }))}
              value={request.execution.timeframe}
            />
          </>
        }
        daily
        empty={canLoad ? message : copy.needService}
        extras={extras}
        kind={request.kind}
        mode="candles"
        pick={pick}
        symbol={request.symbol}
      />
    </div>
  )
}
