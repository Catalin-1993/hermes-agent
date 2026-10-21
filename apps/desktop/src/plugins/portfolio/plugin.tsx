/**
 * Portfolio — portfolio management in the app: a sidebar row under Library and a full page with
 * Dashboard, Watchlist, Backtesting, Research and Plan. Its data comes from the plugin's own router
 * (`plugins/portfolio/dashboard/plugin_api.py`), which keeps market data and backtesting in their
 * own process. On by default.
 */

import {
  type HermesPlugin,
  host,
  PALETTE_AREA,
  type PaletteContribution,
  type RouteContribution,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  type SidebarNavContribution
} from '@hermes/plugin-sdk'

import { bindPortfolioApi } from './api'
import { COPY } from './copy'
import { PortfolioPage } from './page'
import { bindPortfolioStorage } from './storage'

export const PORTFOLIO_ROUTE = '/portfolio'

const plugin: HermesPlugin = {
  id: 'portfolio',
  name: 'Portofoliu',
  description:
    'Portfolio management: the simulated portfolio at market prices, watchlist, backtesting, research and plan.',
  defaultEnabled: true,
  register(ctx) {
    ctx.onDispose(bindPortfolioApi(ctx.rest))
    ctx.onDispose(bindPortfolioStorage(ctx.storage))

    ctx.registerMany([
      {
        id: 'page',
        area: ROUTES_AREA,
        data: { path: PORTFOLIO_ROUTE } satisfies RouteContribution,
        render: () => <PortfolioPage />
      },
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        order: 40,
        data: { codicon: 'graph-line', label: COPY.nav, path: PORTFOLIO_ROUTE } satisfies SidebarNavContribution
      },
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: 'portfolio.open',
          label: COPY.openPage,
          keywords: ['portfolio', 'portofoliu', 'investitii', 'dashboard', 'watchlist', 'backtest'],
          run: () => host.navigate(PORTFOLIO_ROUTE)
        } satisfies PaletteContribution
      }
    ])
  }
}

export default plugin
