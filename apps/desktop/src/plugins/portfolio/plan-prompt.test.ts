import { describe, expect, it } from 'vitest'

import type { InvestmentPlan, PortfolioDashboard, PortfolioPosition } from './api'
import { classRows } from './plan-math'
import { planPrompt } from './plan-prompt'

const data = {
  allocation: [
    { name: 'Cripto', value: 2000 },
    { name: 'Numerar', value: 8000 }
  ],
  cash: 8000,
  pnl_pct: 3.2,
  positions: [{ pnl_pct: 5, symbol: 'BTC', weight: 20 } as PortfolioPosition],
  total: 10_000,
  variant: 'A'
} as PortfolioDashboard

const plan: InvestmentPlan = {
  goals: [{ by: '2030-01-01', id: 'g', name: 'Avans casă', target_eur: 50_000 }],
  rules: { max_position_pct: 25, min_cash_pct: 5, rebalance_band_pp: 5, review_loss_pct: 20 },
  targets: { Cripto: 15, Numerar: 85 },
  thesis: 'Creștere\n\nprudentă.',
  updated: '',
  updated_by: ''
}

const CLASSES = ['Cripto', 'Acțiuni globale', 'Numerar']

const build = (ask: 'propose' | 'review', note = '') =>
  planPrompt({
    ask,
    classes: CLASSES,
    data,
    file: '/u/BrainTeam/investitii/plan.json',
    note,
    plan,
    researchDir: '/u/BrainTeam/investitii/research/',
    rows: classRows(plan, data, CLASSES),
    today: '2026-10-21'
  })

describe('plan prompt', () => {
  it('asks for a proposal written into the plan file, in the shape the page reads, for this variant only', () => {
    const prompt = build('propose', 'Vreau mai puțin cripto')

    expect(prompt).toContain('Scrie planul în /u/BrainTeam/investitii/plan.json, păstrând celelalte variante')
    expect(prompt).toContain('"A": {')
    expect(prompt).toContain('doar clasele: Cripto, Acțiuni globale, Numerar')
    expect(prompt).toContain('Ce vreau în mod special: Vreau mai puțin cripto')
  })

  it('asks for a review saved as a report, without touching the plan', () => {
    const prompt = build('review')

    expect(prompt).toContain('Nu modifica planul.')
    expect(prompt).toContain('/u/BrainTeam/investitii/research/2026-10-21-PLAN-verificare.md')
    expect(prompt).toContain('simbol: PLAN')
  })

  it('carries the portfolio and the current plan so the team starts from the same numbers', () => {
    const prompt = build('review')

    expect(prompt).toContain('Alocare acum: Cripto 20,0%')
    expect(prompt).toContain('Ținte: Cripto 15,0%, Numerar 85,0%')
    expect(prompt).toContain('Avans casă')
    expect(prompt).toContain('Strategia, în cuvintele mele: Creștere prudentă.')
    expect(prompt).toContain('nu face tranzacții reale')
  })
})
