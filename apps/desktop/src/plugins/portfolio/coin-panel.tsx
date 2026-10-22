/** The chart side of the Watchlist: the selected coin or stock, its numbers, and a TradingView chart. */

import { cn, FIGURE_CARD_CLASS, useQuery } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { fetchStockBars, type WatchKind } from './api'
import { AssetIcon } from './asset-icon'
import { COPY } from './copy'
import { percent, quotePrice, shortAmount, toneClass } from './format'
import { type ChartMode, LiveChart } from './live-chart'
import { MarketDataCard } from './market-data-card'
import { type Bar, barFromRow, DAY_INTERVALS, fetchBars, type Interval, INTERVALS } from './market-feed'
import { Segmented } from './segmented'
import type { FeedStatus, MarketFeed } from './use-market-feed'
import { serviceReady, type StockFeed } from './use-stock-feed'

const TITLE = 'text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)'

const STOCK_INTERVALS: Interval[] = ['15m', '1h', '1d', '1w', '1M']

/** The service (yfinance) names weekly and monthly bars in capitals. */
const SERVICE_INTERVAL: Partial<Record<Interval, string>> = { '1M': '1M', '1w': '1W' }

function StatusDot({ kind, onRetry, status }: { kind: WatchKind; onRetry: () => void; status: FeedStatus }) {
  const copy = COPY.watchlist.status

  return (
    <span className="flex items-center gap-1.5 text-[0.75rem] text-(--ui-text-tertiary)">
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'live' && 'bg-(--ui-green)',
          status === 'connecting' && 'animate-pulse bg-(--ui-yellow)',
          status === 'offline' && 'bg-(--ui-red)'
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
    <div className="min-w-0">
      <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{label}</div>
      <div className="mt-0.5 text-[0.8125rem] font-medium tabular-nums text-(--ui-text-primary)">{value}</div>
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

function ChartArea({
  bars,
  error,
  live,
  mode,
  daily
}: {
  bars?: Bar[]
  daily: boolean
  error: Error | null
  live: Bar | null
  mode: ChartMode
}) {
  const copy = COPY.watchlist

  const message = error
    ? error.message || copy.barsFailed
    : bars
      ? bars.length
        ? null
        : copy.noBars
      : copy.loadingChart

  return message ? (
    <div className="grid min-h-80 flex-1 place-items-center px-6 text-center text-[0.8125rem] text-(--ui-text-tertiary)">
      {message}
    </div>
  ) : (
    <LiveChart bars={bars!} daily={daily} live={live} mode={mode} />
  )
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
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={cn(TITLE, 'flex items-center gap-2')}>
            <AssetIcon kind={kind} size={22} symbol={symbol} />
            {kind === 'crypto' ? `${symbol} / USDT` : `${symbol}${currency ? ` · ${currency}` : ''}`}
          </div>
          <div className="mt-1 flex items-baseline gap-3 tabular-nums">
            <span className="text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-(--ui-text-primary)">
              {ticker ? quotePrice(ticker.price) : '—'}
            </span>
            {ticker && (
              <span className={cn('text-[0.875rem] font-medium', toneClass(ticker.changePct))}>
                {percent(ticker.changePct, true)}{' '}
                <span className="font-normal text-(--ui-text-tertiary)">
                  {kind === 'crypto' ? copy.day : copy.sincePrevious}
                </span>
              </span>
            )}
          </div>
        </div>
        <StatusDot kind={kind} onRetry={feed.retry} status={feed.status} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Stat label={kind === 'crypto' ? copy.high : copy.dayHigh} value={ticker ? quotePrice(ticker.high) : '—'} />
        <Stat label={kind === 'crypto' ? copy.low : copy.dayLow} value={ticker ? quotePrice(ticker.low) : '—'} />
        <Stat label={kind === 'crypto' ? copy.volume : copy.dayVolume} value={volume} />
      </div>
    </>
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

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'min-h-[32rem] gap-3 lg:h-full')} data-portfolio-coin={symbol}>
      <CoinHeader feed={feed} kind={kind} symbol={symbol} />
      {!ready && service ? (
        <MarketDataCard status={service} where="watchlist" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
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
          </div>
          <ChartArea
            bars={bars}
            daily={DAY_INTERVALS.includes(interval)}
            error={error}
            live={kind === 'crypto' ? feed.bar : null}
            mode={mode}
          />
        </>
      )}
    </div>
  )
}
