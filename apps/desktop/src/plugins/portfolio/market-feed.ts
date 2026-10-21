/**
 * Live crypto prices straight from Binance's public market data — no key, no account, nothing sent
 * but the coins asked for. History comes over REST, ticks over one WebSocket. Pairs are quoted in USDT
 * (the one quote every listed coin has). Endpoints are parameters so tests can point at a local server.
 */

export interface Endpoints {
  rest: string
  ws: string
}

export const BINANCE: Endpoints = { rest: 'https://api.binance.com', ws: 'wss://stream.binance.com:9443' }

export const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const

export type Interval = (typeof INTERVALS)[number]

export interface Bar {
  close: number
  high: number
  low: number
  open: number
  /** Seconds since the epoch, as the chart wants it. */
  time: number
  volume: number
}

export interface Ticker {
  change: number
  /** The quote currency; crypto pairs are always USDT. */
  currency?: string
  changePct: number
  high: number
  low: number
  price: number
  /** Traded in the last 24 h, in USDT. */
  volume: number
}

export const pairOf = (symbol: string) => `${symbol.toUpperCase()}USDT`

const symbolOf = (pair: string) => pair.replace(/USDT$/, '')

/** One Binance kline row: [openTime ms, open, high, low, close, volume, …]. */
export function barFromRow(row: (number | string)[]): Bar {
  return {
    close: Number(row[4]),
    high: Number(row[2]),
    low: Number(row[3]),
    open: Number(row[1]),
    time: Math.floor(Number(row[0]) / 1000),
    volume: Number(row[5])
  }
}

/** The `k` object of a kline stream message. */
export function barFromStream(k: Record<string, number | string>): Bar {
  return barFromRow([k.t, k.o, k.h, k.l, k.c, k.v])
}

/** A 24 h ticker, from the REST `ticker/24hr` row or the stream's `miniTicker` (`c o h l q`). */
export function tickerFrom(row: Record<string, string>): Ticker {
  const price = Number(row.lastPrice ?? row.c)
  const open = Number(row.openPrice ?? row.o)

  return {
    change: price - open,
    changePct: open ? ((price - open) / open) * 100 : 0,
    high: Number(row.highPrice ?? row.h),
    low: Number(row.lowPrice ?? row.l),
    price,
    volume: Number(row.quoteVolume ?? row.q)
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`Binance ${response.status}`)
  }

  return (await response.json()) as T
}

export async function fetchBars(
  symbol: string,
  interval: Interval,
  signal?: AbortSignal,
  endpoints: Endpoints = BINANCE
): Promise<Bar[]> {
  const rows = await getJson<(number | string)[][]>(
    `${endpoints.rest}/api/v3/klines?symbol=${pairOf(symbol)}&interval=${interval}&limit=500`,
    signal
  )

  return rows.map(barFromRow)
}

/** 24 h tickers by coin. Binance refuses the whole request if one pair is unknown. */
export async function fetchTickers(
  symbols: string[],
  signal?: AbortSignal,
  endpoints: Endpoints = BINANCE
): Promise<Record<string, Ticker>> {
  const rows = await getJson<Record<string, string>[]>(
    `${endpoints.rest}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols.map(pairOf)))}`,
    signal
  )

  return Object.fromEntries(rows.map(row => [symbolOf(row.symbol), tickerFrom(row)]))
}

/** Whether Binance lists the coin against USDT. */
export async function isListed(symbol: string, endpoints: Endpoints = BINANCE): Promise<boolean> {
  try {
    await fetchTickers([symbol], undefined, endpoints)

    return true
  } catch {
    return false
  }
}

export interface StreamHandlers {
  onBar: (symbol: string, bar: Bar) => void
  onClose: () => void
  onOpen: () => void
  onTicker: (symbol: string, ticker: Ticker) => void
}

export function streamUrl(symbols: string[], selected: string | null, interval: Interval, endpoints: Endpoints) {
  const streams = symbols.map(symbol => `${pairOf(symbol).toLowerCase()}@miniTicker`)

  if (selected) {
    streams.push(`${pairOf(selected).toLowerCase()}@kline_${interval}`)
  }

  return `${endpoints.ws}/stream?streams=${streams.join('/')}`
}

/** Opens the one combined stream; returns a function that closes it. */
export function openStream(url: string, handlers: StreamHandlers): () => void {
  const socket = new WebSocket(url)

  socket.onopen = handlers.onOpen
  socket.onclose = handlers.onClose

  socket.onmessage = event => {
    const message = JSON.parse(String(event.data)) as { data?: Record<string, unknown>; stream?: string }
    const data = message.data

    if (!data || !message.stream) {
      return
    }

    if (data.e === 'kline') {
      handlers.onBar(symbolOf(String(data.s)), barFromStream(data.k as Record<string, number | string>))
    } else if (data.e === '24hrMiniTicker') {
      handlers.onTicker(symbolOf(String(data.s)), tickerFrom(data as Record<string, string>))
    }
  }

  return () => {
    socket.onclose = null
    socket.close()
  }
}
