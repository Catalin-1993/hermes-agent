/**
 * The chart's other views, chosen from the menu beside the symbol's name: Technicals and Seasonals (read
 * from the symbol's own bars, for coins and stocks), and Derivatives, News and Community (public coin data,
 * in `analysis-market.tsx`). Each sits in the same card as the chart, under the symbol's header.
 */

import { cn } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'

import { CommunityView, DerivativesView, NewsView } from './analysis-market'
import type { WatchKind } from './api'
import type { View } from './chart-topbar'
import { COPY } from './copy'
import type { Bar, Interval } from './market-feed'
import { Gauge } from './mini-charts'
import { seasonals } from './seasonals'
import { type Signal, type Tally, technicals } from './technicals'
import { useBars } from './use-bars'

export function ViewShell({
  children,
  note,
  title,
  view
}: {
  children: ReactNode
  note?: string
  title: string
  view: View
}) {
  return (
    <div
      className="flex flex-col gap-4 border-t border-(--card-well-stroke) px-6 pt-4 pb-5"
      data-portfolio-analysis={view}
    >
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-[1.0625rem] font-medium text-(--ui-text-primary)">{title}</h3>
        {note && <p className="m-0 max-w-3xl text-[0.8125rem] text-(--ui-text-tertiary)">{note}</p>}
      </div>
      {children}
    </div>
  )
}

export const Message = ({ children }: { children: ReactNode }) => (
  <div className="grid min-h-40 place-items-center text-center text-[0.8125rem] text-(--ui-text-tertiary)">
    {children}
  </div>
)

const ACTION_TONE = {
  buy: 'text-(--ui-green)',
  neutral: 'text-(--ui-text-tertiary)',
  sell: 'text-(--ui-red)'
} as const

function GaugeCard({ tally, title }: { tally: Tally; title: string }) {
  const copy = COPY.analysis

  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl bg-(--card-well) px-4 py-4">
      <span className="text-[0.84375rem] font-medium text-(--ui-text-secondary)">{title}</span>
      <Gauge className="max-w-60" score={tally.score} title={`${title}: ${copy.verdict[tally.verdict]}`} />
      <span
        className={cn(
          'text-[1.0625rem] font-semibold',
          tally.score > 0.1
            ? 'text-(--ui-green)'
            : tally.score < -0.1
              ? 'text-(--ui-red)'
              : 'text-(--ui-text-secondary)'
        )}
      >
        {copy.verdict[tally.verdict]}
      </span>
      <span className="text-[0.71875rem] text-(--ui-text-tertiary) tabular-nums">
        {COPY.analysis.technicals.votes(tally.sell, tally.neutral, tally.buy)}
      </span>
    </div>
  )
}

const number = new Intl.NumberFormat('ro-RO', { maximumSignificantDigits: 7 })

function SignalTable({ signals, title }: { signals: Signal[]; title: string }) {
  const copy = COPY.analysis.technicals

  return (
    <div className="min-w-0">
      <h4 className="m-0 pb-2 text-[0.9375rem] font-medium text-(--ui-text-primary)">{title}</h4>
      <table className="w-full border-collapse text-[0.8125rem]">
        <thead>
          <tr className="text-left text-[0.71875rem] text-(--ui-text-tertiary)">
            <th className="py-1.5 font-normal">{copy.name}</th>
            <th className="py-1.5 text-right font-normal">{copy.value}</th>
            <th className="py-1.5 text-right font-normal">{copy.signal}</th>
          </tr>
        </thead>
        <tbody>
          {signals.map(signal => (
            <tr className="border-t border-(--card-well-stroke)" key={signal.name}>
              <td className="py-2 text-(--ui-text-primary)">{signal.name}</td>
              <td className="py-2 text-right tabular-nums text-(--ui-text-secondary)">
                {signal.value === null ? '—' : number.format(signal.value)}
              </td>
              <td className={cn('py-2 text-right font-medium', ACTION_TONE[signal.action])}>
                {COPY.analysis.action[signal.action]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TechnicalsView({ bars, interval }: { bars: Bar[]; interval: Interval }) {
  const copy = COPY.analysis
  const read = technicals(bars)

  return (
    <ViewShell
      note={copy.technicals.note}
      title={copy.technicals.title(COPY.studio.intervalNames[interval])}
      view="technicals"
    >
      {bars.length < 30 ? (
        <Message>{copy.technicals.tooFew}</Message>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <GaugeCard tally={read.oscillatorsTally} title={copy.technicals.oscillators} />
            <GaugeCard tally={read.summary} title={copy.technicals.summary} />
            <GaugeCard tally={read.averagesTally} title={copy.technicals.averages} />
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-8 gap-y-6">
            <SignalTable signals={read.oscillators} title={copy.technicals.oscillators} />
            <SignalTable signals={read.averages} title={copy.technicals.averages} />
          </div>
        </>
      )}
    </ViewShell>
  )
}

/** A cell's fill: green or red, deeper the bigger the move (±20% is full). */
const heat = (value: null | number) =>
  value === null
    ? undefined
    : `color-mix(in srgb, ${value >= 0 ? 'var(--ui-green)' : 'var(--ui-red)'} ${Math.round(Math.min(Math.abs(value) / 20, 1) * 70 + 8)}%, transparent)`

const pct = (value: null | number) => (value === null ? '' : `${value > 0 ? '+' : ''}${value.toFixed(1)}`)

function SeasonalsView({ kind, symbol }: { kind: WatchKind; symbol: string }) {
  const copy = COPY.analysis.seasonals
  const { data, error, isLoading } = useBars(kind, symbol, '1M', true)
  const read = data ? seasonals(data) : null

  return (
    <ViewShell note={copy.note} title={copy.title} view="seasonals">
      {isLoading ? (
        <Message>{COPY.analysis.loading}</Message>
      ) : error || !read || !read.years.length ? (
        <Message>{error ? COPY.analysis.failed : copy.none}</Message>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-1 text-center text-[0.75rem] tabular-nums">
            <thead>
              <tr className="text-(--ui-text-tertiary)">
                <th className="px-2 text-left font-normal">{copy.year}</th>
                {copy.months.map(month => (
                  <th className="font-normal" key={month}>
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {read.years.slice(0, 15).map(row => (
                <tr key={row.year}>
                  <td className="px-2 text-left text-(--ui-text-secondary)">{row.year}</td>
                  {row.returns.map((value, month) => (
                    <td
                      className="h-8 min-w-12 rounded-md text-(--ui-text-primary)"
                      key={month}
                      style={{ backgroundColor: heat(value) }}
                    >
                      {pct(value)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="px-2 pt-2 text-left font-medium text-(--ui-text-primary)">{copy.average}</td>
                {read.average.map((value, month) => (
                  <td
                    className="h-8 rounded-md font-medium text-(--ui-text-primary)"
                    key={month}
                    style={{ backgroundColor: heat(value) }}
                  >
                    {pct(value)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-2 text-left text-(--ui-text-secondary)">{copy.hit}</td>
                {read.hitRate.map((value, month) => (
                  <td className="h-7 text-(--ui-text-secondary)" key={month}>
                    {value === null ? '' : `${Math.round(value)}%`}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </ViewShell>
  )
}

export function AnalysisView({
  bars,
  interval,
  kind,
  symbol,
  view
}: {
  bars: Bar[]
  interval: Interval
  kind: WatchKind
  symbol: string
  view: View
}) {
  if (view === 'technicals') {
    return <TechnicalsView bars={bars} interval={interval} />
  }

  if (view === 'seasonals') {
    return <SeasonalsView kind={kind} symbol={symbol} />
  }

  if (view === 'derivatives') {
    return <DerivativesView kind={kind} symbol={symbol} />
  }

  if (view === 'news') {
    return <NewsView kind={kind} symbol={symbol} />
  }

  return <CommunityView kind={kind} symbol={symbol} />
}
