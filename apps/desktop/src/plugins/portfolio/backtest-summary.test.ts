import { describe, expect, it } from 'vitest'

import { executionSummary } from './backtest-cards'
import { DEFAULT_EXECUTION } from './backtest-strategies'

describe('execution summary', () => {
  it('names only what differs from the plain strategy', () => {
    expect(executionSummary({ ...DEFAULT_EXECUTION, stop_loss_pct: 7.5, timeframe: '1w' })).toBe(
      'stop-loss 7,5% · bare săptămânale'
    )
  })

  it('says how the stop and the size were chosen', () => {
    expect(executionSummary({ ...DEFAULT_EXECUTION, adx_filter: 25, risk_pct: 1, stop_atr: 2, stop_mode: 'atr' })).toBe(
      'stop-loss 2× ATR · risc 1% pe tranzacție · doar cu ADX ≥ 25'
    )
  })

  it('reads a run saved before execution settings existed as the plain strategy', () => {
    expect(executionSummary(undefined)).toBe(executionSummary(DEFAULT_EXECUTION))
  })
})
