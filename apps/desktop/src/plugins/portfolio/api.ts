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

export interface PortfolioWatchlist {
  saved: boolean
  symbols: string[]
}

export const watchlistKey = ['portfolio', 'watchlist'] as const

export const fetchWatchlist = () => call<PortfolioWatchlist>('/watchlist')

export const saveWatchlist = (symbols: string[]) =>
  call<PortfolioWatchlist>('/watchlist', { body: { symbols }, method: 'PUT' })
