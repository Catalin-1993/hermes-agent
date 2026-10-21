/**
 * Research: pick a coin or stock, read its sheet, ask the investment team for an analysis, and read
 * the reports the team saves. The sheet and the reports come from the backend; the analysis itself is
 * the agents' work in an ordinary chat, which the owner starts.
 */

import { Button, cn, EmptyState, useQuery } from '@hermes/plugin-sdk'
import { type FormEvent, useState } from 'react'

import { fetchResearchReports, fetchResearchSheet, fetchWatchlists, type WatchKind, watchlistKey } from './api'
import { COPY } from './copy'
import { MarketDataCard } from './market-data-card'
import { AskTeamCard } from './research-ask'
import { ReportReader, ReportsCard } from './research-reports'
import { SheetCard } from './research-sheet'
import { Segmented } from './segmented'
import { serviceReady } from './use-stock-feed'

interface Pick {
  kind: WatchKind
  symbol: string
}

function SymbolPicker({
  current,
  onPick,
  suggestions
}: {
  current: null | Pick
  onPick: (pick: Pick) => void
  suggestions: Pick[]
}) {
  const copy = COPY.research.picker
  const [value, setValue] = useState('')
  const [kind, setKind] = useState<WatchKind>('crypto')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const symbol = value.trim().toUpperCase()

    if (symbol) {
      onPick({ kind, symbol })
      setValue('')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
        <input
          aria-label={copy.label}
          className="h-8 min-w-0 flex-1 basis-full rounded-full bg-(--card-well) px-3.5 sm:basis-0 text-[0.8125rem] text-(--ui-text-primary) uppercase placeholder:normal-case placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:ring-1 focus-visible:ring-(--ui-text-tertiary)"
          maxLength={15}
          onChange={event => setValue(event.target.value)}
          placeholder={copy.placeholder}
          value={value}
        />
        <Segmented
          label={copy.kind}
          onSelect={setKind}
          options={[
            { id: 'crypto', text: COPY.lists.kinds.crypto },
            { id: 'stocks', text: COPY.lists.kinds.stocks }
          ]}
          value={kind}
        />
        <Button disabled={!value.trim()} size="sm" type="submit" variant="secondary">
          {copy.open}
        </Button>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list">
          {suggestions.map(pick => {
            const active = current?.symbol === pick.symbol && current.kind === pick.kind

            return (
              <button
                aria-pressed={active}
                className={cn(
                  'h-7 cursor-pointer rounded-full px-3 text-[0.75rem] font-medium transition-colors',
                  active
                    ? 'bg-(--card-surface) text-(--ui-text-primary) shadow-(--card-shadow)'
                    : 'bg-(--card-well) text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
                )}
                key={`${pick.kind}:${pick.symbol}`}
                onClick={() => onPick(pick)}
                type="button"
              >
                {pick.symbol}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SheetArea({ dir, pick }: { dir: string; pick: Pick }) {
  const copy = COPY.research

  const { data, error, isLoading } = useQuery({
    queryFn: () => fetchResearchSheet(pick.symbol, pick.kind),
    queryKey: ['portfolio', 'research', 'sheet', pick.kind, pick.symbol],
    refetchInterval: query => (serviceReady(query.state.data?.status) ? 300_000 : 3_000),
    staleTime: 60_000
  })

  if (isLoading) {
    return <EmptyState className="min-h-48" title={copy.loadingSheet} />
  }

  if (error || !data) {
    return (
      <EmptyState
        className="min-h-48"
        description={error instanceof Error ? error.message : undefined}
        title={copy.sheetFailed}
      />
    )
  }

  return (
    <>
      {serviceReady(data.status) ? (
        <SheetCard sheet={data} />
      ) : (
        <MarketDataCard status={data.status} where="research" />
      )}
      <AskTeamCard dir={dir} sheet={data} />
    </>
  )
}

export function ResearchSection() {
  const { data: watchlists } = useQuery({ queryFn: fetchWatchlists, queryKey: watchlistKey })

  const { data: listed } = useQuery({
    queryFn: fetchResearchReports,
    queryKey: ['portfolio', 'research', 'reports'],
    refetchInterval: 20_000
  })

  const [picked, setPicked] = useState<null | Pick>(null)
  const [openReport, setOpenReport] = useState<null | string>(null)
  const [onlySymbol, setOnlySymbol] = useState(false)

  const suggestions = (watchlists?.lists ?? []).flatMap(list =>
    list.symbols.map(symbol => ({ kind: list.kind, symbol }))
  )

  const unique = suggestions.filter(
    (pick, index) => suggestions.findIndex(other => other.symbol === pick.symbol && other.kind === pick.kind) === index
  )

  const pick = picked ?? unique[0] ?? null
  const dir = listed?.dir ?? ''

  return (
    <div className="grid items-start gap-4 pt-2 lg:grid-cols-[minmax(0,1fr)_20rem]" data-portfolio-research="">
      <div className="flex min-w-0 flex-col gap-4">
        <SymbolPicker
          current={pick}
          onPick={next => {
            setPicked(next)
            setOpenReport(null)
          }}
          suggestions={unique.slice(0, 24)}
        />
        {openReport ? (
          <ReportReader name={openReport} onClose={() => setOpenReport(null)} />
        ) : pick ? (
          <SheetArea dir={dir} key={`${pick.kind}:${pick.symbol}`} pick={pick} />
        ) : (
          <EmptyState className="min-h-48" description={COPY.research.pickHint} title={COPY.research.pickTitle} />
        )}
      </div>
      <ReportsCard
        dir={dir}
        onlySymbol={onlySymbol}
        onOpen={setOpenReport}
        onToggleOnly={() => setOnlySymbol(!onlySymbol)}
        open={openReport}
        reports={listed?.reports ?? []}
        symbol={pick?.symbol ?? ''}
      />
    </div>
  )
}
