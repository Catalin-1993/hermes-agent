/**
 * The asset sheet: what the page knows about one coin or stock without an agent — its price path
 * (returns, the 52-week range, moving averages, RSI, volatility, drawdown) and, for stocks and ETFs,
 * the provider's profile and headline numbers. Provider fields it does not recognise are left out.
 */

import { cn, Codicon } from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import type { ResearchSheet } from './api'
import { AssetIcon } from './asset-icon'
import { COPY } from './copy'
import { dateLabel, percent, quotePrice, shortAmount, toneClass } from './format'
import { CARD, DISPLAY, HAIRLINE, MUTED } from './ui'

type Format = 'amount' | 'pct' | 'ratio' | 'text'

/** Provider fields shown, in this order, with how each reads. Fractions (0.012) are percent fields. */
const METRICS: [string, Format][] = [
  ['market_cap', 'amount'],
  ['total_assets', 'amount'],
  ['pe_ratio', 'ratio'],
  ['forward_pe', 'ratio'],
  ['peg_ratio', 'ratio'],
  ['price_to_book', 'ratio'],
  ['enterprise_to_ebitda', 'ratio'],
  ['dividend_yield', 'pct'],
  ['expense_ratio', 'pct'],
  ['profit_margin', 'pct'],
  ['return_on_equity', 'pct'],
  ['revenue_growth', 'pct'],
  ['earnings_growth', 'pct'],
  ['debt_to_equity', 'ratio'],
  ['beta', 'ratio'],
  ['fund_family', 'text'],
  ['category', 'text']
]

function formatted(value: unknown, format: Format): null | string {
  if (format === 'text') {
    return typeof value === 'string' && value.trim() ? value : null
  }

  const number = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(number)) {
    return null
  }

  return format === 'amount' ? shortAmount(number) : format === 'pct' ? percent(number * 100) : quotePrice(number)
}

/** A small figure on a well: a label above, the number below. */
function Tile({
  children,
  footer,
  label,
  tone,
  value
}: {
  children?: ReactNode
  footer?: ReactNode
  label: string
  tone?: number
  value: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[12px] border border-(--card-well-stroke) bg-(--card-well) px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('text-[0.78125rem]', MUTED)}>{label}</span>
        {children}
      </div>
      <span
        className={cn(
          'text-[0.9375rem] font-medium tabular-nums',
          tone === undefined ? 'text-(--ui-text-primary)' : toneClass(tone)
        )}
      >
        {value}
      </span>
      {footer}
    </div>
  )
}

/** The provider's own figures, in the same small form. */
function Fact({ label, tone, value }: { label: string; tone?: number; value: string }) {
  return <Tile label={label} tone={tone} value={value} />
}

function rsiHint(rsi: null | number | undefined) {
  const copy = COPY.research.sheet

  return rsi === null || rsi === undefined
    ? undefined
    : rsi >= 70
      ? copy.overbought
      : rsi <= 30
        ? copy.oversold
        : copy.neutral
}

function trendLine(price: number, sma50?: null | number, sma200?: null | number): null | string {
  const copy = COPY.research.sheet

  if (!sma200) {
    return null
  }

  const above = price >= sma200

  return sma50 ? copy.trend(above, sma50 >= sma200) : copy.trend(above, null)
}

/** The price over 1 week to 1 year as four cells divided by hairlines, edge to edge of the card. */
function Periods({ sheet }: { sheet: ResearchSheet }) {
  const copy = COPY.research.sheet
  const t = sheet.technicals

  return (
    <div
      className={cn(
        'grid grid-cols-[repeat(auto-fit,minmax(min(110px,100%),1fr))] gap-px border-y bg-(--card-well-stroke)',
        HAIRLINE
      )}
    >
      {(['1w', '1m', '3m', '1y'] as const).map(key => {
        const value = t?.change?.[key]

        return (
          <div className="flex flex-col gap-0.5 bg-(--card-surface) px-6 py-2.5" key={key}>
            <span className={cn('text-[0.78125rem]', MUTED)}>{copy.periods[key]}</span>
            <span
              className={cn(
                'text-[1.0625rem] font-medium tabular-nums',
                value === null || value === undefined ? MUTED : toneClass(value)
              )}
            >
              {value === null || value === undefined ? '—' : percent(value, true)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RsiTile({ rsi }: { rsi: null | number | undefined }) {
  const copy = COPY.research.sheet
  const known = rsi !== null && rsi !== undefined

  return (
    <Tile
      footer={
        known && (
          <span
            className="relative mt-1 block h-1 rounded"
            style={{
              background:
                'linear-gradient(90deg, color-mix(in srgb, var(--ui-accent) 28%, transparent) 0 30%, var(--card-well-stroke) 30% 70%, color-mix(in srgb, var(--ui-orange) 32%, transparent) 70% 100%)'
            }}
          >
            <span
              className="absolute -top-[3px] h-2.5 w-0.5 rounded bg-(--ui-text-primary)"
              style={{ left: `${Math.min(100, Math.max(0, rsi))}%` }}
            />
          </span>
        )
      }
      label={copy.rsi}
      value={known ? rsi.toFixed(0) : '—'}
    >
      <span className="text-xs text-(--ui-text-secondary)">{rsiHint(rsi)}</span>
    </Tile>
  )
}

function TrendBanner({ rising, text }: { rising: boolean; text: string }) {
  const copy = COPY.research.sheet
  const tone = rising ? 'var(--ui-green)' : 'var(--ui-red)'

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-[12px] border px-3.5 py-2.5"
      style={{
        background: `color-mix(in srgb, ${tone} 7%, transparent)`,
        borderColor: `color-mix(in srgb, ${tone} 18%, transparent)`
      }}
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.78125rem] font-semibold whitespace-nowrap"
        style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}
      >
        <Codicon name={rising ? 'graph' : 'graph-line'} size="0.8125rem" />
        {rising ? copy.trendUp : copy.trendDown}
      </span>
      <span className="min-w-60 flex-1 text-[0.84375rem] text-(--ui-text-secondary)">{text}</span>
    </div>
  )
}

/** Where the price stands between its 52-week low and high, with the moving averages, RSI and risk beneath. */
function PricePath({ sheet }: { sheet: ResearchSheet }) {
  const copy = COPY.research.sheet
  const t = sheet.technicals

  if (!t?.price) {
    return (
      <p className={cn('m-0 px-6 pb-5 text-[0.8125rem]', MUTED)}>
        {sheet.error ? copy.noPrices(sheet.error) : copy.noHistory}
      </p>
    )
  }

  const low = t.low_52w ?? 0
  const high = t.high_52w ?? 0
  const at = high > low ? Math.min(100, Math.max(0, ((t.price - low) / (high - low)) * 100)) : 0
  const trend = trendLine(t.price, t.sma50, t.sma200)
  const rising = !t.sma200 || t.price >= t.sma200
  const rsi = t.rsi14

  return (
    <div className="flex flex-col gap-3.5 px-6 pt-4 pb-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-[0.84375rem] font-medium text-(--ui-text-primary)">{copy.range52}</span>
          <span className="text-[0.78125rem] tabular-nums text-(--ui-text-secondary)">
            {copy.fromHigh}{' '}
            <span className={cn('font-medium', toneClass(t.from_high_pct ?? 0))}>
              {percent(t.from_high_pct ?? 0, true)}
            </span>
          </span>
        </div>
        <div className="relative h-[34px]">
          <div className="absolute inset-x-0 top-[15px] h-1 rounded bg-(--card-well)" />
          <div className="absolute top-[15px] left-0 h-1 rounded bg-(--ui-accent)" style={{ width: `${at}%` }} />
          <div
            className="absolute top-[9px] size-4 -translate-x-1/2 rounded-full bg-(--ui-text-primary) shadow-[0_0_0_4px_var(--card-surface)]"
            style={{ left: `${at}%` }}
          />
        </div>
        <div className="-mt-2 flex justify-between gap-3 text-[0.78125rem] tabular-nums">
          <span className="flex flex-col gap-0.5">
            <span className={MUTED}>{copy.low52}</span>
            <span className="font-medium text-(--ui-text-primary)">{quotePrice(low)}</span>
          </span>
          <span className="flex flex-col items-end gap-0.5 text-right">
            <span className={MUTED}>{copy.high52}</span>
            <span className="font-medium text-(--ui-text-primary)">{quotePrice(high)}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-2.5">
        <Tile label={copy.sma50} value={t.sma50 ? quotePrice(t.sma50) : '—'} />
        <Tile label={copy.sma200} value={t.sma200 ? quotePrice(t.sma200) : '—'} />
        <RsiTile rsi={rsi} />
        <Tile label={copy.volatility} value={percent(t.volatility_pct ?? 0)} />
        <Tile label={copy.drawdown} tone={t.max_drawdown_pct} value={percent(t.max_drawdown_pct ?? 0, true)} />
      </div>

      {trend && <TrendBanner rising={rising} text={trend} />}
    </div>
  )
}

function Fundamentals({ profile }: { profile: NonNullable<ResearchSheet['profile']> }) {
  const copy = COPY.research.sheet
  const [open, setOpen] = useState(false)
  const about = profile.profile ?? {}
  const pick = (key: string) => profile.metrics?.[key] ?? about[key]

  const rows = METRICS.map(([key, format]) => ({ key, value: formatted(pick(key), format) })).filter(
    (row): row is { key: string; value: string } => row.value !== null
  )

  const description = String(about.long_description ?? about.description ?? '')

  if (profile.error) {
    return (
      <p className={cn('m-0 px-6 pb-5 text-[0.8125rem]', MUTED)}>
        {profile.error === 'restart' ? copy.restart : copy.noProfile}
      </p>
    )
  }

  if (!rows.length && !description) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 px-6 pb-5">
      {rows.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-2.5">
          {rows.map(row => (
            <Fact
              key={row.key}
              label={copy.metrics[row.key as keyof typeof copy.metrics] ?? row.key}
              value={row.value}
            />
          ))}
        </div>
      )}
      {description && (
        <div className="text-[0.8125rem] leading-relaxed text-(--ui-text-secondary)">
          <p className={cn(!open && 'line-clamp-3')}>{description}</p>
          <button
            className="mt-1 cursor-pointer text-[0.75rem] text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
            onClick={() => setOpen(!open)}
            type="button"
          >
            {open ? copy.less : copy.more}
          </button>
        </div>
      )}
    </div>
  )
}

export function SheetCard({ sheet }: { sheet: ResearchSheet }) {
  const copy = COPY.research.sheet
  const about = sheet.profile?.profile ?? {}
  const name = String(about.name ?? about.long_name ?? '')
  const sector = [about.sector, about.industry].filter(Boolean).join(' · ')
  const t = sheet.technicals

  return (
    <section aria-label={sheet.symbol} className={cn(CARD, 'overflow-hidden')} data-portfolio-sheet={sheet.symbol}>
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-(--card-well)">
            <AssetIcon kind={sheet.kind} size={28} symbol={sheet.symbol} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xl font-semibold tracking-[-0.01em] text-(--ui-text-primary)">
              {sheet.symbol}
              {name && <span className="text-[0.9375rem] font-normal text-(--ui-text-tertiary)"> · {name}</span>}
            </span>
            <span className={cn('text-[0.8125rem]', MUTED)}>
              {sector || (sheet.kind === 'crypto' ? copy.crypto : sheet.profile?.fund ? copy.fund : copy.stock)}
            </span>
          </div>
        </div>
        {t?.price && (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  DISPLAY,
                  'text-[2.5rem] leading-[0.95] tracking-[-0.02em] tabular-nums text-(--ui-text-primary)'
                )}
              >
                {quotePrice(t.price)}
              </span>
              <span className="text-[0.9375rem] text-(--ui-text-secondary)">{sheet.currency}</span>
            </div>
            <span className={cn('text-[0.78125rem]', MUTED)}>{t.date ? copy.closeOf(dateLabel(t.date)) : null}</span>
          </div>
        )}
      </div>
      {t?.price && <Periods sheet={sheet} />}
      <PricePath sheet={sheet} />
      {sheet.profile && <Fundamentals profile={sheet.profile} />}
    </section>
  )
}
