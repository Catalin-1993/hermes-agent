/** What the portfolio holds: how it divides, what moved, and every position. */

import { cn, Codicon } from '@hermes/plugin-sdk'
import { useState } from 'react'

import type { PortfolioDashboard, PortfolioPosition } from './api'
import { AssetIcon } from './asset-icon'
import { COPY } from './copy'
import { euro, percent, signedEuro, toneClass } from './format'
import { BTN, CARD, CARD_PAD, CountPill, H2, HAIRLINE, MUTED } from './ui'

/** The colour of each class, by its place in the allocation: the theme's own series colours, cash last and quiet. */
const CLASS_TOKENS = ['--ui-accent', '--ui-purple', '--ui-yellow', '--ui-orange', '--ui-cyan']
const CASH_CLASS = 'Numerar'

export function classColors(allocation: PortfolioDashboard['allocation']): Record<string, string> {
  let next = 0

  return Object.fromEntries(
    allocation.map(({ name }) => [
      name,
      name === CASH_CLASS ? 'var(--ui-text-tertiary)' : `var(${CLASS_TOKENS[next++ % CLASS_TOKENS.length]})`
    ])
  )
}

const share = (value: number) => `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(value)}%`

const RADIUS = 70
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 3

/** The donut: one arc per class, the total in the middle, and the legend beside it. */
export function Allocation({ allocation, total }: { allocation: PortfolioDashboard['allocation']; total: number }) {
  const copy = COPY.dashboard
  const colors = classColors(allocation)
  const sum = allocation.reduce((all, slice) => all + slice.value, 0) || 1
  let offset = 0

  return (
    <section className={cn(CARD, CARD_PAD, 'h-full gap-4')} data-portfolio-allocation="">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={H2}>{copy.allocationTitle}</h2>
        <span className={cn('text-[0.78125rem]', MUTED)}>{copy.allocationCount(allocation.length)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-8">
        <div className="relative size-44 shrink-0">
          <svg
            aria-label={`${copy.allocationTitle}: ${allocation.map(slice => `${slice.name} ${share(slice.value)}`).join(', ')}`}
            height="176"
            role="img"
            viewBox="0 0 176 176"
            width="176"
          >
            <g fill="none" strokeWidth="14" transform="rotate(-90 88 88)">
              {allocation.map(slice => {
                const length = (slice.value / sum) * CIRCUMFERENCE
                const start = offset
                offset += length

                return (
                  <circle
                    cx="88"
                    cy="88"
                    key={slice.name}
                    r={RADIUS}
                    stroke={colors[slice.name]}
                    strokeDasharray={`${Math.max(length - GAP, 0.5)} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-start}
                  />
                )
              })}
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="font-[family-name:var(--dt-font-display)] text-[1.625rem] leading-none tabular-nums text-(--ui-text-primary)">
              {euro(total, 0)}
            </span>
            <span className={cn('text-xs', MUTED)}>{copy.allocationTotal}</span>
          </div>
        </div>
        <ul className="m-0 flex min-w-48 flex-1 list-none flex-col p-0">
          {allocation.map(slice => (
            <li className={cn('flex items-center gap-3 border-b py-[9px] last:border-b-0', HAIRLINE)} key={slice.name}>
              <span className="size-[9px] shrink-0 rounded-[3px]" style={{ background: colors[slice.name] }} />
              <span className="flex-1 text-(--ui-text-secondary)">{slice.name}</span>
              <span className="font-medium tabular-nums text-(--ui-text-primary)">{share(slice.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Tile({
  label,
  name,
  tone,
  value,
  worth
}: {
  label: string
  name: string
  tone?: number
  value: string
  worth: number
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-[14px] border border-(--card-well-stroke) bg-(--card-well) p-4">
      <span className={cn('text-[0.78125rem]', MUTED)}>{label}</span>
      <span className="truncate text-sm font-medium text-(--ui-text-primary)">{name}</span>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'text-[1.375rem] font-medium tabular-nums',
            tone === undefined ? 'text-(--ui-text-primary)' : toneClass(tone)
          )}
        >
          {value}
        </span>
        <span className={cn('text-[0.78125rem] tabular-nums', MUTED)}>{euro(worth, 0)}</span>
      </div>
    </div>
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
    <section className={cn(CARD, CARD_PAD, 'h-full gap-4')} data-portfolio-highlights="">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={H2}>{copy.title}</h2>
        <span className={cn('text-[0.78125rem]', MUTED)}>{copy.subtitle}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
        <Tile
          label={copy.best}
          name={best.name}
          tone={best.pnl_pct}
          value={percent(best.pnl_pct, true)}
          worth={best.value}
        />
        <Tile
          label={copy.worst}
          name={worst.name}
          tone={worst.pnl_pct}
          value={percent(worst.pnl_pct, true)}
          worth={worst.value}
        />
        <Tile
          label={copy.today}
          name={today.name}
          tone={today.day_change_pct}
          value={percent(today.day_change_pct, true)}
          worth={today.value}
        />
        <Tile label={copy.largest} name={largest.name} value={percent(largest.weight)} worth={largest.value} />
      </div>
    </section>
  )
}

function Change({ pct, value }: { pct: number; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={toneClass(value)}>{percent(pct, true)}</span>
      <span className={cn('text-xs', MUTED)}>{signedEuro(value)}</span>
    </div>
  )
}

const VISIBLE = 6
const CELL = 'px-4 py-3.5 text-right align-middle whitespace-nowrap tabular-nums'
const HEAD = 'px-4 py-3 text-right text-xs font-medium whitespace-nowrap'

export function PositionsTable({
  allocation,
  positions
}: {
  allocation: PortfolioDashboard['allocation']
  positions: PortfolioPosition[]
}) {
  const copy = COPY.positions
  const [all, setAll] = useState(false)
  const colors = classColors(allocation)
  const shown = all ? positions : positions.slice(0, VISIBLE)

  return (
    <section className={cn(CARD, 'overflow-hidden')} data-portfolio-positions="">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <h2 className={H2}>{copy.title}</h2>
          <CountPill>{positions.length}</CountPill>
        </div>
        <span className={cn('text-[0.78125rem]', MUTED)}>{copy.sorted}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className={cn('border-b text-(--ui-text-tertiary)', HAIRLINE)}>
              <th className={cn(HEAD, 'pl-6 text-left')} scope="col">
                {copy.asset}
              </th>
              <th className={HEAD} scope="col">
                {copy.price}
              </th>
              <th className={HEAD} scope="col">
                {copy.today}
              </th>
              <th className={HEAD} scope="col">
                {copy.value}
              </th>
              <th className={HEAD} scope="col">
                {copy.weight}
              </th>
              <th className={cn(HEAD, 'pr-6')} scope="col">
                {copy.return}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map(position => (
              <tr
                className={cn('border-b transition-colors last:border-b-0 hover:bg-(--card-well)', HAIRLINE)}
                key={position.symbol}
              >
                <td className={cn(CELL, 'pl-6 text-left')}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-(--card-well)">
                      <AssetIcon
                        kind={position.class === 'Cripto' ? 'crypto' : 'stocks'}
                        size={22}
                        symbol={position.symbol}
                      />
                    </span>
                    <div className="flex min-w-0 max-w-80 flex-col gap-0.5">
                      <span className="truncate font-medium text-(--ui-text-primary)">{position.name}</span>
                      <span className={cn('text-xs', MUTED)}>
                        {position.symbol} · {position.class}
                      </span>
                    </div>
                  </div>
                </td>
                <td className={cn(CELL, 'text-(--ui-text-primary)')}>
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
                <td className={CELL}>
                  <Change pct={position.day_change_pct} value={position.day_change} />
                </td>
                <td className={CELL}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-(--ui-text-primary)">{euro(position.value, 2)}</span>
                    <span className={cn('text-xs', MUTED)}>
                      {position.quantity.toLocaleString('ro-RO', { maximumFractionDigits: 6 })} {position.symbol}
                    </span>
                  </div>
                </td>
                <td className={CELL}>
                  <div className="flex items-center justify-end gap-2.5">
                    <span>{percent(position.weight)}</span>
                    <span className="block h-1 w-16 overflow-hidden rounded bg-(--card-well)">
                      <span
                        className="block h-full"
                        style={{
                          background: colors[position.class] ?? 'var(--ui-text-tertiary)',
                          width: `${Math.min(100, position.weight)}%`
                        }}
                      />
                    </span>
                  </div>
                </td>
                <td className={cn(CELL, 'pr-6')}>
                  <Change pct={position.pnl_pct} value={position.pnl} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {positions.length > VISIBLE && (
        <div className="flex justify-center px-6 pt-3.5 pb-4">
          <button className={BTN} onClick={() => setAll(current => !current)} type="button">
            {all ? copy.showFewer : copy.showAll(positions.length)}
            <Codicon name={all ? 'chevron-up' : 'chevron-down'} size="0.8125rem" />
          </button>
        </div>
      )}
    </section>
  )
}
