/** Dates on the dashboard: a portfolio that has not started yet has no date, and must not break the page. */
import { describe, expect, it } from 'vitest'

import { dateLabel } from './format'

describe('dateLabel', () => {
  it('formats a day the Romanian way', () => {
    expect(dateLabel('2026-11-07')).toMatch(/7 nov\.? 2026/)
  })

  it('reads an empty or unreadable date as a dash instead of throwing', () => {
    expect(dateLabel('')).toBe('—')
    expect(dateLabel('not a date')).toBe('—')
  })
})
