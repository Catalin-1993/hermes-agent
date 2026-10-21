/** The market-data service's state, with the one button that installs or starts it. Shown on the
 *  Dashboard and on a stocks watchlist — both need the service for their prices. */

import { Button, cn, Codicon, FIGURE_CARD_CLASS, useMutation, useQueryClient } from '@hermes/plugin-sdk'

import { type PortfolioStatus, prepareMarketData } from './api'
import { COPY } from './copy'

/** Live prices need the market-data service: offered once, explained, never installed unasked. */
export function MarketDataCard({
  status,
  where = 'dashboard'
}: {
  status: PortfolioStatus
  /** The Dashboard falls back to journal prices meanwhile; the Watchlist has no fallback to mention. */
  where?: 'dashboard' | 'watchlist'
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

  const message =
    status.env === 'installing'
      ? copy.installing
      : status.service === 'starting'
        ? copy.starting
        : status.env === 'outdated'
          ? copy.outdated
          : status.env === 'error'
            ? `${copy.failed} ${status.error}`
            : status.env === 'ready'
              ? status.error
                ? `${copy.startFailed} ${status.error}`
                : where === 'watchlist'
                  ? copy.stoppedWatchlist
                  : copy.stopped
              : where === 'watchlist'
                ? copy.missingWatchlist
                : copy.missing

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'my-3 flex-row items-center gap-4')} data-portfolio-market-data={status.env}>
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
