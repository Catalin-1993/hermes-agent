/** The live feed as React state: tickers for every followed coin, the forming candle of the selected one. */

import { useEffect, useState } from 'react'

import {
  type Bar,
  BINANCE,
  type Endpoints,
  fetchTickers,
  type Interval,
  openStream,
  streamUrl,
  type Ticker
} from './market-feed'

export type FeedStatus = 'connecting' | 'live' | 'offline'

/** Seconds to wait before each reconnect; when they run out the feed says offline and offers a retry. */
export const BACKOFF_S = [1, 2, 4, 8, 16]

export interface MarketFeed {
  bar: Bar | null
  retry: () => void
  status: FeedStatus
  tickers: Record<string, Ticker>
}

export function useMarketFeed(
  symbols: string[],
  selected: string | null,
  interval: Interval,
  endpoints: Endpoints = BINANCE
): MarketFeed {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({})
  const [bar, setBar] = useState<Bar | null>(null)
  const [status, setStatus] = useState<FeedStatus>('connecting')
  const [attempt, setAttempt] = useState(0)
  const key = symbols.join(',')

  // A first paint from REST, so rows are not blank while the socket opens.
  useEffect(() => {
    if (!symbols.length) {
      return
    }

    const abort = new AbortController()

    fetchTickers(symbols, abort.signal, endpoints)
      .then(first => setTickers(current => ({ ...first, ...current })))
      .catch(() => undefined)

    return () => abort.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the symbol list
  }, [key, endpoints, attempt])

  useEffect(() => {
    if (!symbols.length) {
      return
    }

    setBar(null)
    setStatus('connecting')
    let timer: ReturnType<typeof setTimeout> | undefined

    let closeStream = () => {}
    let stopped = false
    let tries = 0

    const connect = () => {
      closeStream = openStream(streamUrl(symbols, selected, interval, endpoints), {
        onBar: (symbol, next) => symbol === selected && setBar(next),
        onClose: () => {
          if (stopped) {
            return
          }

          const wait = BACKOFF_S[tries]

          if (wait === undefined) {
            return setStatus('offline')
          }

          tries += 1
          setStatus('connecting')
          timer = setTimeout(connect, wait * 1000)
        },
        onOpen: () => {
          tries = 0
          setStatus('live')
        },
        onTicker: (symbol, next) => setTickers(current => ({ ...current, [symbol]: next }))
      })
    }

    connect()

    return () => {
      stopped = true
      clearTimeout(timer)
      closeStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the symbol list
  }, [key, selected, interval, endpoints, attempt])

  return { bar, retry: () => setAttempt(value => value + 1), status, tickers }
}
