/** The chart side of the Watchlist: the selected coin or stock, its numbers, and a TradingView-style chart —
 *  with the view menu beside the symbol's name (Chart, Derivatives, Technicals, Seasonals, News, Community). */

import { cn, Tip } from '@hermes/plugin-sdk'
import { useMemo, useState } from 'react'

import { levelsFor } from './alert-rules'
import { AlertButton, useAlerts } from './alerts'
import { AnalysisView } from './analysis-views'
import type { WatchKind } from './api'
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
import { BarDivider } from './studio-toolbar'
import type { Pick } from './symbol-picker'
import { SymbolSearch } from './symbol-search'
import { CARD, toneFill } from './ui'
import { intervalsFor, useBars } from './use-bars'
import { useChartDoc } from './use-chart-doc'
import type { FeedStatus, MarketFeed } from './use-market-feed'
import { serviceReady, type StockFeed } from './use-stock-feed'

const NO_BARS: Bar[] = []
const NO_LINES: CompareLine[] = []

/** The feed's state as a small dot beside the name — green live, pulsing while it connects, red (a press
 *  retries) when it is offline; the words are in its tooltip. */
function FeedDot({ kind, onRetry, status }: { kind: WatchKind; onRetry: () => void; status: FeedStatus }) {
  const copy = COPY.watchlist.status
  const label = status === 'live' && kind === 'stocks' ? copy.polled : copy[status]

  return (
    <Tip label={status === 'offline' ? `${label} · ${copy.retry}` : label}>
      <button
        aria-label={label}
        className="grid size-6 cursor-pointer place-items-center rounded-full"
        onClick={status === 'offline' ? onRetry : undefined}
        type="button"
      >
        <span
          className={cn(
            'size-2 rounded-full',
            status === 'live' &&
              'bg-(--ui-green) shadow-[0_0_0_3px_color-mix(in_srgb,var(--ui-green)_20%,transparent)]',
            status === 'connecting' && 'animate-pulse bg-(--ui-yellow)',
            status === 'offline' && 'bg-(--ui-red)'
          )}
        />
      </button>
    </Tip>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[0.6875rem] whitespace-nowrap text-(--ui-text-tertiary)">{label}</dt>
      <dd className="m-0 text-[0.8125rem] font-medium whitespace-nowrap tabular-nums text-(--ui-text-primary)">
        {value}
      </dd>
    </div>
  )
}

/** Why there is no chart yet (loading, failed, nothing to draw), or null when there are bars. */
function chartMessage(bars: Bar[] | undefined, error: Error | null): null | string {
  const copy = COPY.watchlist

  return error ? error.message || copy.barsFailed : bars ? (bars.length ? null : copy.noBars) : copy.loadingChart
}

/** The symbol and its price on one row: the name (a button that opens the symbol search), the views menu,
 *  then the price, the day's change and the day's range. The name sits in front of the price. */
function CoinHeader({
  feed,
  kind,
  onPick,
  symbol
}: {
  feed: MarketFeed | StockFeed
  kind: WatchKind
  onPick: (pick: Pick) => void
  symbol: string
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
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 px-6 pt-4 pb-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <SymbolSearch current={{ kind, symbol }} onPick={onPick} title={COPY.studio.symbolSearch.label}>
            <button
              aria-label={COPY.studio.symbolSearch.label}
              className="-ml-2 flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1 text-left transition-colors hover:bg-(--card-well)"
              data-portfolio-symbol-search=""
              type="button"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-(--card-well)">
                <AssetIcon kind={kind} size={32} symbol={symbol} />
              </span>
              <span className="text-[0.875rem] font-semibold tracking-[-0.01em] whitespace-nowrap text-(--ui-text-primary)">
                {kind === 'crypto' ? `${symbol} / USDT` : currency ? `${symbol} · ${currency}` : symbol}
              </span>
            </button>
          </SymbolSearch>
          <FeedDot kind={kind} onRetry={feed.retry} status={feed.status} />
        </div>
        <div className="flex flex-wrap items-baseline gap-3 tabular-nums">
          <span className="text-[1.75rem] leading-none font-medium tracking-[-0.02em] text-(--ui-text-primary)">
            {ticker ? quotePrice(ticker.price) : '—'}
          </span>
          {ticker && (
            <>
              <span
                className={cn(
                  'rounded-full px-2 py-[2px] text-[0.75rem] font-medium',
                  toneFill(ticker.changePct),
                  toneClass(ticker.changePct)
                )}
              >
                {percent(ticker.changePct, true)}
              </span>
              <span className="text-[0.75rem] font-normal text-(--ui-text-tertiary)">
                {kind === 'crypto' ? copy.day : copy.sincePrevious}
              </span>
            </>
          )}
        </div>
      </div>
      <dl className="m-0 ml-auto flex gap-5">
        <Stat label={kind === 'crypto' ? copy.high : copy.dayHigh} value={ticker ? quotePrice(ticker.high) : '—'} />
        <Stat label={kind === 'crypto' ? copy.low : copy.dayLow} value={ticker ? quotePrice(ticker.low) : '—'} />
        <Stat label={kind === 'crypto' ? copy.volume : copy.dayVolume} value={volume} />
      </dl>
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

  const header = <CoinHeader feed={feed} kind={kind} onPick={onPick} symbol={symbol} />

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
        <div className="px-6 pb-5">
          <MarketDataCard status={service} where="watchlist" />
        </div>
      </section>
    )
  }

  if (view !== 'chart') {
    return (
      <section className={cn(CARD, 'overflow-hidden')} data-portfolio-coin={symbol} data-portfolio-view={view}>
        {header}
        <div className="flex items-center border-y border-(--card-well-stroke) px-2 py-1" data-portfolio-topbar="">
          <ViewMenu onView={setView} view={view} />
        </div>
        <AnalysisView bars={bars ?? NO_BARS} interval={interval} kind={kind} symbol={symbol} view={view} />
      </section>
    )
  }

  return (
    <ChartStudio
      bars={bars ?? NO_BARS}
      compare={compare.length ? compare : NO_LINES}
      controls={
        <AlertButton
          currency={kind === 'crypto' ? 'USDT' : (feed.tickers[symbol]?.currency ?? '')}
          current={feed.tickers[symbol]?.price ?? null}
          flat
          kind={kind}
          symbol={symbol}
        />
      }
      daily={DAY_INTERVALS.includes(interval)}
      empty={chartMessage(bars, error)}
      extras={extras}
      fullscreenable
      header={header}
      intervalLabel={COPY.watchlist.intervals[interval]}
      kind={kind}
      lead={
        <>
          <ViewMenu onView={setView} view={view} />
          <BarDivider />
          <IntervalMenu interval={interval} intervals={intervalsFor(kind, INTERVALS)} onInterval={onInterval} />
          <ChartTypeMenu mode={mode} onMode={setMode} />
          <CompareButton onPick={addCompare} />
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
