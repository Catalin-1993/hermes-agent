/**
 * Backtesting: a strategy over a coin's or stock's history on NautilusTrader (in the market-data
 * service), beside buy-and-hold, with every run kept for later. A run is started only by the owner;
 * the team can be asked to read a result, through the same chat hand-off as Research and Plan.
 */

import { Button, cn, Codicon, EmptyState, useMutation, useQuery, useQueryClient } from '@hermes/plugin-sdk'
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
import { executionSummary, ResultCard, RunsCard } from './backtest-cards'
import { backtestPrompt } from './backtest-prompt'
import { SettingsCard } from './backtest-settings'
import { DEFAULT_EXECUTION, defaultParams } from './backtest-strategies'
import { BacktestWorkspace } from './backtest-workspace'
import { COPY } from './copy'
import { MarketDataCard } from './market-data-card'
import { type Pick, SymbolPicker, useWatchedSymbols } from './symbol-picker'
import { AgentSelect, CommitteeHint, handToAgent, PanelChoice, usePanel, useTeamAgent } from './team-chat'
import { CARD, CARD_PAD, CardHead, PageHeader } from './ui'
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
  const [panel, setPanel] = usePanel()
  const names = Object.fromEntries(Object.entries(COPY.backtest.strategies).map(([id, s]) => [id, s.name]))

  const prepare = async () => {
    setBusy(true)
    await handToAgent(
      agent,
      backtestPrompt({
        execution: executionSummary(record.execution),
        names,
        note,
        panel,
        reasons: COPY.backtest.trades.reasons,
        record,
        researchDir: research?.dir ?? '',
        today: new Date().toISOString().slice(0, 10)
      })
    )
    setBusy(false)
  }

  return (
    <section className={cn(CARD, CARD_PAD, 'gap-3.5')} data-portfolio-backtest-ask="">
      <CardHead subtitle={copy.subtitle} title={copy.title} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <AgentSelect agent={agent} agents={agents} onChoose={choose} />
          <PanelChoice onChoose={setPanel} panel={panel} />
        </div>
        <Button disabled={busy || !agent} onClick={() => void prepare()} size="sm">
          <Codicon className="mr-1.5" name="comment-discussion" />
          {COPY.research.ask.prepare}
        </Button>
      </div>
      <textarea
        aria-label={copy.noteLabel}
        className="min-h-14 resize-y rounded-[10px] border border-(--card-stroke) bg-(--card-well) px-3.5 py-2.5 text-[0.8125rem] text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:border-(--ui-text-tertiary)"
        maxLength={600}
        onChange={event => setNote(event.target.value)}
        placeholder={copy.notePlaceholder}
        value={note}
      />
      <CommitteeHint panel={panel} />
    </section>
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
    execution: DEFAULT_EXECUTION,
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
    <>
      <PageHeader subtitle={copy.subtitle} title={copy.title}>
        <SymbolPicker current={pick} onPick={next => setPicked(next)} suggestions={watched.slice(0, 24)} />
      </PageHeader>
      {status && !serviceReady(status) && <MarketDataCard status={status} where="backtest" />}
      <div className="flex flex-wrap items-start gap-4" data-portfolio-backtest="">
        <div className="flex min-w-0 flex-[999_1_620px] flex-col gap-4">
          {pick ? (
            <BacktestWorkspace
              canLoad={serviceReady(status)}
              onChange={({ kind: _kind, symbol: _symbol, ...next }) => setSettings(next)}
              record={record ?? null}
              request={{ ...settings, kind: pick.kind, symbol: pick.symbol }}
            />
          ) : (
            <EmptyState className="min-h-48" description={COPY.research.pickHint} title={COPY.research.pickTitle} />
          )}
          {failure && (
            <p className="m-0 rounded-xl bg-(--card-well) px-4 py-3 text-[0.8125rem] text-(--ui-text-secondary)">
              {failure}
            </p>
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
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          {pick && (
            <SettingsCard
              busy={run.isPending}
              canRun={serviceReady(status)}
              onChange={({ kind: _kind, symbol: _symbol, ...next }) => setSettings(next)}
              onRun={() => run.mutate({ ...settings, kind: pick.kind, symbol: pick.symbol })}
              request={{ ...settings, kind: pick.kind, symbol: pick.symbol }}
            />
          )}
          <RunsCard onDelete={id => remove.mutate(id)} onOpen={setOpenRun} open={openRun} runs={runs} />
        </div>
      </div>
    </>
  )
}
