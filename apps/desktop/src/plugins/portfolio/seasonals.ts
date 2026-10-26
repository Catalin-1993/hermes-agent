/**
 * Seasonals: how the symbol has done in each calendar month, year by year — the monthly bars' open to close —
 * and on average, with how often the month closed up. Months are read in UTC, where the bars begin.
 */

import type { Bar } from './market-feed'

export interface Seasonals {
  /** Average return by month (index 0 = January), in percent; null for a month never seen. */
  average: (null | number)[]
  /** Share of years each month closed higher, 0–100; null for a month never seen. */
  hitRate: (null | number)[]
  /** Rows by year, newest first: the return of each month in percent, null where there is no bar. */
  years: { returns: (null | number)[]; year: number }[]
}

export function seasonals(monthly: Bar[]): Seasonals {
  const byYear = new Map<number, (null | number)[]>()

  for (const bar of monthly) {
    if (!bar.open) {
      continue
    }

    const date = new Date(bar.time * 1000)
    const row = byYear.get(date.getUTCFullYear()) ?? new Array<null | number>(12).fill(null)
    row[date.getUTCMonth()] = ((bar.close - bar.open) / bar.open) * 100
    byYear.set(date.getUTCFullYear(), row)
  }

  const years = [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([year, returns]) => ({ returns, year }))

  const column = (month: number) =>
    years.map(row => row.returns[month]).filter((value): value is number => value !== null)

  return {
    average: Array.from({ length: 12 }, (_, month) => {
      const values = column(month)

      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
    }),
    hitRate: Array.from({ length: 12 }, (_, month) => {
      const values = column(month)

      return values.length ? (values.filter(value => value > 0).length / values.length) * 100 : null
    }),
    years
  }
}
