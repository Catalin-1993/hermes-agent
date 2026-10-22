/** What the portfolio holds: how it divides, what moved, and every position. */

import { ChartFigure, cn, FIGURE_CARD_CLASS, parseChartSpec } from '@hermes/plugin-sdk'
import { useMemo } from 'react'

import type { PortfolioDashboard, PortfolioPosition } from './api'
import { AssetIcon } from './asset-icon'
import { COPY } from './copy'
import { euro, percent, signedEuro, toneClass } from './format'

const TITLE = 'text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)'

export function Allocation({ allocation }: { allocation: PortfolioDashboard['allocation'] }) {
  const spec = useMemo(
    () =>
      parseChartSpec(
        JSON.stringify({
          currency: 'EUR',
          format: 'currency',
          slices: allocation,
          title: COPY.dashboard.allocationTitle,
          type: 'donut'
        })
      ),
    [allocation]
  )

  return 'spec' in spec ? (
    <div className="min-w-0 [&>*]:my-0 [&>*]:h-full">
      <ChartFigure spec={spec.spec} toolbar={false} />
    </div>
  ) : null
}

function Row({ label, position, value }: { label: string; position: PortfolioPosition; value: number }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{label}</div>
        <div className="truncate text-[0.875rem] font-medium text-(--ui-text-primary)">{position.name}</div>
      </div>
      <div className={cn('shrink-0 text-right text-[0.875rem] font-medium tabular-nums', toneClass(value))}>
        {percent(value, true)}
        <div className="text-[0.6875rem] font-normal text-(--ui-text-tertiary)">{euro(position.value, 0)}</div>
      </div>
    </li>
  )
}

/** The best and worst since purchase, the best of today, and the largest holding. */
export function Highlights({ positions }: { positions: PortfolioPosition[] }) {
  const copy = COPY.highlights

  if (!positions.length) {
    return null
  }

  const by = (pick: (position: PortfolioPosition) => number, order: 1 | -1) =>
    positions.reduce((best, next) => (order * pick(next) > order * pick(best) ? next : best))

  const best = by(position => position.pnl_pct, 1)
  const worst = by(position => position.pnl_pct, -1)
  const today = by(position => position.day_change_pct, 1)
  const largest = by(position => position.weight, 1)

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'h-full gap-1')} data-portfolio-highlights="">
      <div className={TITLE}>{copy.title}</div>
      <ul className="divide-y divide-(--card-well-stroke)">
        <Row label={copy.best} position={best} value={best.pnl_pct} />
        <Row label={copy.worst} position={worst} value={worst.pnl_pct} />
        <Row label={copy.today} position={today} value={today.day_change_pct} />
        <li className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.largest}</div>
            <div className="truncate text-[0.875rem] font-medium text-(--ui-text-primary)">{largest.name}</div>
          </div>
          <div className="shrink-0 text-right text-[0.875rem] font-medium tabular-nums text-(--ui-text-primary)">
            {percent(largest.weight)}
            <div className="text-[0.6875rem] font-normal text-(--ui-text-tertiary)">{euro(largest.value, 0)}</div>
          </div>
        </li>
      </ul>
    </div>
  )
}

function Change({ pct, value }: { pct: number; value: number }) {
  return (
    <span className={cn('tabular-nums', toneClass(value))}>
      {percent(pct, true)}
      <span className="block text-[0.6875rem] opacity-80">{signedEuro(value)}</span>
    </span>
  )
}

export function PositionsTable({ positions }: { positions: PortfolioPosition[] }) {
  const copy = COPY.positions
  const head = 'px-2 py-2 font-medium'

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'gap-2')} data-portfolio-positions="">
      <div className={TITLE}>{copy.title}</div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-[0.8125rem]">
          <thead>
            <tr className="text-[0.75rem] text-(--ui-text-tertiary)">
              <th className={cn(head, 'text-left')}>{copy.asset}</th>
              <th className={cn(head, 'text-right')}>{copy.price}</th>
              <th className={cn(head, 'text-right')}>{copy.today}</th>
              <th className={cn(head, 'text-right')}>{copy.value}</th>
              <th className={cn(head, 'text-right')}>{copy.weight}</th>
              <th className={cn(head, 'text-right')}>{copy.return}</th>
            </tr>
          </thead>
          <tbody>
            {positions.map(position => (
              <tr
                className="border-t border-(--card-well-stroke) transition-colors hover:bg-(--card-well)"
                key={position.symbol}
              >
                <td className="max-w-64 px-2 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <AssetIcon
                      kind={position.class === 'Cripto' ? 'crypto' : 'stocks'}
                      size={26}
                      symbol={position.symbol}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-(--ui-text-primary)">{position.name}</div>
                      <div className="text-[0.6875rem] text-(--ui-text-tertiary)">
                        {position.symbol} · {position.class}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-(--ui-text-secondary)">
                  {euro(position.price, position.price < 10 ? 4 : 2)}
                  {position.source === 'jurnal' && (
                    <span
                      className="ml-1.5 rounded-full bg-(--card-well) px-1.5 py-px text-[0.625rem] text-(--ui-text-tertiary)"
                      title={copy.journalPriceTip}
                    >
                      {copy.journalPrice}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-right">
                  <Change pct={position.day_change_pct} value={position.day_change} />
                </td>
                <td className="px-2 py-2.5 text-right font-medium tabular-nums text-(--ui-text-primary)">
                  {euro(position.value, 2)}
                  <span className="block text-[0.6875rem] font-normal text-(--ui-text-tertiary)">
                    {position.quantity.toLocaleString('ro-RO', { maximumFractionDigits: 6 })} {position.symbol}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-(--ui-text-secondary)">
                  {percent(position.weight)}
                  <span className="mt-1 ml-auto block h-1 w-14 overflow-hidden rounded-full bg-(--card-well)">
                    <span
                      className="block h-full rounded-full bg-(--ui-text-tertiary)"
                      style={{ width: `${Math.min(100, position.weight)}%` }}
                    />
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <Change pct={position.pnl_pct} value={position.pnl} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
