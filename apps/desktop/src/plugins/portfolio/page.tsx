/**
 * The Portfolio page: five sections in the page header — Dashboard, Watchlist, Backtesting, Research
 * and Plan — over one calm column. The dashboard draws with the chat's own figure system (KPI tiles,
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
import { type ReactNode, useState } from 'react'

import { useAlertNotices } from './alerts'
import { fetchDashboard, type PortfolioDashboard, portfolioKey } from './api'
import { BacktestSection } from './backtest'
import { PortfolioValueCard } from './chart'
import { COPY } from './copy'
import { dateLabel } from './format'
import { Allocation, Highlights, PositionsTable } from './holdings'
import { MarketDataCard } from './market-data-card'
import { PlanSection } from './plan'
import { ResearchSection } from './research'
import { Segmented } from './segmented'
import { DashboardSkeleton } from './summary'
import { PageHeader } from './ui'
import { WatchlistSection } from './watchlist'

type Section = 'backtest' | 'dashboard' | 'plan' | 'research' | 'watchlist'

const SECTIONS: { id: Section; icon: string }[] = [
  { icon: 'dashboard', id: 'dashboard' },
  { icon: 'eye', id: 'watchlist' },
  { icon: 'beaker', id: 'backtest' },
  { icon: 'search', id: 'research' },
  { icon: 'checklist', id: 'plan' }
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
    <>
      <PortfolioValueCard data={data} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-4">
        <Allocation allocation={data.allocation} total={data.total} />
        <Highlights positions={data.positions} />
      </div>
      <PositionsTable allocation={data.allocation} positions={data.positions} />
    </>
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
    return <DashboardSkeleton />
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
      <PageHeader
        subtitle={copy.subtitle(
          data.variant,
          dateLabel(data.started),
          pricesLabel,
          data.as_of ? dateLabel(data.as_of) : null
        )}
        title={copy.title}
      >
        {data.variants.length > 1 && (
          <Segmented
            label={copy.variant}
            large
            onSelect={setVariant}
            options={data.variants.map(name => ({ id: name, text: copy.variantName(name) }))}
            value={data.variant}
          />
        )}
      </PageHeader>

      <MarketDataCard status={data.status} />

      {data.unverified_trades > 0 && (
        <p className="m-0 flex items-center gap-2 text-[0.75rem] text-(--ui-yellow)">
          <Codicon name="warning" size="0.8125rem" />
          {copy.unverified(data.unverified_trades)}
        </p>
      )}

      <Overview data={data} />

      <p className="m-0 text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">{copy.footer(data.journal_dir)}</p>
    </>
  )
}

const SECTION_VIEWS: Record<Section, () => ReactNode> = {
  backtest: () => <BacktestSection />,
  dashboard: () => <DashboardSection />,
  plan: () => <PlanSection />,
  research: () => <ResearchSection />,
  watchlist: () => <WatchlistSection />
}

// The design's widths: the dashboard's column is 1200px, the other pages' 1280px, each with 28px of side padding.
const SECTION_WIDTH: Record<Section, string> = {
  backtest: 'max-w-[1280px]',
  dashboard: 'max-w-[1200px]',
  plan: 'max-w-[1280px]',
  research: 'max-w-[1280px]',
  watchlist: 'max-w-[1280px]'
}

/**
 * A section opened once stays mounted, only hidden while another is shown, each in its own scroll
 * area: coming back finds it exactly as it was — no reload, no chart rebuilt, nothing jumping.
 */
export function PortfolioPage() {
  const [section, setSection] = useState<Section>('dashboard')
  const [opened, setOpened] = useState<Section[]>(['dashboard'])
  // Wherever the owner is in the Portfolio, a price alert reached in the meantime is announced.
  useAlertNotices()

  const select = (next: Section) => {
    setSection(next)
    setOpened(current => (current.includes(next) ? current : [...current, next]))
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-(--ui-surface-background)" data-portfolio="">
      <SectionTabs active={section} onSelect={select} />
      <div className="relative min-h-0 flex-1">
        {SECTIONS.filter(entry => opened.includes(entry.id)).map(({ id }) => (
          <div
            className={cn('absolute inset-0 overflow-y-auto', id !== section && 'hidden')}
            data-portfolio-section={id}
            key={id}
          >
            <div className={cn('mx-auto flex w-full flex-col gap-4 px-7 pt-6 pb-14', SECTION_WIDTH[id])}>
              {SECTION_VIEWS[id]()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
