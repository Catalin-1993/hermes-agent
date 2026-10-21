/** The team's reports: listed beside the sheet (newest first, optionally only the open symbol's), and read in place. */

import { Button, cn, Codicon, FIGURE_CARD_CLASS, MessageTextContent, useQuery } from '@hermes/plugin-sdk'

import { fetchResearchReport, type ResearchReport } from './api'
import { COPY } from './copy'
import { dateLabel } from './format'

const TITLE = 'text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)'

/** A verdict's colour: buy green, avoid red, anything else neutral. */
function verdictClass(verdict: string) {
  const word = verdict.toLowerCase()

  return word.startsWith('cump') || word.startsWith('buy')
    ? 'bg-(--ui-green)/12 text-(--ui-green)'
    : word.startsWith('evit') || word.startsWith('avoid') || word.startsWith('vinde')
      ? 'bg-(--ui-red)/12 text-(--ui-red)'
      : 'bg-(--card-well) text-(--ui-text-secondary)'
}

export function Verdict({ verdict }: { verdict: string }) {
  return verdict ? (
    <span className={cn('rounded-full px-2 py-0.5 text-[0.6875rem] font-medium', verdictClass(verdict))}>
      {verdict}
    </span>
  ) : null
}

const safeDate = (iso: string) => (Number.isNaN(Date.parse(iso)) ? iso : dateLabel(iso))

export function ReportsCard({
  dir,
  onOpen,
  onlySymbol,
  onToggleOnly,
  open,
  reports,
  symbol
}: {
  dir: string
  onOpen: (name: string) => void
  onlySymbol: boolean
  onToggleOnly: () => void
  open: null | string
  reports: ResearchReport[]
  symbol: string
}) {
  const copy = COPY.research.reports
  const shown = onlySymbol ? reports.filter(report => report.symbol === symbol) : reports

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'gap-2')} data-portfolio-reports="">
      <div className="flex items-center justify-between gap-2">
        <div className={TITLE}>{copy.title}</div>
        <button
          aria-pressed={onlySymbol}
          className={cn(
            'h-6 cursor-pointer rounded-full px-2.5 text-[0.6875rem] font-medium transition-colors',
            onlySymbol
              ? 'bg-(--card-well) text-(--ui-text-primary)'
              : 'text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
          )}
          onClick={onToggleOnly}
          type="button"
        >
          {copy.only(symbol)}
        </button>
      </div>
      {shown.length ? (
        <ul className="-mx-1 flex flex-col gap-0.5">
          {shown.map(report => (
            <li key={report.name}>
              <button
                aria-pressed={report.name === open}
                className={cn(
                  'flex w-full cursor-pointer flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors',
                  report.name === open ? 'bg-(--card-well)' : 'hover:bg-(--card-well)'
                )}
                onClick={() => onOpen(report.name)}
                type="button"
              >
                <span className="line-clamp-2 text-[0.8125rem] font-medium text-(--ui-text-primary)">
                  {report.title}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">
                  {report.symbol && <span className="font-semibold text-(--ui-text-secondary)">{report.symbol}</span>}
                  <span>{safeDate(report.date)}</span>
                  <Verdict verdict={report.verdict} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2 text-[0.8125rem] leading-relaxed text-(--ui-text-tertiary)">
          {onlySymbol && reports.length ? copy.noneForSymbol(symbol) : copy.none}
        </p>
      )}
      <p className="px-1 text-[0.6875rem] leading-relaxed break-all text-(--ui-text-tertiary)">{copy.folder(dir)}</p>
    </div>
  )
}

export function ReportReader({ name, onClose }: { name: string; onClose: () => void }) {
  const copy = COPY.research.reports

  const { data, error, isLoading } = useQuery({
    queryFn: () => fetchResearchReport(name),
    queryKey: ['portfolio', 'research', 'report', name]
  })

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'gap-4')} data-portfolio-report={name}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={TITLE}>{data?.title ?? name}</div>
          {data && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.75rem] text-(--ui-text-tertiary)">
              {data.symbol && <span className="font-semibold text-(--ui-text-secondary)">{data.symbol}</span>}
              <span>{safeDate(data.date)}</span>
              {data.author && <span>· {data.author}</span>}
              <Verdict verdict={data.verdict} />
            </div>
          )}
        </div>
        <Button onClick={onClose} size="sm" variant="ghost">
          <Codicon className="mr-1.5" name="arrow-left" />
          {copy.back}
        </Button>
      </div>
      {isLoading ? (
        <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{copy.loading}</p>
      ) : error || !data ? (
        <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{copy.loadFailed}</p>
      ) : (
        <div
          className="min-w-0 text-[0.875rem] leading-relaxed text-(--ui-text-primary) [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
          // The app shell sets user-select: none globally; a report opts back in so it can be copied.
          data-selectable-text="true"
        >
          <MessageTextContent media={false} text={data.body} />
        </div>
      )}
    </div>
  )
}
