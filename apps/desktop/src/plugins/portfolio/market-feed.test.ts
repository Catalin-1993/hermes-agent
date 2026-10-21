import { describe, expect, it } from 'vitest'

import { quotePrice } from './format'
import { barFromRow, barFromStream, BINANCE, openStream, pairOf, streamUrl, tickerFrom } from './market-feed'

describe('Binance feed parsing', () => {
  it('reads a kline row into a bar with the time in seconds', () => {
    expect(barFromRow([1_700_000_000_000, '10', '12', '9', '11', '5.5'])).toEqual({
      close: 11,
      high: 12,
      low: 9,
      open: 10,
      time: 1_700_000_000,
      volume: 5.5
    })
  })

  it('reads a stream kline the same way as a history row', () => {
    const k = { c: '11', h: '12', l: '9', o: '10', t: 1_700_000_000_000, v: '5.5' }

    expect(barFromStream(k)).toEqual(barFromRow([k.t, k.o, k.h, k.l, k.c, k.v]))
  })

  it('computes the 24 h change from the REST row and from the mini ticker alike', () => {
    const rest = tickerFrom({
      highPrice: '120',
      lastPrice: '110',
      lowPrice: '90',
      openPrice: '100',
      quoteVolume: '5000'
    })

    const mini = tickerFrom({ c: '110', h: '120', l: '90', o: '100', q: '5000' })

    expect(rest).toEqual(mini)
    expect(rest.changePct).toBeCloseTo(10)
    expect(rest.change).toBeCloseTo(10)
  })

  it('asks for one ticker stream per coin and the selected coin’s candles', () => {
    expect(streamUrl(['BTC', 'eth'], 'eth', '15m', BINANCE)).toBe(
      'wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker/ethusdt@kline_15m'
    )
    expect(pairOf('sol')).toBe('SOLUSDT')
  })

  it('gives each price the digits its size needs', () => {
    expect(quotePrice(94_123.456)).toBe('94.123,46')
    expect(quotePrice(3.4567)).toBe('3,457')
    expect(quotePrice(0.00001234)).toBe('0,00001234')
  })
})

describe('Binance stream', () => {
  it('routes kline and mini ticker messages to their handlers and ignores the rest', () => {
    let socket!: { onmessage: (event: { data: string }) => void }

    globalThis.WebSocket = class {
      constructor() {
        socket = this as never
      }
      close() {}
    } as never

    const seen: string[] = []

    openStream('ws://x', {
      onBar: (symbol, bar) => seen.push(`bar ${symbol} ${bar.close}`),
      onClose: () => {},
      onOpen: () => {},
      onTicker: (symbol, ticker) => seen.push(`ticker ${symbol} ${ticker.price}`)
    })

    const send = (data: object) => socket.onmessage({ data: JSON.stringify({ data, stream: 's' }) })
    send({ e: 'kline', k: { c: '2', h: '3', l: '1', o: '1', t: 60_000, v: '1' }, s: 'BTCUSDT' })
    send({ c: '5', e: '24hrMiniTicker', h: '6', l: '4', o: '4', q: '9', s: 'ETHUSDT' })
    send({ e: 'trade', s: 'ETHUSDT' })

    expect(seen).toEqual(['bar BTC 2', 'ticker ETH 5'])
  })
})
