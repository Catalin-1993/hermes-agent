/** The strategies the page offers and their parameters — mirrored from the service's `signals.py`
 *  (defaults and ranges), so the form never sends what the service would clamp. */

import type { BacktestExecution, BacktestStrategy } from './api'

export interface ParamSpec {
  default: number
  max: number
  min: number
  name: string
  step: number
}

export const STRATEGY_ORDER: BacktestStrategy[] = [
  'sma_cross',
  'ema_cross',
  'macd',
  'rsi_revert',
  'bollinger',
  'breakout',
  'buy_hold'
]

export const PARAMS: Record<BacktestStrategy, ParamSpec[]> = {
  breakout: [
    { default: 55, max: 250, min: 5, name: 'entry', step: 1 },
    { default: 20, max: 250, min: 2, name: 'exit', step: 1 }
  ],
  bollinger: [
    { default: 20, max: 200, min: 5, name: 'period', step: 1 },
    { default: 2, max: 4, min: 0.5, name: 'width', step: 0.1 }
  ],
  buy_hold: [],
  ema_cross: [
    { default: 12, max: 200, min: 2, name: 'fast', step: 1 },
    { default: 26, max: 400, min: 5, name: 'slow', step: 1 }
  ],
  macd: [
    { default: 12, max: 100, min: 2, name: 'fast', step: 1 },
    { default: 26, max: 200, min: 5, name: 'slow', step: 1 },
    { default: 9, max: 50, min: 2, name: 'signal', step: 1 }
  ],
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

/** Fully invested, no protective orders, no filter, daily bars: the plain strategy. */
export const DEFAULT_EXECUTION: BacktestExecution = {
  size_pct: 100,
  stop_loss_pct: 0,
  take_profit_pct: 0,
  timeframe: '1d',
  trailing_pct: 0,
  trend_filter: 0
}

/** The risk and execution fields, their ranges and steps — mirrored from the service's clean_execution. */
export const EXECUTION_FIELDS: {
  max: number
  min: number
  name: Exclude<keyof BacktestExecution, 'timeframe'>
  step: number
}[] = [
  { max: 50, min: 0, name: 'stop_loss_pct', step: 0.5 },
  { max: 500, min: 0, name: 'take_profit_pct', step: 1 },
  { max: 50, min: 0, name: 'trailing_pct', step: 0.5 },
  { max: 100, min: 10, name: 'size_pct', step: 5 },
  { max: 400, min: 0, name: 'trend_filter', step: 10 }
]
