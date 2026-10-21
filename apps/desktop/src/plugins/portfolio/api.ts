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
