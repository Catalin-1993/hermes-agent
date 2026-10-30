/** The strip of figures at the foot of the dashboard's value card, and the dashboard's shape while it loads. */

import { cn, Skeleton } from '@hermes/plugin-sdk'

import type { PortfolioDashboard } from './api'
import { COPY } from './copy'
import { euro, percent, signedEuro, toneClass } from './format'
import { CARD, HAIRLINE, MUTED } from './ui'

function Stat({ hint, label, tone, value }: { hint?: string; label: string; tone?: number; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3.5 py-1">
      <span className={cn('truncate text-[0.71875rem]', MUTED)}>{label}</span>
      <span
        className={cn(
          'truncate text-[1rem] font-medium tracking-[-0.01em] tabular-nums',
          tone === undefined ? 'text-(--ui-text-primary)' : toneClass(tone)
        )}
      >
        {value}
      </span>
      {hint && <span className={cn('text-[0.6875rem] tabular-nums', MUTED)}>{hint}</span>}
    </div>
  )
}

/** Today, cash, invested and fees: four small figures in a row beside the total, divided by hairlines. */
export function StatStrip({ data }: { data: PortfolioDashboard }) {
  const copy = COPY.dashboard
  const share = data.total ? (data.cash / data.total) * 100 : 0

  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-2 gap-y-3 rounded-2xl border bg-(--card-well) py-2.5 sm:grid-cols-4 sm:divide-x sm:divide-(--card-well-stroke)',
        HAIRLINE
      )}
      data-portfolio-summary=""
    >
      <Stat
        hint={percent(data.day_change_pct, true)}
        label={copy.today}
        tone={data.day_change}
        value={signedEuro(data.day_change)}
      />
      <Stat hint={copy.ofPortfolio(percent(share))} label={copy.cash} value={euro(data.cash, 2)} />
      <Stat hint={copy.positionsCount(data.positions.length)} label={copy.invested} value={euro(data.invested, 2)} />
      <Stat hint={copy.feesHint} label={copy.fees} value={euro(data.fees, 2)} />
    </div>
  )
}

/** The dashboard's shape while it loads — the same blocks at the same sizes, so nothing moves when the numbers arrive. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label={COPY.dashboard.loading} className="flex flex-col gap-4" role="status">
      <div className="flex flex-col gap-2 pb-2">
        <Skeleton className="h-11 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className={cn(CARD, 'h-[34rem]')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(CARD, 'h-80')} />
        <div className={cn(CARD, 'h-80')} />
      </div>
    </div>
  )
}
