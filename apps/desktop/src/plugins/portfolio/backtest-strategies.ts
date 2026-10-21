/** The strategies the page offers and their parameters — mirrored from the service's `signals.py`
 *  (defaults and ranges), so the form never sends what the service would clamp. */

import type { BacktestStrategy } from './api'

export interface ParamSpec {
  default: number
  max: number
  min: number
  name: string
  step: number
}

export const STRATEGY_ORDER: BacktestStrategy[] = ['sma_cross', 'rsi_revert', 'breakout', 'buy_hold']

export const PARAMS: Record<BacktestStrategy, ParamSpec[]> = {
  breakout: [
    { default: 55, max: 250, min: 5, name: 'entry', step: 1 },
    { default: 20, max: 250, min: 2, name: 'exit', step: 1 }
  ],
  buy_hold: [],
  rsi_revert: [
    { default: 14, max: 60, min: 2, name: 'period', step: 1 },
    { default: 30, max: 50, min: 1, name: 'low', step: 1 },
    { default: 70, max: 99, min: 50, name: 'high', step: 1 }
  ],
  sma_cross: [
    { default: 50, max: 250, min: 2, name: 'fast', step: 1 },
    { default: 200, max: 400, min: 5, name: 'slow', step: 1 }
  ]
}

export const defaultParams = (strategy: BacktestStrategy) =>
  Object.fromEntries(PARAMS[strategy].map(spec => [spec.name, spec.default]))

export const YEARS = [1, 2, 3, 5, 10]
