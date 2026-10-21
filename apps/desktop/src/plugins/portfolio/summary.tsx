/** The top of the dashboard: the numbers that matter as plain text on the page — no boxes. */

import { cn } from '@hermes/plugin-sdk'

import type { PortfolioDashboard } from './api'
import { COPY } from './copy'
import { dateLabel, euro, percent, signedEuro, toneClass } from './format'

function Stat({ hint, label, tone, value }: { hint?: string; label: string; tone?: number; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.75rem] text-(--ui-text-tertiary)">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-[1.125rem] font-semibold tracking-[-0.01em] tabular-nums',
          tone === undefined ? 'text-(--ui-text-primary)' : toneClass(tone)
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[0.6875rem] text-(--ui-text-tertiary)">{hint}</div>}
    </div>
  )
}

export function Summary({ data }: { data: PortfolioDashboard }) {
  const copy = COPY.dashboard
  const share = data.total ? (data.cash / data.total) * 100 : 0

  return (
    <section className="flex flex-col gap-6 pt-6 pb-2" data-portfolio-summary="">
      <div>
        <div className="text-[0.8125rem] text-(--ui-text-tertiary)">{copy.total}</div>
        <div className="mt-1 text-[2.75rem] leading-none font-semibold tracking-[-0.035em] tabular-nums text-(--ui-text-primary)">
          {euro(data.total, 2)}
        </div>
        <div
          className={cn(
            'mt-2 flex flex-wrap items-baseline gap-x-2 text-[0.9375rem] font-medium tabular-nums',
            toneClass(data.pnl)
          )}
        >
          <span>
            {signedEuro(data.pnl)} · {percent(data.pnl_pct, true)}
          </span>
          <span className="text-[0.75rem] font-normal text-(--ui-text-tertiary)">
            {copy.sinceStart(dateLabel(data.started))}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
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
    </section>
  )
}
