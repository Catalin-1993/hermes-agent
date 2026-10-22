/**
 * Research: pick a coin or stock, read its sheet, ask the investment team for an analysis, and read
 * the reports the team saves. The sheet and the reports come from the backend; the analysis itself is
 * the agents' work in an ordinary chat, which the owner starts.
 */

import { EmptyState, useQuery } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { fetchResearchReports, fetchResearchSheet } from './api'
import { COPY } from './copy'
import { MarketDataCard } from './market-data-card'
import { AskTeamCard } from './research-ask'
import { ReportReader, ReportsCard } from './research-reports'
import { SafetyCard } from './research-safety'
import { SheetCard } from './research-sheet'
import { type Pick, SymbolPicker, useWatchedSymbols } from './symbol-picker'
import { serviceReady } from './use-stock-feed'

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
  const { data: listed } = useQuery({
    queryFn: fetchResearchReports,
    queryKey: ['portfolio', 'research', 'reports'],
    refetchInterval: 20_000
  })

  const [picked, setPicked] = useState<null | Pick>(null)
  const [openReport, setOpenReport] = useState<null | string>(null)
  const [onlySymbol, setOnlySymbol] = useState(false)

  const unique = useWatchedSymbols()
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
      <div className="flex min-w-0 flex-col gap-4">
        <ReportsCard
          dir={dir}
          onlySymbol={onlySymbol}
          onOpen={setOpenReport}
          onToggleOnly={() => setOnlySymbol(!onlySymbol)}
          open={openReport}
          reports={listed?.reports ?? []}
          symbol={pick?.symbol ?? ''}
        />
        <SafetyCard dir={dir} onOpen={setOpenReport} reports={listed?.reports ?? []} />
      </div>
    </div>
  )
}
