/** Numbers and dates as the owner reads them: Romanian, euros. */

const euroFormat = (digits: number, sign: 'always' | 'auto') =>
  new Intl.NumberFormat('ro-RO', {
    currency: 'EUR',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    signDisplay: sign === 'always' ? 'exceptZero' : 'auto',
    style: 'currency'
  })

export const euro = (value: number, digits = 0) => euroFormat(digits, 'auto').format(value)

export const signedEuro = (value: number, digits = 2) => euroFormat(digits, 'always').format(value)

export const percent = (value: number, signed = false) =>
  `${signed && value > 0 ? '+' : ''}${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)}%`

export const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))

/** The text colour class for a gain, a loss or nothing. */
export const toneClass = (value: number) =>
  value > 0 ? 'text-(--ui-green)' : value < 0 ? 'text-(--ui-red)' : 'text-(--ui-text-tertiary)'

/** A coin's price in USDT with the digits its size needs: 94.000,12 · 3,42 · 0,00001234. */
export function quotePrice(price: number): string {
  const digits = price >= 100 ? 2 : price >= 1 ? 3 : price >= 0.01 ? 4 : 8

  return new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.min(digits, 2)
  }).format(price)
}

/** 1,2 mld · 34,5 mil · 120 mii — a traded volume in short form. */
export const shortAmount = (value: number) =>
  new Intl.NumberFormat('ro-RO', { compactDisplay: 'short', maximumFractionDigits: 1, notation: 'compact' }).format(
    value
  )
