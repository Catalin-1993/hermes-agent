/** A symbol's bars at an interval, from Binance for coins and from the market-data service for stocks. */

import { useQuery } from '@hermes/plugin-sdk'

import { fetchStockBars, type WatchKind } from './api'
import { COPY } from './copy'
import { type Bar, barFromRow, fetchBars, type Interval } from './market-feed'

/** The intervals a stock chart offers (the service has no minute bars). */
export const STOCK_INTERVALS: Interval[] = ['15m', '1h', '1d', '1w', '1M']

/** The service (yfinance) names weekly and monthly bars in capitals. */
const SERVICE_INTERVAL: Partial<Record<Interval, string>> = { '1M': '1M', '1w': '1W' }

export async function stockBars(symbol: string, interval: Interval): Promise<Bar[]> {
  const answer = await fetchStockBars(symbol, SERVICE_INTERVAL[interval] ?? interval)

  if (answer.error) {
    throw new Error(answer.error === 'restart' ? COPY.watchlist.restart : answer.error)
  }

  return answer.bars.map(([time, open, high, low, close, volume]) =>
    barFromRow([time * 1000, open, high, low, close, volume])
  )
}

export function useBars(kind: WatchKind, symbol: string, interval: Interval, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: ({ signal }) => (kind === 'crypto' ? fetchBars(symbol, interval, signal) : stockBars(symbol, interval)),
    queryKey: ['portfolio', 'bars', kind, symbol, interval],
    retry: 1,
    staleTime: kind === 'crypto' ? 30_000 : 60_000
  })
}

/** The interval a symbol opens on, and whether an interval exists for its kind. */
export const defaultInterval = (kind: WatchKind): Interval => (kind === 'crypto' ? '1h' : '1d')

export const intervalsFor = (kind: WatchKind, all: readonly Interval[]): Interval[] =>
  kind === 'crypto' ? [...all] : STOCK_INTERVALS
