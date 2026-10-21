import { describe, expect, it } from 'vitest'

import type { InvestmentPlan, PortfolioDashboard, PortfolioPosition } from './api'
import { classRows, goalProgress, ruleChecks, targetSum } from './plan-math'

const position = (symbol: string, weight: number, pnl_pct: number) => ({ pnl_pct, symbol, weight }) as PortfolioPosition

const data = {
  allocation: [
    { name: 'Cripto', value: 3000 },
    { name: 'Acțiuni globale', value: 6500 },
    { name: 'Numerar', value: 500 }
  ],
  cash: 500,
  positions: [position('BTC', 30, 12), position('VWCE.DE', 65, 4), position('SOL', 0, -25)],
  total: 10_000
} as PortfolioDashboard

const plan: InvestmentPlan = {
  goals: [],
  rules: { max_position_pct: 25, min_cash_pct: 10, rebalance_band_pp: 5, review_loss_pct: 20 },
  targets: { 'Acțiuni globale': 60, Cripto: 20, Numerar: 10, Obligațiuni: 10 },
  thesis: '',
  updated: '',
  updated_by: ''
}

const CLASSES = ['Cripto', 'Acțiuni globale', 'Acțiuni BVB', 'Obligațiuni', 'Aur și materii prime', 'Numerar']

describe('plan math', () => {
  it('says how far each class is from its target and what returns it, only outside the band', () => {
    const rows = Object.fromEntries(classRows(plan, data, CLASSES).map(row => [row.name, row]))

    expect(rows.Cripto).toMatchObject({ current: 30, drift: 10, move: 1000, outside: true, target: 20 })
    expect(rows['Acțiuni globale']).toMatchObject({ drift: 5, move: 0, outside: false }) // exactly on the band
    expect(rows.Obligațiuni).toMatchObject({ current: 0, move: -1000, target: 10 }) // a target with nothing held
    expect(rows['Acțiuni BVB']).toBeUndefined() // neither targeted nor held
    expect(targetSum(plan)).toBe(100)
    expect(classRows(plan, data, CLASSES, true).map(row => row.name)).toEqual(CLASSES) // editing shows every class
  })

  it('reads a held class without a target as meant to be empty, but nothing is off target before any target is set', () => {
    const gold = { ...data, allocation: [...data.allocation, { name: 'Aur și materii prime', value: 1000 }] }
    const rows = Object.fromEntries(classRows(plan, gold, CLASSES).map(row => [row.name, row]))

    expect(rows['Aur și materii prime']).toMatchObject({ drift: 10, move: 1000, outside: true, target: 0 })
    expect(classRows({ ...plan, targets: {} }, gold, CLASSES).some(row => row.outside)).toBe(false)
  })

  it('lists what breaks each rule', () => {
    const checks = Object.fromEntries(
      ruleChecks(plan, data, classRows(plan, data, CLASSES)).map(c => [c.rule, c.breaches])
    )

    expect(checks.max_position_pct.map(b => b.label)).toEqual(['BTC', 'VWCE.DE'])
    expect(checks.rebalance_band_pp.map(b => b.label)).toEqual(['Cripto', 'Obligațiuni']) // cash is exactly on the band
    expect(checks.min_cash_pct).toEqual([{ label: 'Numerar', value: 5 }])
    expect(checks.review_loss_pct.map(b => b.label)).toEqual(['SOL'])
  })

  it('works out the yearly growth a dated goal still needs', () => {
    const [dated, open, reached] = goalProgress(
      [
        { by: '2028-10-21', id: 'a', name: 'Dublez', target_eur: 40_000 },
        { by: '', id: 'b', name: 'Fără dată', target_eur: 20_000 },
        { by: '2027-01-01', id: 'c', name: 'Atins', target_eur: 5_000 }
      ],
      10_000,
      new Date('2026-10-21')
    )

    expect(dated.progress).toBe(25)
    expect(dated.yearlyNeeded).toBeCloseTo(100, 0) // ×4 in two years: about +100% a year
    expect(open.yearlyNeeded).toBeNull()
    expect(reached).toMatchObject({ progress: 100, yearlyNeeded: null })
  })
})
