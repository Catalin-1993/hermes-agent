import { describe, expect, it } from 'vitest'

import { parseDelimited, serializeDelimited } from './csv'

describe('delimited text', () => {
  it('reads quoted separators, quotes and line breaks, and writes them back unchanged', () => {
    const text = 'name,note,amount\n"Ana, Ltd","said ""hi""",10\nBob,"two\nlines",20\n'
    const table = parseDelimited(text)

    expect(table.rows).toEqual([
      ['name', 'note', 'amount'],
      ['Ana, Ltd', 'said "hi"', '10'],
      ['Bob', 'two\nlines', '20']
    ])
    expect(serializeDelimited(table)).toBe(text)
  })

  it('keeps the separator the file uses', () => {
    const table = parseDelimited('oraș;populație\nCluj;286000\n')

    expect(table.delimiter).toBe(';')
    expect(serializeDelimited({ ...table, rows: [...table.rows, ['Iași', '271000']] })).toBe(
      'oraș;populație\nCluj;286000\nIași;271000\n'
    )
  })

  it('honours a tab file and a byte-order mark', () => {
    expect(parseDelimited('﻿a\tb\n1\t2', '\t').rows).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
  })
})
