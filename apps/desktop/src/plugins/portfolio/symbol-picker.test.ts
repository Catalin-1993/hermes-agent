import { describe, expect, it } from 'vitest'

import { pickerRows } from './symbol-picker'

const watched = [
  { kind: 'crypto' as const, symbol: 'BTC' },
  { kind: 'crypto' as const, symbol: 'ETH' },
  { kind: 'stocks' as const, symbol: 'TLV.RO' },
  { kind: 'stocks' as const, symbol: 'BRD.RO' }
]

const shown = (rows: ReturnType<typeof pickerRows>) =>
  rows.map(row => `${row.typed ? '+' : ''}${row.pick.kind}:${row.pick.symbol}`)

describe('pickerRows', () => {
  it('lists every watched symbol of the chosen kind when nothing is typed', () => {
    expect(shown(pickerRows(watched, '', 'all'))).toEqual([
      'crypto:BTC',
      'crypto:ETH',
      'stocks:TLV.RO',
      'stocks:BRD.RO'
    ])
    expect(shown(pickerRows(watched, '', 'stocks'))).toEqual(['stocks:TLV.RO', 'stocks:BRD.RO'])
  })

  it('narrows to what matches, and offers to open a new symbol as a coin or a stock', () => {
    expect(shown(pickerRows(watched, 'ro', 'all'))).toEqual([
      'stocks:TLV.RO',
      'stocks:BRD.RO',
      '+crypto:RO',
      '+stocks:RO'
    ])
    expect(shown(pickerRows(watched, 'sol', 'crypto'))).toEqual(['+crypto:SOL'])
  })

  it('never offers to open what is already listed, nor text that is not a symbol', () => {
    expect(shown(pickerRows(watched, 'btc', 'crypto'))).toEqual(['crypto:BTC'])
    expect(shown(pickerRows(watched, 'a b?', 'all'))).toEqual([])
  })
})
