/** The chart side of the Watchlist: the selected coin or stock, its numbers, and a TradingView chart. */

import { cn, useQuery } from '@hermes/plugin-sdk'
import { useMemo, useState } from 'react'

import { levelsFor } from './alert-rules'
import { AlertButton, useAlerts } from './alerts'
import { fetchStockBars, type WatchKind } from './api'
import { AssetIcon } from './asset-icon'
import { ChartStudio } from './chart-studio'
import { COPY } from './copy'
import { percent, quotePrice, shortAmount, toneClass } from './format'
import { MarketDataCard } from './market-data-card'
import { type Bar, barFromRow, DAY_INTERVALS, fetchBars, type Interval, INTERVALS } from './market-feed'
import { Segmented } from './segmented'
import type { ChartMode } from './studio-canvas'
import { CARD, toneFill } from './ui'
import type { FeedStatus, MarketFeed } from './use-market-feed'
import { serviceReady, type StockFeed } from './use-stock-feed'

const NO_BARS: Bar[] = []

const STOCK_INTERVALS: Interval[] = ['15m', '1h', '1d', '1w', '1M']

/** The service (yfinance) names weekly and monthly bars in capitals. */
const SERVICE_INTERVAL: Partial<Record<Interval, string>> = { '1M': '1M', '1w': '1W' }

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

async function stockBars(symbol: string, interval: Interval): Promise<Bar[]> {
  const answer = await fetchStockBars(symbol, SERVICE_INTERVAL[interval] ?? interval)

  if (answer.error) {
    throw new Error(answer.error === 'restart' ? COPY.watchlist.restart : answer.error)
  }

  return answer.bars.map(([time, open, high, low, close, volume]) =>
    barFromRow([time * 1000, open, high, low, close, volume])
  )
}

function useBars(kind: WatchKind, symbol: string, interval: Interval, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: ({ signal }) => (kind === 'crypto' ? fetchBars(symbol, interval, signal) : stockBars(symbol, interval)),
    queryKey: ['portfolio', 'bars', kind, symbol, interval],
    retry: 1,
    staleTime: kind === 'crypto' ? 30_000 : 60_000
  })
}

/** Why there is no chart yet (loading, failed, nothing to draw), or null when there are bars. */
function chartMessage(bars: Bar[] | undefined, error: Error | null): null | string {
  const copy = COPY.watchlist

  return error ? error.message || copy.barsFailed : bars ? (bars.length ? null : copy.noBars) : copy.loadingChart
}

/** The symbol, its price and the day's range — always laid out, with dashes until the first tick, so
 *  the chart below never moves. */
function CoinHeader({ feed, kind, symbol }: { feed: MarketFeed | StockFeed; kind: WatchKind; symbol: string }) {
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
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--card-well)">
          <AssetIcon kind={kind} size={26} symbol={symbol} />
        </span>
        <div className="flex flex-col gap-px">
          <span className="text-base font-semibold tracking-[-0.01em] text-(--ui-text-primary)">
            {kind === 'crypto' ? `${symbol} / USDT` : symbol}
          </span>
          <span className="text-[0.78125rem] text-(--ui-text-tertiary)">
            {kind === 'crypto' ? 'Binance' : currency || '—'}
          </span>
        </div>
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

export function CoinPanel({ feed, kind, symbol }: { feed: MarketFeed | StockFeed; kind: WatchKind; symbol: string }) {
  const copy = COPY.watchlist
  const intervals = kind === 'crypto' ? [...INTERVALS] : STOCK_INTERVALS
  const [interval, setInterval] = useState<Interval>(kind === 'crypto' ? '1h' : '1d')
  const [mode, setMode] = useState<ChartMode>('candles')
  const service = 'service' in feed ? feed.service : null
  const ready = kind === 'crypto' || serviceReady(service)
  const { data: bars, error } = useBars(kind, symbol, interval, ready)
  const { data: alertState } = useAlerts()
  const levels = useMemo(() => levelsFor(alertState?.alerts ?? [], symbol), [alertState, symbol])

  const extras = useMemo(
    () => ({ priceLines: levels.map(price => ({ color: '#fbbf24', dashed: true, price, title: '🔔' })) }),
    [levels]
  )

  return !ready && service ? (
    <section className={cn(CARD, 'overflow-hidden')} data-portfolio-coin={symbol}>
      <CoinHeader feed={feed} kind={kind} symbol={symbol} />
      <div className="px-6 pb-6">
        <MarketDataCard status={service} where="watchlist" />
      </div>
    </section>
  ) : (
    <ChartStudio
      bars={bars ?? NO_BARS}
      controls={
        <>
          <Segmented
            label={copy.interval}
            onSelect={setInterval}
            options={intervals.map(id => ({ id, text: copy.intervals[id] }))}
            value={interval}
          />
          <Segmented
            label={COPY.chart.mode}
            onSelect={setMode}
            options={[
              { id: 'candles', text: COPY.chart.candles },
              { id: 'line', text: COPY.chart.line }
            ]}
            value={mode}
          />
        </>
      }
      daily={DAY_INTERVALS.includes(interval)}
      empty={chartMessage(bars, error)}
      extras={extras}
      header={<CoinHeader feed={feed} kind={kind} symbol={symbol} />}
      kind={kind}
      live={kind === 'crypto' ? feed.bar : null}
      mode={mode}
      symbol={symbol}
    />
  )
}
