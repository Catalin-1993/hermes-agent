/**
 * Portfolio data layer: the plugin's own `/api/plugins/portfolio/*` router
 * (`plugins/portfolio/dashboard/plugin_api.py`), reached through `ctx.rest`.
 */

import type { PluginRestOptions } from '@hermes/plugin-sdk'

type Rest = <T>(path: string, opts?: PluginRestOptions) => Promise<T>

let rest: null | Rest = null

export function bindPortfolioApi(next: Rest): () => void {
  rest = next

  return () => {
    rest = null
  }
}

function call<T>(path: string, opts?: PluginRestOptions): Promise<T> {
  return rest ? rest<T>(path, opts) : Promise.reject(new Error('portfolio api not ready'))
}

/** The market-data environment and service, as the backend reports them. */
export interface PortfolioStatus {
  env: 'error' | 'installing' | 'missing' | 'outdated' | 'ready'
  error: string
  service: 'off' | 'running' | 'starting' | 'stopped'
}

export interface PortfolioPosition {
  average: number
  class: string
  day_change: number
  day_change_pct: number
  name: string
  pnl: number
  pnl_pct: number
  price: number
  quantity: number
  source: 'jurnal' | 'piață'
  symbol: string
  value: number
  weight: number
}

export interface PortfolioDashboard {
  allocation: { name: string; value: number }[]
  candles: { close: number; date: string; high: number; low: number; open: number }[]
  as_of: null | string
  capital: number
  cash: number
  day_change: number
  day_change_pct: number
  fees: number
  has_journal: boolean
  history: { date: string; value: number }[]
  invested: number
  journal_dir: string
  pnl: number
  pnl_pct: number
  positions: PortfolioPosition[]
  prices: 'jurnal' | 'mixt' | 'piață'
  started: string
  status: PortfolioStatus
  total: number
  unverified_trades: number
  variant: string
  variants: string[]
}

export const portfolioKey = (variant: string) => ['portfolio', 'dashboard', variant] as const

export const fetchDashboard = (variant: string) =>
  call<PortfolioDashboard>(variant ? `/dashboard?variant=${encodeURIComponent(variant)}` : '/dashboard')

export const prepareMarketData = () => call<PortfolioStatus>('/prepare', { method: 'POST' })

export type WatchKind = 'crypto' | 'stocks'

export interface WatchList {
  id: string
  kind: WatchKind
  name: string
  symbols: string[]
}

export interface PortfolioWatchlists {
  lists: WatchList[]
  saved: boolean
}

export const watchlistKey = ['portfolio', 'watchlist'] as const

export const fetchWatchlists = () => call<PortfolioWatchlists>('/watchlist')

export const saveWatchlists = (lists: WatchList[]) =>
  call<PortfolioWatchlists>('/watchlist', { body: { lists }, method: 'PUT' })

export interface StockQuote {
  change: number
  change_pct: number
  currency: string
  date: string
  high: number
  low: number
  price: number
  volume: number
}

export const fetchStockQuotes = (symbols: string[]) =>
  call<{ quotes: Record<string, StockQuote>; status: PortfolioStatus }>(
    `/quotes?symbols=${encodeURIComponent(symbols.join(','))}`
  )

export const fetchStockBars = (symbol: string, interval: string) =>
  call<{ bars: number[][]; error?: string; status: PortfolioStatus }>(
    `/bars?symbol=${encodeURIComponent(symbol)}&interval=${interval}`
  )

export interface ResearchTechnicals {
  change: Record<'1m' | '1w' | '1y' | '3m', null | number>
  date: string
  from_high_pct: number
  high_52w: number
  low_52w: number
  max_drawdown_pct: number
  price: number
  rsi14: null | number
  sma50: null | number
  sma200: null | number
  volatility_pct: number
}

export interface ResearchSheet {
  currency?: string
  error?: string
  kind: WatchKind
  profile?: { error?: string; fund?: boolean; metrics?: Record<string, unknown>; profile?: Record<string, unknown> }
  provider_symbol?: string
  status: PortfolioStatus
  symbol: string
  technicals?: Partial<ResearchTechnicals>
}

export interface ResearchReport {
  author: string
  date: string
  modified: string
  name: string
  symbol: string
  title: string
  verdict: string
}

export const fetchResearchSheet = (symbol: string, kind: WatchKind) =>
  call<ResearchSheet>(`/research/sheet?symbol=${encodeURIComponent(symbol)}&kind=${kind}`)

export const fetchResearchReports = () => call<{ dir: string; reports: ResearchReport[] }>('/research/reports')

export const fetchResearchReport = (name: string) =>
  call<ResearchReport & { body: string }>(`/research/report?name=${encodeURIComponent(name)}`)

export type PlanRule = 'max_position_pct' | 'min_cash_pct' | 'rebalance_band_pp' | 'review_loss_pct'

export interface PlanGoal {
  /** `YYYY-MM-DD`, or empty for no deadline. */
  by: string
  id: string
  name: string
  target_eur: number
}

export interface InvestmentPlan {
  goals: PlanGoal[]
  rules: Record<PlanRule, number>
  targets: Partial<Record<string, number>>
  thesis: string
  updated: string
  updated_by: string
}

export interface PortfolioPlan {
  classes: string[]
  file: string
  plan: InvestmentPlan
  saved: boolean
  variant: string
}

export const planKey = (variant: string) => ['portfolio', 'plan', variant] as const

export const fetchPlan = (variant: string) => call<PortfolioPlan>(`/plan?variant=${encodeURIComponent(variant)}`)

export const savePlan = (variant: string, plan: InvestmentPlan) =>
  call<PortfolioPlan>(`/plan?variant=${encodeURIComponent(variant)}`, { body: { plan }, method: 'PUT' })

export type BacktestStrategy = 'bollinger' | 'breakout' | 'buy_hold' | 'ema_cross' | 'macd' | 'rsi_revert' | 'sma_cross'

/** How a strategy trades; a protective order at 0 is off. */
export interface BacktestExecution {
  size_pct: number
  stop_loss_pct: number
  take_profit_pct: number
  timeframe: '1d' | '1w'
  trailing_pct: number
  /** Only in above this many bars' average; 0 is off. */
  trend_filter: number
}

export type ExitReason = 'signal' | 'stop_loss' | 'take_profit' | 'trailing'

export interface BacktestRequest {
  capital: number
  execution: BacktestExecution
  fee_pct: number
  kind: WatchKind
  params: Record<string, number>
  strategy: BacktestStrategy
  symbol: string
  years: number
}

export interface BacktestStats {
  best_trade_pct: number
  cagr_pct: number
  /** Absent in runs saved before protective orders existed. */
  exits?: Record<ExitReason, number>
  exposure_pct: number
  max_drawdown_pct: number
  sharpe: number
  total_return_pct: number
  trades: number
  volatility_pct: number
  win_rate_pct: number
  worst_trade_pct: number
}

export interface BacktestTrade {
  entry_price: number
  entry_ts: number
  exit_price: null | number
  exit_reason?: ExitReason | null
  exit_ts: null | number
  pnl: null | number
  pnl_pct: null | number
  quantity: number
}

export interface BacktestLeg {
  curve: [number, number][]
  stats: BacktestStats
  trades: BacktestTrade[]
}

export interface BacktestRecord {
  benchmark: BacktestLeg
  created: string
  /** Absent (the plain strategy) in runs saved before execution settings existed; so are `notes`. */
  execution?: BacktestExecution
  id: string
  /** `periods_too_long`: a rule needs more bars than the period holds, so it could never trade. */
  notes?: string[]
  params: Record<string, number>
  prices: [number, number][]
  request: Omit<BacktestRequest, 'execution'> & { currency: string; provider_symbol: string }
  result: BacktestLeg
}

export interface BacktestFailure {
  detail?: string
  error: string
  status?: PortfolioStatus
}

export interface BacktestSummary {
  benchmark_pct: null | number
  created: string
  id: string
  request: BacktestRecord['request']
  return_pct: null | number
}

export const backtestRunsKey = ['portfolio', 'backtest', 'runs'] as const

export const runBacktest = (request: BacktestRequest) =>
  call<BacktestFailure | BacktestRecord>('/backtest', { body: { request }, method: 'POST' })

export const fetchBacktestRuns = () => call<{ runs: BacktestSummary[] }>('/backtest/runs')

export const fetchBacktestRun = (id: string) => call<BacktestRecord>(`/backtest/run?id=${encodeURIComponent(id)}`)

export const deleteBacktestRun = (id: string) =>
  call<{ deleted: string }>(`/backtest/run?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
