/**
 * Backtesting: a strategy over a coin's or stock's history on NautilusTrader (in the market-data
 * service), beside buy-and-hold, with every run kept for later. A run is started only by the owner;
 * the team can be asked to read a result, through the same chat hand-off as Research and Plan.
 */

import {
  Button,
  cn,
  Codicon,
  EmptyState,
  FIGURE_CARD_CLASS,
  useMutation,
  useQuery,
  useQueryClient
} from '@hermes/plugin-sdk'
import { useState } from 'react'

import {
  type BacktestFailure,
  type BacktestRecord,
  type BacktestRequest,
  backtestRunsKey,
  deleteBacktestRun,
  fetchBacktestRun,
  fetchBacktestRuns,
  fetchResearchReports,
  fetchStockQuotes,
  runBacktest
} from './api'
import { ResultCard, RunsCard, SettingsCard } from './backtest-cards'
import { backtestPrompt } from './backtest-prompt'
import { defaultParams } from './backtest-strategies'
import { COPY } from './copy'
import { MarketDataCard } from './market-data-card'
import { type Pick, SymbolPicker, useWatchedSymbols } from './symbol-picker'
import { AgentSelect, handToAgent, useTeamAgent } from './team-chat'
import { serviceReady } from './use-stock-feed'

const isFailure = (answer: BacktestFailure | BacktestRecord): answer is BacktestFailure => 'error' in answer

function failureText(failure: BacktestFailure, symbol: string): string {
  const copy = COPY.backtest.errors

  return (
    {
      invalid: copy.invalid,
      no_data: copy.noData(symbol),
      restart: copy.restart,
      stopped_early: copy.stoppedEarly,
      too_little_history: copy.tooLittle(symbol)
    }[failure.error] ?? `${copy.generic} ${failure.detail ?? failure.error}`
  )
}

function AskCard({ record }: { record: BacktestRecord }) {
  const copy = COPY.backtest.ask
  const { agent, agents, choose } = useTeamAgent()
  const { data: research } = useQuery({ queryFn: fetchResearchReports, queryKey: ['portfolio', 'research', 'reports'] })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const names = Object.fromEntries(Object.entries(COPY.backtest.strategies).map(([id, s]) => [id, s.name]))

  const prepare = async () => {
    setBusy(true)
    await handToAgent(
      agent,
      backtestPrompt({
        names,
        note,
        record,
        researchDir: research?.dir ?? '',
        today: new Date().toISOString().slice(0, 10)
      })
    )
    setBusy(false)
  }

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'gap-3')} data-portfolio-backtest-ask="">
      <div>
        <div className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)">
          {copy.title}
        </div>
        <div className="mt-0.5 text-[0.75rem] leading-relaxed text-(--ui-text-tertiary)">{copy.subtitle}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AgentSelect agent={agent} agents={agents} onChoose={choose} />
        <Button disabled={busy || !agent} onClick={() => void prepare()} size="sm">
          <Codicon className="mr-1.5" name="comment-discussion" />
          {COPY.research.ask.prepare}
        </Button>
      </div>
      <textarea
        aria-label={copy.noteLabel}
        className="min-h-14 resize-y rounded-xl bg-(--card-well) px-3.5 py-2.5 text-[0.8125rem] text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:ring-1 focus-visible:ring-(--ui-text-tertiary)"
        maxLength={600}
        onChange={event => setNote(event.target.value)}
        placeholder={copy.notePlaceholder}
        value={note}
      />
    </div>
  )
}

function useServiceStatus() {
  // The same cheap status the Watchlist reads: an empty quote request answers with the service's state.
  return useQuery({
    queryFn: () => fetchStockQuotes([]),
    queryKey: ['portfolio', 'backtest', 'service'],
    refetchInterval: query => (serviceReady(query.state.data?.status) ? 60_000 : 3_000)
  })
}

function useRuns(onDeleted: (id: string) => void) {
  const queryClient = useQueryClient()
  const runs = useQuery({ queryFn: fetchBacktestRuns, queryKey: backtestRunsKey })

  const remove = useMutation({
    mutationFn: deleteBacktestRun,
    onSettled: () => queryClient.invalidateQueries({ queryKey: backtestRunsKey }),
    onSuccess: (_answer, id) => onDeleted(id)
  })

  return { remove, runs: runs.data?.runs ?? [] }
}

export function BacktestSection() {
  const copy = COPY.backtest
  const queryClient = useQueryClient()
  const watched = useWatchedSymbols()
  const service = useServiceStatus()
  const [picked, setPicked] = useState<null | Pick>(null)

  const [settings, setSettings] = useState<Omit<BacktestRequest, 'kind' | 'symbol'>>({
    capital: 10_000,
    fee_pct: 0.1,
    params: defaultParams('sma_cross'),
    strategy: 'sma_cross',
    years: 3
  })

  const [openRun, setOpenRun] = useState<null | string>(null)
  const [failure, setFailure] = useState<null | string>(null)
  const pick = picked ?? watched[0] ?? null
  const { remove, runs } = useRuns(id => id === openRun && setOpenRun(null))

  const opened = useQuery({
    enabled: Boolean(openRun),
    queryFn: () => fetchBacktestRun(openRun!),
    queryKey: ['portfolio', 'backtest', 'run', openRun]
  })

  const run = useMutation({
    mutationFn: runBacktest,
    onError: error => setFailure(`${copy.errors.generic} ${error instanceof Error ? error.message : ''}`),
    onSuccess: answer => {
      if (isFailure(answer)) {
        return setFailure(failureText(answer, pick?.symbol ?? ''))
      }

      setFailure(null)
      queryClient.setQueryData(['portfolio', 'backtest', 'run', answer.id], answer)
      setOpenRun(answer.id)
      void queryClient.invalidateQueries({ queryKey: backtestRunsKey })
    }
  })

  const status = service.data?.status
  const record = opened.data

  return (
    <div className="grid items-start gap-4 pt-2 lg:grid-cols-[minmax(0,1fr)_20rem]" data-portfolio-backtest="">
      <div className="flex min-w-0 flex-col gap-4">
        <SymbolPicker current={pick} onPick={next => setPicked(next)} suggestions={watched.slice(0, 24)} />
        {status && !serviceReady(status) && <MarketDataCard status={status} where="backtest" />}
        {pick ? (
          <SettingsCard
            busy={run.isPending}
            canRun={serviceReady(status)}
            onChange={next =>
              setSettings({
                capital: next.capital,
                fee_pct: next.fee_pct,
                params: next.params,
                strategy: next.strategy,
                years: next.years
              })
            }
            onRun={() => run.mutate({ ...settings, kind: pick.kind, symbol: pick.symbol })}
            request={{ ...settings, kind: pick.kind, symbol: pick.symbol }}
          />
        ) : (
          <EmptyState className="min-h-48" description={COPY.research.pickHint} title={COPY.research.pickTitle} />
        )}
        {failure && (
          <p className="rounded-xl bg-(--card-well) px-4 py-3 text-[0.8125rem] text-(--ui-text-secondary)">{failure}</p>
        )}
        {record ? (
          <>
            <ResultCard key={record.id} record={record} />
            <AskCard record={record} />
          </>
        ) : (
          openRun && opened.isLoading && <EmptyState className="min-h-48" title={copy.loadingRun} />
        )}
      </div>
      <RunsCard onDelete={id => remove.mutate(id)} onOpen={setOpenRun} open={openRun} runs={runs} />
    </div>
  )
}
