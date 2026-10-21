/**
 * The Portfolio page: five sections in the page header — Dashboard first, the rest arriving in later
 * stages — over one calm column. The dashboard draws with the chat's own figure system (KPI tiles,
 * charts), so the page and the conversation share one design line.
 */

import {
  Button,
  ChartFigure,
  cn,
  Codicon,
  EmptyState,
  FIGURE_CARD_CLASS,
  PaneTab,
  PaneTabLabel,
  PaneTabStrip,
  parseChartSpec,
  useMutation,
  useQuery,
  useQueryClient,
  WorkspacePageHeaderControl
} from '@hermes/plugin-sdk'
import { useMemo, useState } from 'react'

import {
  fetchDashboard,
  type PortfolioDashboard,
  portfolioKey,
  type PortfolioPosition,
  type PortfolioStatus,
  prepareMarketData
} from './api'
import { COPY } from './copy'

type Section = 'backtest' | 'dashboard' | 'plan' | 'research' | 'watchlist'

const SECTIONS: { id: Section; icon: string; stage?: number }[] = [
  { icon: 'dashboard', id: 'dashboard' },
  { icon: 'eye', id: 'watchlist', stage: 2 },
  { icon: 'beaker', id: 'backtest', stage: 5 },
  { icon: 'search', id: 'research', stage: 3 },
  { icon: 'checklist', id: 'plan', stage: 4 }
]

const euro = (value: number, digits = 0) =>
  new Intl.NumberFormat('ro-RO', {
    currency: 'EUR',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    style: 'currency'
  }).format(value)

const percent = (value: number, signed = false) =>
  `${signed && value > 0 ? '+' : ''}${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)}%`

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))

/** A chart spec from plain JSON, through the same parser the chat uses. */
function Chart({ spec }: { spec: object }) {
  const parsed = useMemo(() => parseChartSpec(JSON.stringify(spec)), [spec])

  return 'spec' in parsed ? <ChartFigure spec={parsed.spec} /> : null
}

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

/** Live prices need the market-data service: offered once, explained, never installed unasked. */
function MarketDataCard({ status }: { status: PortfolioStatus }) {
  const queryClient = useQueryClient()

  const prepare = useMutation({
    mutationFn: prepareMarketData,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['portfolio'] })
  })

  if (status.env === 'ready' && status.service === 'running') {
    return null
  }

  const busy = status.env === 'installing' || status.service === 'starting' || prepare.isPending
  const copy = COPY.marketData

  const message =
    status.env === 'installing'
      ? copy.installing
      : status.service === 'starting'
        ? copy.starting
        : status.env === 'outdated'
          ? copy.outdated
          : status.env === 'error'
            ? `${copy.failed} ${status.error}`
            : status.env === 'ready'
              ? status.error
                ? `${copy.startFailed} ${status.error}`
                : copy.stopped
              : copy.missing

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'my-3 flex-row items-center gap-4')} data-portfolio-market-data={status.env}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-(--card-well) text-(--ui-text-secondary)">
        <Codicon name={busy ? 'loading' : 'pulse'} size="1rem" spinning={busy} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[0.875rem] font-medium text-(--ui-text-primary)">{copy.title}</div>
        <div className="mt-0.5 text-[0.75rem] leading-relaxed text-(--ui-text-tertiary)">{message}</div>
      </div>
      {!busy && (
        <Button onClick={() => prepare.mutate()} size="sm" variant="secondary">
          {status.env === 'ready' ? copy.start : status.env === 'outdated' ? copy.update : copy.install}
        </Button>
      )}
    </div>
  )
}

function PositionsTable({ positions }: { positions: PortfolioPosition[] }) {
  const copy = COPY.positions

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'my-3')} data-portfolio-positions="">
      <div className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)">
        {copy.title}
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full border-collapse text-[0.8125rem]">
          <thead>
            <tr className="text-[0.75rem] text-(--ui-text-tertiary)">
              <th className="px-2 py-2 text-left font-medium">{copy.asset}</th>
              <th className="px-2 py-2 text-left font-medium">{copy.class}</th>
              <th className="px-2 py-2 text-right font-medium">{copy.price}</th>
              <th className="px-2 py-2 text-right font-medium">{copy.value}</th>
              <th className="px-2 py-2 text-right font-medium">{copy.weight}</th>
              <th className="px-2 py-2 text-right font-medium">{copy.return}</th>
            </tr>
          </thead>
          <tbody>
            {positions.map(position => (
              <tr
                className="border-t border-(--card-well-stroke) transition-colors hover:bg-(--card-well)"
                key={position.symbol}
              >
                <td className="max-w-64 px-2 py-2.5">
                  <div className="truncate font-medium text-(--ui-text-primary)">{position.name}</div>
                  <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{position.symbol}</div>
                </td>
                <td className="px-2 py-2.5 text-(--ui-text-secondary)">{position.class}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-(--ui-text-secondary)">
                  {euro(position.price, position.price < 10 ? 4 : 2)}
                  {position.source === 'jurnal' && (
                    <span
                      className="ml-1.5 rounded-full bg-(--card-well) px-1.5 py-px text-[0.625rem] text-(--ui-text-tertiary)"
                      title={copy.journalPriceTip}
                    >
                      {copy.journalPrice}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-right font-medium tabular-nums text-(--ui-text-primary)">
                  {euro(position.value, 2)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-(--ui-text-secondary)">
                  {percent(position.weight)}
                </td>
                <td
                  className={cn(
                    'px-2 py-2.5 text-right tabular-nums',
                    position.pnl_pct > 0 && 'text-(--ui-green)',
                    position.pnl_pct < 0 && 'text-(--ui-red)',
                    position.pnl_pct === 0 && 'text-(--ui-text-tertiary)'
                  )}
                >
                  {percent(position.pnl_pct, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Overview({ data }: { data: PortfolioDashboard }) {
  const copy = COPY.dashboard

  const kpis = {
    kpis: [
      { currency: 'EUR', format: 'currency', label: copy.total, value: data.total },
      {
        currency: 'EUR',
        delta: data.pnl_pct,
        format: 'currency',
        hint: copy.sinceStart(dateLabel(data.started)),
        label: copy.pnl,
        value: data.pnl
      },
      { currency: 'EUR', delta: data.day_change_pct, format: 'currency', label: copy.today, value: data.day_change },
      {
        currency: 'EUR',
        format: 'currency',
        hint: copy.ofPortfolio(percent(data.total ? (data.cash / data.total) * 100 : 0)),
        label: copy.cash,
        value: data.cash
      }
    ],
    type: 'kpi'
  }

  const history = {
    categories: data.history.map(point => point.date),
    currency: 'EUR',
    format: 'currency',
    series: [{ data: data.history.map(point => point.value), name: copy.value }],
    subtitle: copy.historySubtitle,
    title: copy.historyTitle,
    type: 'area'
  }

  const allocation = {
    currency: 'EUR',
    format: 'currency',
    slices: data.allocation,
    title: copy.allocationTitle,
    type: 'donut'
  }

  return (
    <>
      <Chart spec={kpis} />
      <div className="grid gap-x-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          {data.history.length > 1 ? (
            <Chart spec={history} />
          ) : (
            <div className={cn(FIGURE_CARD_CLASS, 'my-3 min-h-56 justify-center')}>
              <div className="text-[0.9375rem] font-semibold text-(--ui-text-primary)">{copy.historyTitle}</div>
              <div className="text-[0.8125rem] text-(--ui-text-tertiary)">{copy.historyWaiting}</div>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <Chart spec={allocation} />
        </div>
      </div>
      <PositionsTable positions={data.positions} />
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
        <div className="mx-auto w-full max-w-5xl px-6 py-4">
          {section === 'dashboard' ? (
            <DashboardSection />
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
