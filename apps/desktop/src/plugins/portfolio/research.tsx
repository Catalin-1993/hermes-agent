/**
 * Research: pick a coin or stock, read its sheet, ask the investment team for an analysis, and read
 * the reports the team saves. The sheet and the reports come from the backend; the analysis itself is
 * the agents' work in an ordinary chat, which the owner starts.
 */

import { EmptyState, useQuery } from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import { fetchResearchReports, fetchResearchSheet } from './api'
import { COPY } from './copy'
import { MarketDataCard } from './market-data-card'
import { AskTeamCard } from './research-ask'
import { ReportReader, ReportsCard } from './research-reports'
import { SafetyCard } from './research-safety'
import { SheetCard } from './research-sheet'
import { type Pick, SymbolPicker, useWatchedSymbols } from './symbol-picker'
import { PageHeader } from './ui'
import { serviceReady } from './use-stock-feed'

/** A main column (the asset sheet, then the team's request) and a side column (its reports and the safety
 *  drill), about 70% and 30% of the width, so both are in view at once. */
function Columns({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex min-w-[min(100%,540px)] flex-[7_1_0] flex-col gap-4">{main}</div>
      <div className="flex min-w-[min(100%,300px)] flex-[3_1_0] flex-col gap-4">{side}</div>
    </div>
  )
}

function SheetArea({ dir, pick, side }: { dir: string; pick: Pick; side: ReactNode }) {
  const copy = COPY.research

  const { data, error, isLoading } = useQuery({
    queryFn: () => fetchResearchSheet(pick.symbol, pick.kind),
    queryKey: ['portfolio', 'research', 'sheet', pick.kind, pick.symbol],
    refetchInterval: query => (serviceReady(query.state.data?.status) ? 300_000 : 3_000),
    staleTime: 60_000
  })

  if (isLoading) {
    return (
      <>
        <EmptyState className="min-h-48" title={copy.loadingSheet} />
        <Columns main={null} side={side} />
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <EmptyState
          className="min-h-48"
          description={error instanceof Error ? error.message : undefined}
          title={copy.sheetFailed}
        />
        <Columns main={null} side={side} />
      </>
    )
  }

  return (
    <Columns
      main={
        <>
          {serviceReady(data.status) ? (
            <SheetCard sheet={data} />
          ) : (
            <MarketDataCard status={data.status} where="research" />
          )}
          <AskTeamCard dir={dir} sheet={data} />
        </>
      }
      side={side}
    />
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

  const side = (
    <>
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
    </>
  )

  return (
    <>
      <PageHeader subtitle={COPY.research.subtitle} title={COPY.research.title}>
        <SymbolPicker
          current={pick}
          onPick={next => {
            setPicked(next)
            setOpenReport(null)
          }}
          suggestions={unique.slice(0, 24)}
        />
      </PageHeader>
      <div className="contents" data-portfolio-research="">
        {openReport ? (
          <Columns main={<ReportReader name={openReport} onClose={() => setOpenReport(null)} />} side={side} />
        ) : pick ? (
          <SheetArea dir={dir} key={`${pick.kind}:${pick.symbol}`} pick={pick} side={side} />
        ) : (
          <Columns
            main={
              <EmptyState className="min-h-48" description={COPY.research.pickHint} title={COPY.research.pickTitle} />
            }
            side={side}
          />
        )}
      </div>
    </>
  )
}
