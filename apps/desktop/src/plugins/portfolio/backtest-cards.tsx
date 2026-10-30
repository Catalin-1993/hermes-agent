/** The Backtesting page's result (numbers, chart, trades) and past runs; the settings are in `backtest-settings.tsx`. */

import { cn, Codicon, ConfirmDialog } from '@hermes/plugin-sdk'
import { useState } from 'react'

import type { BacktestExecution, BacktestRecord, BacktestStats, BacktestSummary, ExitReason } from './api'
import { BacktestChart, type BacktestView } from './backtest-chart'
import { DEFAULT_EXECUTION, EXECUTION_FIELDS } from './backtest-strategies'
import { COPY } from './copy'
import { percent, quotePrice, toneClass } from './format'
import { Segmented } from './segmented'
import { CARD, CARD_PAD, CountPill, H2, H2_LARGE, MUTED } from './ui'

/** What the service noticed about a run, in words; an unknown note (a newer service) is left out. */
const NOTES: Record<string, string> = {
  periods_too_long: COPY.backtest.execution.periodsTooLong,
  risk_without_stop: COPY.backtest.execution.riskWithoutStop
}

const EXIT_REASONS: ExitReason[] = ['signal', 'stop_loss', 'take_profit', 'trailing']

const decimal = (value: number) => String(value).replace('.', ',')

/** What differs from the plain strategy, in words: "stop-loss 5% · trailing 10% · bare săptămânale". */
export function executionSummary(execution: BacktestExecution = DEFAULT_EXECUTION): string {
  const copy = COPY.backtest.execution

  const parts = EXECUTION_FIELDS.filter(field => execution[field.name] !== DEFAULT_EXECUTION[field.name]).map(field =>
    copy.parts[field.name](decimal(execution[field.name]))
  )

  return copy.summary(execution.timeframe === '1w' ? [...parts, copy.parts.weekly] : parts)
}

const day = (seconds: number) =>
  new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: 'UTC', year: 'numeric' }).format(
    new Date(seconds * 1000)
  )

function Figure({ hint, label, text, tone }: { hint?: string; label: string; text: string; tone?: number }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.75rem] text-(--ui-text-tertiary)">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-[1.125rem] font-semibold tracking-[-0.01em] tabular-nums',
          tone === undefined ? 'text-(--ui-text-primary)' : toneClass(tone)
        )}
      >
        {text}
      </div>
      {hint && <div className="mt-0.5 text-[0.6875rem] text-(--ui-text-tertiary)">{hint}</div>}
    </div>
  )
}

const ratio = (value: number) => value.toFixed(2).replace('.', ',')

function Figures({ result, benchmark }: { benchmark: BacktestStats; result: BacktestStats }) {
  const copy = COPY.backtest.figures
  const signedPct = (value: number) => percent(value, true)

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      <Figure
        hint={copy.vs(signedPct(benchmark.total_return_pct))}
        label={copy.total}
        text={signedPct(result.total_return_pct)}
        tone={result.total_return_pct}
      />
      <Figure
        hint={copy.vs(signedPct(benchmark.cagr_pct))}
        label={copy.cagr}
        text={signedPct(result.cagr_pct)}
        tone={result.cagr_pct}
      />
      <Figure
        hint={copy.vs(signedPct(benchmark.max_drawdown_pct))}
        label={copy.drawdown}
        text={signedPct(result.max_drawdown_pct)}
        tone={result.max_drawdown_pct}
      />
      <Figure hint={copy.vs(ratio(benchmark.sharpe))} label={copy.sharpe} text={ratio(result.sharpe)} />
      <Figure label={copy.trades} text={String(result.trades)} />
      <Figure label={copy.winRate} text={percent(result.win_rate_pct)} />
      <Figure
        hint={copy.worst(signedPct(result.worst_trade_pct))}
        label={copy.best}
        text={signedPct(result.best_trade_pct)}
        tone={result.best_trade_pct}
      />
      <Figure label={copy.exposure} text={percent(result.exposure_pct)} />
    </div>
  )
}

/** How the trades ended, shown only once a protective order closed at least one. */
function ExitsLine({ exits }: { exits?: Record<ExitReason, number> }) {
  const reasons = COPY.backtest.trades.reasons

  if (!exits || EXIT_REASONS.every(reason => reason === 'signal' || !exits[reason])) {
    return null
  }

  return (
    <p className="text-[0.75rem] text-(--ui-text-secondary)">
      <span className="text-(--ui-text-tertiary)">{COPY.backtest.figures.exits}: </span>
      {EXIT_REASONS.filter(reason => exits[reason])
        .map(reason => `${exits[reason]} ${reasons[reason]}`)
        .join(' · ')}
    </p>
  )
}

function TradesTable({ record }: { record: BacktestRecord }) {
  const copy = COPY.backtest.trades
  const trades = [...record.result.trades].reverse()

  if (!trades.length) {
    return <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{copy.none}</p>
  }

  return (
    <div className="-mx-1 max-h-80 overflow-auto">
      <table className="w-full min-w-[38rem] border-collapse text-[0.8125rem]">
        <thead className="sticky top-0 bg-(--card-surface)">
          <tr className="text-[0.75rem] text-(--ui-text-tertiary)">
            <th className="px-2 py-1.5 text-left font-medium">{copy.entry}</th>
            <th className="px-2 py-1.5 text-left font-medium">{copy.exit}</th>
            <th className="px-2 py-1.5 text-left font-medium">{copy.reason}</th>
            <th className="px-2 py-1.5 text-right font-medium">{copy.prices}</th>
            <th className="px-2 py-1.5 text-right font-medium">{copy.result}</th>
          </tr>
        </thead>
        <tbody>
          {trades.map(trade => (
            <tr className="border-t border-(--card-well-stroke)" key={trade.entry_ts}>
              <td className="px-2 py-2 text-(--ui-text-primary)">{day(trade.entry_ts)}</td>
              <td className="px-2 py-2 text-(--ui-text-secondary)">
                {trade.exit_ts === null ? copy.open : day(trade.exit_ts)}
              </td>
              <td className="px-2 py-2 text-(--ui-text-tertiary)">
                {trade.exit_reason ? copy.reasons[trade.exit_reason] : '—'}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-(--ui-text-secondary)">
                {quotePrice(trade.entry_price)} → {trade.exit_price === null ? '…' : quotePrice(trade.exit_price)}
              </td>
              <td
                className={cn(
                  'px-2 py-2 text-right tabular-nums',
                  trade.pnl_pct === null ? 'text-(--ui-text-tertiary)' : toneClass(trade.pnl_pct)
                )}
              >
                {trade.pnl_pct === null ? '—' : percent(trade.pnl_pct, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ResultCard({ record }: { record: BacktestRecord }) {
  const copy = COPY.backtest.result
  const [view, setView] = useState<BacktestView>('equity')
  const { request } = record
  const first = record.result.curve[0]?.[0]
  const last = record.result.curve.at(-1)?.[0]

  return (
    <section className={cn(CARD, CARD_PAD, 'gap-4')} data-portfolio-backtest-result={record.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={H2_LARGE}>
            {request.symbol} · {COPY.backtest.strategies[request.strategy].name}
          </h2>
          <div className="mt-0.5 text-[0.75rem] text-(--ui-text-tertiary)">
            {first && last ? copy.span(day(first), day(last)) : ''} ·{' '}
            {copy.money(request.capital, request.currency, request.fee_pct)}
          </div>
          <div className="mt-0.5 text-[0.75rem] text-(--ui-text-tertiary)">{executionSummary(record.execution)}</div>
        </div>
        <Segmented
          label={copy.view}
          onSelect={setView}
          options={[
            { id: 'equity', text: copy.views.equity },
            { id: 'price', text: copy.views.price }
          ]}
          value={view}
        />
      </div>
      {record.notes
        ?.filter(note => note in NOTES)
        .map(note => (
          <p className="rounded-xl bg-(--card-well) px-4 py-3 text-[0.8125rem] text-(--ui-text-secondary)" key={note}>
            {NOTES[note]}
          </p>
        ))}
      <Figures benchmark={record.benchmark.stats} result={record.result.stats} />
      <ExitsLine exits={record.result.stats.exits} />
      <BacktestChart record={record} view={view} />
      <TradesTable record={record} />
      <p className="m-0 text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">{copy.footer}</p>
    </section>
  )
}

export function RunsCard({
  onDelete,
  onOpen,
  open,
  runs
}: {
  onDelete: (id: string) => void
  onOpen: (id: string) => void
  open: null | string
  runs: BacktestSummary[]
}) {
  const copy = COPY.backtest.runs
  const [deleting, setDeleting] = useState<BacktestSummary | null>(null)

  return (
    <section className={cn(CARD, 'gap-2 px-6 pt-5 pb-2.5')} data-portfolio-backtest-runs="">
      <div className="flex items-center justify-between gap-2">
        <h2 className={H2}>{copy.title}</h2>
        <CountPill>{runs.length}</CountPill>
      </div>
      {runs.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0 pb-2">
          {runs.map(run => (
            <li className="group relative" key={run.id}>
              <button
                aria-pressed={run.id === open}
                className={cn(
                  'flex w-full cursor-pointer flex-col gap-3.5 rounded-[14px] border p-4 text-left transition-colors',
                  run.id === open
                    ? 'border-(--ui-text-quaternary) bg-(--card-well)'
                    : 'border-(--card-well-stroke) bg-(--card-well) hover:border-(--ui-text-quaternary)'
                )}
                onClick={() => onOpen(run.id)}
                type="button"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-(--ui-text-primary)">
                      {run.request.symbol} ·{' '}
                      {COPY.backtest.strategies[run.request.strategy]?.name ?? run.request.strategy}
                    </span>
                    <span className={cn('text-[0.78125rem] tabular-nums', MUTED)}>
                      {copy.meta(run.request.years, run.created.slice(0, 10))}
                    </span>
                  </span>
                  <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="chevron-right" size="1rem" />
                </span>
                <span className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-[10px] bg-(--card-well-stroke)">
                  <span className="flex flex-col gap-0.5 bg-(--card-surface) px-3 py-2.5">
                    <span className={cn('text-xs', MUTED)}>{copy.strategy}</span>
                    <span className={cn('text-lg font-medium tabular-nums', toneClass(run.return_pct ?? 0))}>
                      {run.return_pct === null ? '—' : percent(run.return_pct, true)}
                    </span>
                  </span>
                  <span className="flex flex-col gap-0.5 bg-(--card-surface) px-3 py-2.5">
                    <span className={cn('text-xs', MUTED)}>{copy.benchmark}</span>
                    <span className={cn('text-lg font-medium tabular-nums', toneClass(run.benchmark_pct ?? 0))}>
                      {run.benchmark_pct === null ? '—' : percent(run.benchmark_pct, true)}
                    </span>
                  </span>
                </span>
              </button>
              <button
                aria-label={copy.delete(run.request.symbol)}
                className="absolute top-2 right-2 hidden size-6 cursor-pointer place-items-center rounded-full bg-(--card-surface) text-(--ui-text-tertiary) shadow-(--card-shadow) group-focus-within:grid group-hover:grid hover:text-(--ui-red)"
                onClick={() => setDeleting(run)}
                type="button"
              >
                <Codicon name="close" size="0.625rem" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn('m-0 px-1 py-2 pb-3 text-[0.8125rem] leading-relaxed', MUTED)}>{copy.none}</p>
      )}
      {deleting && (
        <ConfirmDialog
          cancelLabel={COPY.lists.cancel}
          confirmLabel={copy.deleteConfirm}
          description={copy.deleteDescription}
          destructive
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            onDelete(deleting.id)
            setDeleting(null)
          }}
          open
          title={copy.deleteTitle(
            `${deleting.request.symbol} · ${COPY.backtest.strategies[deleting.request.strategy]?.name ?? ''}`
          )}
        />
      )}
    </section>
  )
}
