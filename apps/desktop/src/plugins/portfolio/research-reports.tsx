/** The team's reports: listed beside the sheet (newest first, optionally only the open symbol's), and read in place. */

import { Button, cn, Codicon, MessageTextContent, useQuery } from '@hermes/plugin-sdk'

import { fetchResearchReport, type ResearchReport } from './api'
import { COPY } from './copy'
import { dateLabel } from './format'
import { CARD, CARD_PAD, CARD_PAD_SM, H2, H2_LARGE, MUTED } from './ui'

/** A verdict's colour: buy (or a passed safety drill) green, avoid (or a failed one) red, anything else neutral. */
const GOOD = ['cump', 'buy', 'trec']
const BAD = ['evit', 'avoid', 'vinde', 'pic']

function verdictClass(verdict: string) {
  const word = verdict.toLowerCase()

  return GOOD.some(start => word.startsWith(start))
    ? 'bg-(--ui-green)/12 text-(--ui-green)'
    : BAD.some(start => word.startsWith(start))
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

/** A small tag for the reports that are not a single agent's: the committee's, and safety drills. */
function KindTag({ kind }: { kind?: string }) {
  const label = kind ? COPY.research.reports.kinds[kind as keyof typeof COPY.research.reports.kinds] : undefined

  return label ? (
    <span className="rounded-full border border-(--card-well-stroke) px-2 py-0.5 text-[0.6875rem] font-medium text-(--ui-text-secondary)">
      {label}
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
    <section className={cn(CARD, CARD_PAD_SM, 'gap-2.5')} data-portfolio-reports="">
      <div className="flex items-center justify-between gap-2">
        <h2 className={H2}>{copy.title}</h2>
        <button
          aria-pressed={onlySymbol}
          className={cn(
            'h-[30px] cursor-pointer rounded-full border px-3 text-[0.78125rem] font-medium transition-colors',
            onlySymbol
              ? 'border-(--card-well-stroke) bg-(--card-well) text-(--ui-text-primary)'
              : 'border-transparent text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
          )}
          onClick={onToggleOnly}
          type="button"
        >
          {copy.only(symbol)}
        </button>
      </div>
      {shown.length ? (
        <ul className="m-0 flex max-h-72 list-none flex-col gap-0.5 overflow-y-auto p-0">
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
                  <KindTag kind={report.kind} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2.5 px-3 pt-4 pb-2 text-center">
          <span className="grid size-11 place-items-center rounded-[14px] border border-(--card-well-stroke) bg-(--card-well) text-(--ui-text-secondary)">
            <Codicon name="file" size="1.125rem" />
          </span>
          <span className="text-sm font-medium text-(--ui-text-primary)">{copy.noneTitle}</span>
          <span className="max-w-70 text-[0.8125rem] text-(--ui-text-secondary)">
            {onlySymbol && reports.length ? copy.noneForSymbol(symbol) : copy.none}
          </span>
        </div>
      )}
      <div className="flex min-w-0 items-center gap-2.5 rounded-[10px] bg-(--card-well) px-3 py-2.5">
        <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="folder" size="0.9375rem" />
        <span className={cn('shrink-0 text-xs', MUTED)}>{copy.folderLabel}</span>
        <span className="truncate font-mono text-[0.71875rem] text-(--ui-text-secondary)" title={dir}>
          {dir}
        </span>
      </div>
    </section>
  )
}

export function ReportReader({ name, onClose }: { name: string; onClose: () => void }) {
  const copy = COPY.research.reports

  const { data, error, isLoading } = useQuery({
    queryFn: () => fetchResearchReport(name),
    queryKey: ['portfolio', 'research', 'report', name]
  })

  return (
    <section className={cn(CARD, CARD_PAD, 'gap-3.5')} data-portfolio-report={name}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={H2_LARGE}>{data?.title ?? name}</h2>
          {data && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.75rem] text-(--ui-text-tertiary)">
              {data.symbol && <span className="font-semibold text-(--ui-text-secondary)">{data.symbol}</span>}
              <span>{safeDate(data.date)}</span>
              {data.author && <span>· {data.author}</span>}
              <Verdict verdict={data.verdict} />
              <KindTag kind={data.kind} />
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
    </section>
  )
}
