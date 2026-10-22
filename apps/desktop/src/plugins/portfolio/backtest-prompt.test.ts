import { describe, expect, it } from 'vitest'

import type { BacktestRecord, BacktestStats } from './api'
import { backtestPrompt } from './backtest-prompt'

const stats = (total: number): BacktestStats => ({
  best_trade_pct: 20,
  cagr_pct: total / 3,
  exits: { signal: 5, stop_loss: 2, take_profit: 0, trailing: 0 },
  exposure_pct: 55,
  max_drawdown_pct: -18,
  sharpe: 1.234,
  total_return_pct: total,
  trades: 7,
  volatility_pct: 30,
  win_rate_pct: 57.1,
  worst_trade_pct: -6
})

const record = {
  benchmark: { curve: [], stats: stats(80), trades: [] },
  created: '',
  id: 'x',
  params: { fast: 20, slow: 100 },
  prices: [],
  request: {
    capital: 10000,
    currency: 'EUR',
    fee_pct: 0.1,
    kind: 'crypto',
    params: {},
    provider_symbol: 'BTC-EUR',
    strategy: 'sma_cross',
    symbol: 'BTC',
    years: 3
  },
  result: {
    curve: [
      [1_700_000_000, 10000],
      [1_760_000_000, 14200]
    ],
    stats: stats(42),
    trades: []
  }
} as BacktestRecord

describe('backtest prompt', () => {
  it('states the test, both results and where to save the reading', () => {
    const prompt = backtestPrompt({
      execution: 'stop-loss 5% · bare săptămânale',
      names: { sma_cross: 'Medii mobile' },
      note: 'E mai bine decât să țin?',
      reasons: { signal: 'semnal', stop_loss: 'stop-loss' },
      record,
      researchDir: '/r/',
      today: '2026-10-21'
    })

    expect(prompt).toContain('strategia: Medii mobile (fast=20, slow=100); perioada 2023-11-14 – 2025-10-09')
    expect(prompt).toContain('Strategia: randament +42,0%')
    expect(prompt).toContain('Cumpără și păstrează: randament +80,0%')
    expect(prompt).toContain('Sharpe 1.23')
    expect(prompt).toContain('Execuție: stop-loss 5% · bare săptămânale.')
    expect(prompt).toContain('ieșiri: 5 prin semnal, 2 prin stop-loss')
    expect(prompt).toContain('/r/2026-10-21-BTC-backtest.md')
    expect(prompt).toContain('Ce vreau să aflu: E mai bine decât să țin?')
    expect(prompt).toContain('nu face tranzacții reale')
  })
})
