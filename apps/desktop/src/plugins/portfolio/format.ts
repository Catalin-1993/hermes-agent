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
