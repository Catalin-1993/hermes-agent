/** The market-data service's state, with the one button that installs or starts it. Shown on the
 *  Dashboard and on a stocks watchlist — both need the service for their prices. */

import { Button, cn, Codicon, useMutation, useQueryClient } from '@hermes/plugin-sdk'

import { type PortfolioStatus, prepareMarketData } from './api'
import { COPY } from './copy'
import { CARD } from './ui'

/** Live prices need the market-data service: offered once, explained, never installed unasked. */
type Place = 'backtest' | 'dashboard' | 'research' | 'watchlist'

/** What "not installed" and "stopped" mean depends on the page: the Dashboard falls back to journal prices. */
const PLACE_COPY: Record<Place, { missing: string; stopped: string }> = {
  backtest: { missing: COPY.marketData.missingBacktest, stopped: COPY.marketData.stoppedBacktest },
  dashboard: { missing: COPY.marketData.missing, stopped: COPY.marketData.stopped },
  research: { missing: COPY.marketData.missingResearch, stopped: COPY.marketData.stoppedResearch },
  watchlist: { missing: COPY.marketData.missingWatchlist, stopped: COPY.marketData.stoppedWatchlist }
}

function messageFor(status: PortfolioStatus, where: Place): string {
  const copy = COPY.marketData

  if (status.env === 'installing') {
    return copy.installing
  }

  if (status.service === 'starting') {
    return copy.starting
  }

  if (status.env === 'outdated') {
    return copy.outdated
  }

  if (status.env === 'error') {
    return `${copy.failed} ${status.error}`
  }

  if (status.env !== 'ready') {
    return PLACE_COPY[where].missing
  }

  return status.error ? `${copy.startFailed} ${status.error}` : PLACE_COPY[where].stopped
}

export function MarketDataCard({
  status,
  where = 'dashboard'
}: {
  status: PortfolioStatus
  /** The Dashboard falls back to journal prices meanwhile; the Watchlist has no fallback to mention. */
  where?: Place
}) {
  const queryClient = useQueryClient()

  const prepare = useMutation({
    mutationFn: prepareMarketData,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['portfolio'] })
  })

  if (status.env === 'ready' && status.service === 'running') {
    return null
  }

  const busy = status.env === 'installing' || status.service === 'starting' || prepare.isPending
  const copy = COPY.marketData

  const message = messageFor(status, where)

  return (
    <div
      className={cn(CARD, 'flex-row items-center gap-3.5 px-6 py-4')}
      data-portfolio-market-data={status.env}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--card-well) text-(--ui-text-secondary)">
        <Codicon name={busy ? 'loading' : 'pulse'} size="1rem" spinning={busy} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[0.875rem] font-medium text-(--ui-text-primary)">{copy.title}</div>
        <div className="mt-0.5 text-[0.75rem] leading-relaxed text-(--ui-text-tertiary)">{message}</div>
      </div>
      {!busy && (
        <Button onClick={() => prepare.mutate()} size="sm" variant="secondary">
          {status.env === 'ready' ? copy.start : status.env === 'outdated' ? copy.update : copy.install}
        </Button>
      )}
    </div>
  )
}
