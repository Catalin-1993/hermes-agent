/** The chart side of the Watchlist: the selected coin or stock, its numbers, and a TradingView-style chart —
 *  with the view menu beside the symbol's name (Chart, Derivatives, Technicals, Seasonals, News, Community). */

import { cn } from '@hermes/plugin-sdk'
import { useMemo, useState } from 'react'

import { levelsFor } from './alert-rules'
import { AlertButton, useAlerts } from './alerts'
import type { WatchKind } from './api'
import { AnalysisView } from './analysis-views'
import { AssetIcon } from './asset-icon'
import { ChartStudio } from './chart-studio'
import { ChartTypeMenu, CompareButton, IntervalMenu, type View, ViewMenu } from './chart-topbar'
import { COMPARE_COLORS, resampleCloses } from './compare'
import { COPY } from './copy'
import { percent, quotePrice, shortAmount, toneClass } from './format'
import { MarketDataCard } from './market-data-card'
import { type Bar, DAY_INTERVALS, type Interval, INTERVALS } from './market-feed'
import type { ChartMode, CompareLine } from './studio-canvas'
import type { CompareRef } from './studio-model'
import type { Pick } from './symbol-picker'
import { SymbolSearch } from './symbol-search'
import { CARD, toneFill } from './ui'
import { intervalsFor, useBars } from './use-bars'
import { useChartDoc } from './use-chart-doc'
import type { FeedStatus, MarketFeed } from './use-market-feed'
import { serviceReady, type StockFeed } from './use-stock-feed'

const NO_BARS: Bar[] = []
const NO_LINES: CompareLine[] = []

function StatusDot({ kind, onRetry, status }: { kind: WatchKind; onRetry: () => void; status: FeedStatus }) {
  const copy = COPY.watchlist.status

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        status === 'live' && 'bg-[color-mix(in_srgb,var(--ui-green)_10%,transparent)] text-(--ui-green)',
        status === 'connecting' && 'bg-(--card-well) text-(--ui-yellow)',
        status === 'offline' && 'bg-[color-mix(in_srgb,var(--ui-red)_10%,transparent)] text-(--ui-red)'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full bg-current',
          status === 'live' && 'shadow-[0_0_0_3px_color-mix(in_srgb,var(--ui-green)_20%,transparent)]',
          status === 'connecting' && 'animate-pulse'
        )}
      />
      {status === 'live' && kind === 'stocks' ? copy.polled : copy[status]}
      {status === 'offline' && (
        <button className="cursor-pointer text-(--ui-text-primary) underline" onClick={onRetry} type="button">
          {copy.retry}
        </button>
      )}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-(--ui-text-tertiary)">{label}</dt>
      <dd className="m-0 text-sm font-medium tabular-nums text-(--ui-text-primary)">{value}</dd>
    </div>
  )
}

/** Why there is no chart yet (loading, failed, nothing to draw), or null when there are bars. */
function chartMessage(bars: Bar[] | undefined, error: Error | null): null | string {
  const copy = COPY.watchlist

  return error ? error.message || copy.barsFailed : bars ? (bars.length ? null : copy.noBars) : copy.loadingChart
}

/** The symbol, its price and the day's range — always laid out, with dashes until the first tick, so
 *  the chart below never moves. The name opens the symbol search; the small button beside it, the views. */
function CoinHeader({
  feed,
  kind,
  onPick,
  onView,
  symbol,
  view
}: {
  feed: MarketFeed | StockFeed
  kind: WatchKind
  onPick: (pick: Pick) => void
  onView: (view: View) => void
  symbol: string
  view: View
}) {
  const copy = COPY.watchlist
  const ticker = feed.tickers[symbol]
  const currency = kind === 'crypto' ? 'USDT' : (ticker?.currency ?? '')

  const volume = !ticker
    ? '—'
    : kind === 'crypto'
      ? `${shortAmount(ticker.volume)} USDT`
      : copy.shares(shortAmount(ticker.volume))

  return (
    <div className="flex flex-col gap-[18px] px-6 pt-6 pb-5">
      <div className="flex flex-wrap items-center gap-3">
        <SymbolSearch current={{ kind, symbol }} onPick={onPick} title={COPY.studio.symbolSearch.label}>
          <button
            aria-label={COPY.studio.symbolSearch.label}
            className="-ml-2 flex cursor-pointer items-center gap-3.5 rounded-xl px-2 py-1 text-left transition-colors hover:bg-(--card-well)"
            data-portfolio-symbol-search=""
            type="button"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--card-well)">
              <AssetIcon kind={kind} size={26} symbol={symbol} />
            </span>
            <span className="flex flex-col gap-px">
              <span className="text-base font-semibold tracking-[-0.01em] text-(--ui-text-primary)">
                {kind === 'crypto' ? `${symbol} / USDT` : symbol}
              </span>
              <span className="text-[0.78125rem] text-(--ui-text-tertiary)">
                {kind === 'crypto' ? 'Binance' : currency || '—'}
              </span>
            </span>
          </button>
        </SymbolSearch>
        <ViewMenu onView={onView} view={view} />
        <StatusDot kind={kind} onRetry={feed.retry} status={feed.status} />
        <div className="flex-1" />
        <AlertButton currency={currency} current={ticker?.price ?? null} kind={kind} symbol={symbol} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-wrap items-baseline gap-3 tabular-nums">
          <span className="text-[2.875rem] leading-none font-medium tracking-[-0.03em] text-(--ui-text-primary)">
            {ticker ? quotePrice(ticker.price) : '—'}
          </span>
          {ticker && (
            <>
              <span
                className={cn(
                  'rounded-full px-[9px] py-[3px] text-[0.8125rem] font-medium',
                  toneFill(ticker.changePct),
                  toneClass(ticker.changePct)
                )}
              >
                {percent(ticker.changePct, true)}
              </span>
              <span className="text-[0.8125rem] font-normal text-(--ui-text-tertiary)">
                {kind === 'crypto' ? copy.day : copy.sincePrevious}
              </span>
            </>
          )}
        </div>
        <dl className="m-0 flex flex-wrap gap-7">
          <Stat label={kind === 'crypto' ? copy.high : copy.dayHigh} value={ticker ? quotePrice(ticker.high) : '—'} />
          <Stat label={kind === 'crypto' ? copy.low : copy.dayLow} value={ticker ? quotePrice(ticker.low) : '—'} />
          <Stat label={kind === 'crypto' ? copy.volume : copy.dayVolume} value={volume} />
        </dl>
      </div>
    </div>
  )
}

const compareName = (ref: Pick) => (ref.kind === 'crypto' ? `${ref.symbol} / USDT` : ref.symbol)

/** The bars of up to three compared symbols, laid onto the main chart's bars as closes. */
function useCompareLines(refs: CompareRef[], interval: Interval, main: Bar[]): CompareLine[] {
  const first = useBars(refs[0]?.kind ?? 'crypto', refs[0]?.symbol ?? '', interval, Boolean(refs[0]))
  const second = useBars(refs[1]?.kind ?? 'crypto', refs[1]?.symbol ?? '', interval, Boolean(refs[1]))
  const third = useBars(refs[2]?.kind ?? 'crypto', refs[2]?.symbol ?? '', interval, Boolean(refs[2]))
  const loaded = [first.data, second.data, third.data]

  return useMemo(
    () =>
      refs.flatMap((ref, index) => {
        const bars = loaded[index]

        return bars?.length && main.length
          ? [
              {
                color: ref.color ?? COMPARE_COLORS[index % COMPARE_COLORS.length],
                id: `${ref.kind}:${ref.symbol}`,
                label: compareName(ref),
                points: resampleCloses(main, bars)
              }
            ]
          : []
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `loaded` is the three queries' data
    [refs, main, first.data, second.data, third.data]
  )
}

export function CoinPanel({
  feed,
  interval,
  kind,
  onInterval,
  onPick,
  symbol
}: {
  feed: MarketFeed | StockFeed
  interval: Interval
  kind: WatchKind
  onInterval: (interval: Interval) => void
  onPick: (pick: Pick) => void
  symbol: string
}) {
  const [mode, setMode] = useState<ChartMode>('candles')
  const [view, setView] = useState<View>('chart')
  const service = 'service' in feed ? feed.service : null
  const ready = kind === 'crypto' || serviceReady(service)
  const { data: bars, error } = useBars(kind, symbol, interval, ready)
  const { data: alertState } = useAlerts()
  const { doc, update } = useChartDoc(kind, symbol)
  const levels = useMemo(() => levelsFor(alertState?.alerts ?? [], symbol), [alertState, symbol])
  const compare = useCompareLines(doc.compare ?? [], interval, bars ?? NO_BARS)

  const extras = useMemo(
    () => ({ priceLines: levels.map(price => ({ color: '#fbbf24', dashed: true, price, title: '🔔' })) }),
    [levels]
  )

  const header = <CoinHeader feed={feed} kind={kind} onPick={onPick} onView={setView} symbol={symbol} view={view} />

  const addCompare = (pick: Pick) =>
    void update(current => ({
      ...current,
      compare: [
        ...(current.compare ?? []).filter(ref => ref.kind !== pick.kind || ref.symbol !== pick.symbol),
        { color: null, kind: pick.kind, symbol: pick.symbol }
      ]
        .filter(ref => ref.kind !== kind || ref.symbol !== symbol)
        .slice(-3)
    }))

  const removeCompare = (id: string) =>
    void update(current => ({
      ...current,
      compare: (current.compare ?? []).filter(ref => `${ref.kind}:${ref.symbol}` !== id)
    }))

  if (!ready && service) {
    return (
      <section className={cn(CARD, 'overflow-hidden')} data-portfolio-coin={symbol}>
        {header}
        <div className="px-6 pb-6">
          <MarketDataCard status={service} where="watchlist" />
        </div>
      </section>
    )
  }

  if (view !== 'chart') {
    return (
      <section className={cn(CARD, 'overflow-hidden')} data-portfolio-coin={symbol} data-portfolio-view={view}>
        {header}
        <AnalysisView bars={bars ?? NO_BARS} interval={interval} kind={kind} symbol={symbol} view={view} />
      </section>
    )
  }

  return (
    <ChartStudio
      bars={bars ?? NO_BARS}
      compare={compare.length ? compare : NO_LINES}
      daily={DAY_INTERVALS.includes(interval)}
      empty={chartMessage(bars, error)}
      extras={extras}
      header={header}
      intervalLabel={COPY.watchlist.intervals[interval]}
      kind={kind}
      lead={
        <>
          <CompareButton onPick={addCompare} />
          <IntervalMenu interval={interval} intervals={intervalsFor(kind, INTERVALS)} onInterval={onInterval} />
          <ChartTypeMenu mode={mode} onMode={setMode} />
        </>
      }
      live={kind === 'crypto' ? feed.bar : null}
      mode={mode}
      name={kind === 'crypto' ? `${symbol} / USDT` : symbol}
      onRemoveCompare={removeCompare}
      replayable
      symbol={symbol}
    />
  )
}
