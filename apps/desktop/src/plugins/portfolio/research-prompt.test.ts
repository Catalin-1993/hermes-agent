import { describe, expect, it } from 'vitest'

import type { ResearchSheet } from './api'
import { researchPrompt } from './research-prompt'

const status = { env: 'ready', error: '', service: 'running' } as const

const sheet: ResearchSheet = {
  currency: 'USD',
  kind: 'stocks',
  profile: { profile: { industry: 'Consumer Electronics', name: 'Apple Inc.', sector: 'Technology' } },
  status,
  symbol: 'AAPL',
  technicals: {
    change: { '1m': 2, '1w': -1.5, '1y': 20, '3m': null },
    date: '2026-10-20',
    from_high_pct: -4,
    high_52w: 260,
    low_52w: 180,
    max_drawdown_pct: -18,
    price: 250,
    rsi14: 61.4,
    sma50: 245,
    sma200: 230,
    volatility_pct: 24
  }
}

describe('research prompt', () => {
  it('names the report file the page will list, by date, symbol and kind', () => {
    const prompt = researchPrompt({
      dir: '/Users/x/BrainTeam/investitii/research/',
      kind: 'risk',
      note: '',
      sheet,
      today: '2026-10-21'
    })

    expect(prompt).toContain('/Users/x/BrainTeam/investitii/research/2026-10-21-AAPL-risc.md')
    expect(prompt).toContain('simbol: AAPL')
  })

  it('hands over the numbers the page has, and the owner’s own question', () => {
    const prompt = researchPrompt({
      dir: '/r',
      kind: 'full',
      note: '  Merită înainte de rezultate? ',
      sheet,
      today: '2026-10-21'
    })

    expect(prompt).toContain('Preț: 250,00 USD (închiderea din 2026-10-20)')
    expect(prompt).toContain('1 săptămână -1,5%')
    expect(prompt).toContain('3 luni —')
    expect(prompt).toContain('RSI 14: 61')
    expect(prompt).toContain('Profil: Apple Inc. (Technology, Consumer Electronics)')
    expect(prompt).toContain('Întrebarea mea: Merită înainte de rezultate?')
  })

  it('keeps the simulation rule and says when the page has no prices', () => {
    const prompt = researchPrompt({
      dir: '/r',
      kind: 'quick',
      note: '',
      sheet: { kind: 'crypto', status, symbol: 'SOL' },
      today: '2026-10-21'
    })

    expect(prompt).toContain('nu face tranzacții reale')
    expect(prompt).toContain('serviciul de date nu rulează')
    expect(prompt).not.toContain('Întrebarea mea')
  })
})
