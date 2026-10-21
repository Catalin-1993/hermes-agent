/**
 * The Portfolio page: five sections in the page header — Dashboard first, the rest arriving in later
 * stages — over one calm column. The dashboard draws with the chat's own figure system (KPI tiles,
 * charts), so the page and the conversation share one design line.
 */

import {
  cn,
  Codicon,
  EmptyState,
  PaneTab,
  PaneTabLabel,
  PaneTabStrip,
  useQuery,
  WorkspacePageHeaderControl
} from '@hermes/plugin-sdk'
import { useState } from 'react'

import { fetchDashboard, type PortfolioDashboard, portfolioKey } from './api'
import { PortfolioChart } from './chart'
import { COPY } from './copy'
import { dateLabel } from './format'
import { Allocation, Highlights, PositionsTable } from './holdings'
import { MarketDataCard } from './market-data-card'
import { ResearchSection } from './research'
import { Summary } from './summary'
import { WatchlistSection } from './watchlist'

type Section = 'backtest' | 'dashboard' | 'plan' | 'research' | 'watchlist'

const SECTIONS: { id: Section; icon: string; stage?: number }[] = [
  { icon: 'dashboard', id: 'dashboard' },
  { icon: 'eye', id: 'watchlist' },
  { icon: 'beaker', id: 'backtest', stage: 5 },
  { icon: 'search', id: 'research' },
  { icon: 'checklist', id: 'plan', stage: 4 }
]

function SectionTabs({ active, onSelect }: { active: Section; onSelect: (section: Section) => void }) {
  return (
    <WorkspacePageHeaderControl bare id="portfolio:sections">
      <PaneTabStrip titlebar>
        {SECTIONS.map(section => (
          <PaneTab
            active={section.id === active}
            aria-selected={section.id === active}
            key={section.id}
            onClick={() => onSelect(section.id)}
            role="tab"
          >
            <PaneTabLabel>
              <span className="flex min-w-0 items-center gap-1.5">
                <Codicon className="shrink-0" name={section.icon} size="0.75rem" />
                <span className="truncate">{COPY.sections[section.id]}</span>
              </span>
            </PaneTabLabel>
          </PaneTab>
        ))}
      </PaneTabStrip>
    </WorkspacePageHeaderControl>
  )
}

function Overview({ data }: { data: PortfolioDashboard }) {
  return (
    <div className="flex flex-col gap-4">
      <Summary data={data} />
      <PortfolioChart candles={data.candles} history={data.history} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Allocation allocation={data.allocation} />
        <Highlights positions={data.positions} />
      </div>
      <PositionsTable positions={data.positions} />
    </div>
  )
}

function DashboardSection() {
  const [variant, setVariant] = useState('')

  const { data, error, isLoading } = useQuery({
    queryFn: () => fetchDashboard(variant),
    queryKey: portfolioKey(variant),
    // While the market data is being prepared the page follows it closely; afterwards a calm refresh.
    refetchInterval: query => {
      const status = query.state.data?.status

      return status && (status.env === 'installing' || status.service === 'starting') ? 3_000 : 60_000
    }
  })

  const copy = COPY.dashboard

  if (isLoading) {
    return <EmptyState title={copy.loading} />
  }

  if (error || !data) {
    return <EmptyState description={error instanceof Error ? error.message : undefined} title={copy.loadFailed} />
  }

  if (!data.has_journal) {
    return <EmptyState description={copy.noJournalHint(data.journal_dir)} title={copy.noJournal} />
  }

  const pricesLabel = COPY.prices[data.prices]

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h1 className="text-[1.375rem] leading-tight font-semibold tracking-[-0.02em] text-(--ui-text-primary)">
            {copy.title}
          </h1>
          <p className="mt-1 text-[0.8125rem] text-(--ui-text-tertiary)">
            {copy.subtitle(
              data.variant,
              dateLabel(data.started),
              pricesLabel,
              data.as_of ? dateLabel(data.as_of) : null
            )}
          </p>
        </div>
        {data.variants.length > 1 && (
          <div
            aria-label={copy.variant}
            className="flex rounded-full bg-(--card-well) p-0.5 text-[0.8125rem]"
            role="radiogroup"
          >
            {data.variants.map(name => (
              <button
                aria-checked={name === data.variant}
                className={cn(
                  'h-7 cursor-pointer rounded-full px-3.5 font-medium transition-colors',
                  name === data.variant
                    ? 'bg-(--card-surface) text-(--ui-text-primary) shadow-(--card-shadow)'
                    : 'text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
                )}
                key={name}
                onClick={() => setVariant(name)}
                role="radio"
                type="button"
              >
                {copy.variantName(name)}
              </button>
            ))}
          </div>
        )}
      </header>

      <MarketDataCard status={data.status} />

      {data.unverified_trades > 0 && (
        <p className="my-2 flex items-center gap-2 text-[0.75rem] text-(--ui-yellow)">
          <Codicon name="warning" size="0.8125rem" />
          {copy.unverified(data.unverified_trades)}
        </p>
      )}

      <Overview data={data} />

      <p className="pt-2 pb-8 text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">
        {copy.footer(data.journal_dir)}
      </p>
    </>
  )
}

export function PortfolioPage() {
  const [section, setSection] = useState<Section>('dashboard')
  const current = SECTIONS.find(entry => entry.id === section)!

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-(--ui-surface-background)" data-portfolio="">
      <SectionTabs active={section} onSelect={setSection} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            'mx-auto w-full px-6 py-4',
            section === 'watchlist' || section === 'research' ? 'max-w-7xl' : 'max-w-5xl'
          )}
        >
          {section === 'dashboard' ? (
            <DashboardSection />
          ) : section === 'watchlist' ? (
            <WatchlistSection />
          ) : section === 'research' ? (
            <ResearchSection />
          ) : (
            <EmptyState
              className="min-h-[60vh]"
              description={COPY.comingSoon(current.stage ?? 0)}
              title={COPY.sections[section]}
            />
          )}
        </div>
      </div>
    </div>
  )
}
