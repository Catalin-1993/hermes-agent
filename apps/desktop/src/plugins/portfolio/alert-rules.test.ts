import { describe, expect, it } from 'vitest'

import { describeAlert, directionFor, levelsFor, newlyReached, startingLevel } from './alert-rules'
import type { PriceAlert } from './api'

const alert = (id: string, active: boolean, extra: Partial<PriceAlert> = {}): PriceAlert => ({
  active,
  created: '',
  currency: 'USDT',
  id,
  kind: 'crypto',
  note: '',
  op: 'above',
  price: 70000,
  symbol: 'BTC',
  triggered_at: active ? null : '2026-10-22T14:05:00',
  triggered_price: active ? null : 70215.4,
  ...extra
})

describe('price alert rules', () => {
  it('waits for a rise above the price and a fall below it', () => {
    expect(directionFor(70000, 67000)).toBe('above')
    expect(directionFor(60000, 67000)).toBe('below')
  })

  it('starts from the current price, rounded the way a person types it', () => {
    expect(startingLevel(67012.3456)).toBe(67012.35)
    expect(startingLevel(0.0123456)).toBe(0.01235)
  })

  it('draws only the waiting levels of the open symbol', () => {
    const all = [alert('a', true), alert('b', false), alert('c', true, { price: 60000, symbol: 'ETH' })]

    expect(levelsFor(all, 'BTC')).toEqual([70000])
  })

  it('announces an alert once, when it turns from waiting to reached', () => {
    const before = [alert('a', true), alert('old', false)]
    const now = [alert('a', false), alert('old', false), alert('new', false)]

    expect(newlyReached(before, now).map(entry => entry.id)).toEqual(['a'])
    expect(newlyReached(now, now)).toEqual([])
  })

  it('reads an alert in words', () => {
    expect(describeAlert(alert('a', true))).toBe('BTC peste 70.000,00 USDT')
  })
})
