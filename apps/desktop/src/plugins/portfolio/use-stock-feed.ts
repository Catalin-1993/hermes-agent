/** Stock and ETF quotes as the same feed shape the crypto stream gives, polled from the market-data
 *  service every minute. The service, not the page, decides whether prices exist: its state comes along. */

import { useQuery } from '@hermes/plugin-sdk'

import { fetchStockQuotes, type PortfolioStatus } from './api'
import type { Ticker } from './market-feed'
import type { MarketFeed } from './use-market-feed'

export interface StockFeed extends MarketFeed {
  service: null | PortfolioStatus
}

export const serviceReady = (status: null | PortfolioStatus | undefined) =>
  status?.env === 'ready' && status.service === 'running'

export function useStockFeed(symbols: string[]): StockFeed {
  const { data, isError, isLoading, refetch } = useQuery({
    enabled: symbols.length > 0,
    queryFn: () => fetchStockQuotes(symbols),
    queryKey: ['portfolio', 'quotes', symbols.join(',')],
    // While the service is being prepared follow it closely, as the Dashboard does; then once a minute.
    refetchInterval: query => (serviceReady(query.state.data?.status) ? 60_000 : 3_000)
  })

  const tickers: Record<string, Ticker> = Object.fromEntries(
    Object.entries(data?.quotes ?? {}).map(([symbol, quote]) => [
      symbol,
      {
        change: quote.change,
        changePct: quote.change_pct,
        currency: quote.currency,
        high: quote.high,
        low: quote.low,
        price: quote.price,
        volume: quote.volume
      }
    ])
  )

  const status = isLoading ? 'connecting' : !isError && serviceReady(data?.status) ? 'live' : 'offline'

  return { bar: null, retry: () => void refetch(), service: data?.status ?? null, status, tickers }
}
