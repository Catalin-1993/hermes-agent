import { describe, expect, it } from 'vitest'

import { executionSummary } from './backtest-cards'
import { DEFAULT_EXECUTION } from './backtest-strategies'

describe('execution summary', () => {
  it('names only what differs from the plain strategy', () => {
    expect(executionSummary({ ...DEFAULT_EXECUTION, stop_loss_pct: 7.5, timeframe: '1w' })).toBe(
      'stop-loss 7,5% · bare săptămânale'
    )
  })

  it('reads a run saved before execution settings existed as the plain strategy', () => {
    expect(executionSummary(undefined)).toBe(executionSummary(DEFAULT_EXECUTION))
  })
})
