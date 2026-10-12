/** A spreadsheet column's letters: 0 → A, 25 → Z, 26 → AA. */
export const columnName = (index: number): string => {
  let name = ''

  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  }

  return name
}

export interface TableSort {
  col: number
  dir: 'asc' | 'desc'
}

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const NUMBER = /^-?[\d\s.,]+%?$/

/** A cell read as a number when it is one ("1,234.5", "1.234,5", "12%"), so 9 sorts before 10. */
export function cellNumber(value: string): null | number {
  const text = value.trim()

  if (!text || !NUMBER.test(text) || !/\d/.test(text)) {
    return null
  }

  const bare = text.replace(/[\s%]/g, '')
  const commas = bare.split(',').length - 1
  const dots = bare.split('.').length - 1
  let normalized: string

  if (commas && dots) {
    // Both marks: the later one is the decimal mark, the other groups thousands.
    normalized =
      bare.lastIndexOf(',') > bare.lastIndexOf('.') ? bare.replace(/\./g, '').replace(',', '.') : bare.replace(/,/g, '')
  } else if (commas + dots === 0) {
    normalized = bare
  } else {
    const mark = commas ? ',' : '.'
    const [whole, ...rest] = bare.split(mark)
    // One mark used more than once, or once before exactly three digits ("286.000", "271,000"),
    // groups thousands; otherwise it is the decimal mark ("1,5", "0.125").
    const grouping = rest.length > 1 || (rest[0].length === 3 && whole.replace('-', '') !== '0')

    normalized = grouping ? bare.split(mark).join('') : `${whole}.${rest[0]}`
  }

  const number = Number(normalized)

  return Number.isFinite(number) ? number : null
}

const compare = (a: string, b: string) => {
  const x = cellNumber(a)
  const y = cellNumber(b)

  if (x !== null && y !== null) {
    return x - y
  }

  // Empty cells sink to the end either way round.
  if (!a.trim() || !b.trim()) {
    return a.trim() ? -1 : b.trim() ? 1 : 0
  }

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** Which data rows to show, in what order: those holding `query` (any cell, accents and case aside),
 *  sorted by one column — the file itself stays as it is. */
export function visibleRows(rows: readonly (readonly string[])[], query: string, sort: null | TableSort): number[] {
  const needle = fold(query.trim())

  const order = rows
    .map((_, index) => index)
    .filter(index => !needle || rows[index].some(cell => fold(cell).includes(needle)))

  if (sort) {
    order.sort((a, b) => {
      const result = compare(rows[a][sort.col] ?? '', rows[b][sort.col] ?? '')
      const empty = !(rows[a][sort.col] ?? '').trim() || !(rows[b][sort.col] ?? '').trim()

      return (sort.dir === 'desc' && !empty ? -result : result) || a - b
    })
  }

  return order
}
