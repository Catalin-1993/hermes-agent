/**
 * The asset sheet: what the page knows about one coin or stock without an agent — its price path
 * (returns, the 52-week range, moving averages, RSI, volatility, drawdown) and, for stocks and ETFs,
 * the provider's profile and headline numbers. Provider fields it does not recognise are left out.
 */

import { cn, FIGURE_CARD_CLASS } from '@hermes/plugin-sdk'
import { useState } from 'react'

import type { ResearchSheet } from './api'
import { COPY } from './copy'
import { dateLabel, percent, quotePrice, shortAmount, toneClass } from './format'

const TITLE = 'text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)'

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

function Fact({ hint, label, tone, value }: { hint?: string; label: string; tone?: number; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-[0.875rem] font-medium tabular-nums',
          tone === undefined ? 'text-(--ui-text-primary)' : toneClass(tone)
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{hint}</div>}
    </div>
  )
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

function PricePath({ sheet }: { sheet: ResearchSheet }) {
  const copy = COPY.research.sheet
  const t = sheet.technicals

  if (!t?.price) {
    return (
      <p className="text-[0.8125rem] text-(--ui-text-tertiary)">
        {sheet.error ? copy.noPrices(sheet.error) : copy.noHistory}
      </p>
    )
  }

  const change = (key: '1m' | '1w' | '1y' | '3m') => {
    const value = t.change?.[key]

    return value === null || value === undefined ? { value: '—' } : { tone: value, value: percent(value, true) }
  }

  const trend = trendLine(t.price, t.sma50, t.sma200)

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(['1w', '1m', '3m', '1y'] as const).map(key => (
          <Fact key={key} label={copy.periods[key]} {...change(key)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Fact label={copy.high52} value={quotePrice(t.high_52w ?? 0)} />
        <Fact label={copy.low52} value={quotePrice(t.low_52w ?? 0)} />
        <Fact label={copy.fromHigh} tone={t.from_high_pct} value={percent(t.from_high_pct ?? 0, true)} />
        <Fact
          hint={rsiHint(t.rsi14)}
          label={copy.rsi}
          value={t.rsi14 === null || t.rsi14 === undefined ? '—' : t.rsi14.toFixed(0)}
        />
        <Fact label={copy.sma50} value={t.sma50 ? quotePrice(t.sma50) : '—'} />
        <Fact label={copy.sma200} value={t.sma200 ? quotePrice(t.sma200) : '—'} />
        <Fact label={copy.volatility} value={percent(t.volatility_pct ?? 0)} />
        <Fact label={copy.drawdown} tone={t.max_drawdown_pct} value={percent(t.max_drawdown_pct ?? 0, true)} />
      </div>
      {trend && <p className="text-[0.8125rem] text-(--ui-text-secondary)">{trend}</p>}
    </>
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
      <p className="text-[0.8125rem] text-(--ui-text-tertiary)">
        {profile.error === 'restart' ? copy.restart : copy.noProfile}
      </p>
    )
  }

  return (
    <>
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
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
    </>
  )
}

export function SheetCard({ sheet }: { sheet: ResearchSheet }) {
  const copy = COPY.research.sheet
  const about = sheet.profile?.profile ?? {}
  const name = String(about.name ?? about.long_name ?? '')
  const sector = [about.sector, about.industry].filter(Boolean).join(' · ')
  const t = sheet.technicals

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'gap-4')} data-portfolio-sheet={sheet.symbol}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={TITLE}>
            {sheet.symbol}
            {name && <span className="font-normal text-(--ui-text-tertiary)"> · {name}</span>}
          </div>
          <div className="text-[0.75rem] text-(--ui-text-tertiary)">
            {sector || (sheet.kind === 'crypto' ? copy.crypto : sheet.profile?.fund ? copy.fund : copy.stock)}
          </div>
        </div>
        {t?.price && (
          <div className="text-right tabular-nums">
            <div className="text-[1.5rem] leading-none font-semibold tracking-[-0.02em] text-(--ui-text-primary)">
              {quotePrice(t.price)}{' '}
              <span className="text-[0.875rem] font-normal text-(--ui-text-tertiary)">{sheet.currency}</span>
            </div>
            <div className="mt-1 text-[0.6875rem] text-(--ui-text-tertiary)">
              {t.date ? copy.closeOf(dateLabel(t.date)) : null}
            </div>
          </div>
        )}
      </div>
      <PricePath sheet={sheet} />
      {sheet.profile && <Fundamentals profile={sheet.profile} />}
    </div>
  )
}
