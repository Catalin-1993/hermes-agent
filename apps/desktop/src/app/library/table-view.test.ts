import { describe, expect, it } from 'vitest'

import { cellNumber, visibleRows } from './table-view'

const rows = [
  ['Cluj', '286.000', 'nord'],
  ['Iași', '271,000', 'est'],
  ['Brașov', '', 'centru'],
  ['Timișoara', '9', 'vest']
]

describe('table view', () => {
  it('reads numbers the way people write them', () => {
    expect(['1,234.5', '1.234,5', '286.000', '271,000', '1,5', '0.125', '12%', 'abc'].map(cellNumber)).toEqual([
      1234.5,
      1234.5,
      286000,
      271000,
      1.5,
      0.125,
      12,
      null
    ])
  })

  it('sorts numerically both ways with blanks last, and leaves the rows themselves alone', () => {
    expect(visibleRows(rows, '', { col: 1, dir: 'asc' })).toEqual([3, 1, 0, 2])
    expect(visibleRows(rows, '', { col: 1, dir: 'desc' })).toEqual([0, 1, 3, 2])
    expect(rows[0][0]).toBe('Cluj')
  })

  it('filters on any cell, without minding accents or case', () => {
    expect(visibleRows(rows, 'IASI', null)).toEqual([1])
    expect(visibleRows(rows, 'brasov', null)).toEqual([2])
  })
})
