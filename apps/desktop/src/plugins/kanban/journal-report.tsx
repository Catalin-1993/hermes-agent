/**
 * The Journal's two readable pieces. `JournalSummary`: the project at a glance — what was decided (and how),
 * reported and discussed, an eight-week chart of it, and who did the most. `EntryReport`: one entry laid out as a
 * short report — its facts as chips, each section under a clear label, the owner's reason set apart, a
 * conversation as messages, and any table of numbers drawn as bars above the table.
 */

import { cn, Codicon, MessageTextContent } from '@hermes/plugin-sdk'

import { JOURNAL } from './journal-copy'
import { journalSummary, type JournalType, messagesOf, parseEntry, type Series, tableSeries } from './journal-model'
import type { JournalEntry } from './types'
import { Avatar } from './ui'

export const TYPE_META: Record<string, { icon: string; tone: string }> = {
  conversation: { icon: 'comment-discussion', tone: '#a78bfa' },
  decision: { icon: 'verified', tone: '#60a5fa' },
  report: { icon: 'file-text', tone: '#34d399' }
}

export const OUTCOME_TONE: Record<string, string> = {
  answered: '#60a5fa',
  approved: '#34d399',
  changes_requested: '#fbbf24',
  unblocked: '#a78bfa'
}

export const outcomeLabel = (outcome: string) =>
  JOURNAL.outcomes[outcome as keyof typeof JOURNAL.outcomes] ?? outcome.replace(/_/g, ' ')

const LABEL = 'text-[0.625rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase'

function Markdown({ text }: { text: string }) {
  return (
    <div
      className="min-w-0 text-[0.875rem] leading-relaxed text-(--ui-text-secondary) [&_.aui-md>:first-child]:mt-0 [&_.aui-md>:last-child]:mb-0"
      data-selectable-text="true"
    >
      <MessageTextContent media={false} text={text} />
    </div>
  )
}

function Tile({
  hint,
  icon,
  label,
  tone,
  value
}: {
  hint: string
  icon: string
  label: string
  tone: string
  value: number | string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3">
      <span className="flex items-center gap-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">
        <Codicon name={icon} size="0.8rem" style={{ color: tone }} />
        {label}
      </span>
      <span className="text-xl font-semibold tracking-tight text-foreground tabular-nums">{value}</span>
      <span className="truncate text-[0.6875rem] text-(--ui-text-quaternary)">{hint}</span>
    </div>
  )
}

function WeekChart({ weeks }: { weeks: ReturnType<typeof journalSummary>['weeks'] }) {
  const most = Math.max(1, ...weeks.map(week => week.counts.decision + week.counts.report + week.counts.conversation))

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-24 items-end gap-1.5">
        {weeks.map(week => (
          <div
            className="flex h-full min-w-0 flex-1 flex-col-reverse overflow-hidden rounded-sm"
            key={week.start}
            title={`${JOURNAL.weekOf(week.start)}: ${JOURNAL.summary.weekCounts(week.counts)}`}
          >
            {(['decision', 'report', 'conversation'] as JournalType[]).map(type => (
              <span
                key={type}
                style={{ backgroundColor: TYPE_META[type]!.tone, height: `${(week.counts[type] / most) * 100}%` }}
              />
            ))}
            {week.counts.decision + week.counts.report + week.counts.conversation === 0 && (
              <span className="h-0.5 rounded-full bg-(--ui-bg-quaternary)" />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 text-[0.5625rem] text-(--ui-text-quaternary) tabular-nums">
        {weeks.map(week => (
          <span className="min-w-0 flex-1 text-center" key={week.start}>
            {week.start.slice(8)}.{week.start.slice(5, 7)}
          </span>
        ))}
      </div>
    </div>
  )
}

function OutcomeBar({ outcomes }: { outcomes: ReturnType<typeof journalSummary>['outcomes'] }) {
  const total = outcomes.reduce((sum, item) => sum + item.count, 0)

  if (!total) {
    return <p className="text-[0.75rem] text-(--ui-text-quaternary)">{JOURNAL.summary.noDecisions}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-(--ui-bg-quaternary)">
        {outcomes.map(item => (
          <span
            key={item.outcome}
            style={{
              backgroundColor: OUTCOME_TONE[item.outcome] ?? 'var(--ui-text-tertiary)',
              width: `${(item.count / total) * 100}%`
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-1 text-[0.75rem]">
        {outcomes.map(item => (
          <li className="flex items-center gap-2 text-(--ui-text-secondary)" key={item.outcome}>
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: OUTCOME_TONE[item.outcome] ?? 'var(--ui-text-tertiary)' }}
            />
            {outcomeLabel(item.outcome)}
            <span className="ml-auto text-(--ui-text-tertiary) tabular-nums">
              {item.count} · {Math.round((item.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The project at a glance, from every entry of the journal. */
export function JournalSummary({ entries }: { entries: readonly JournalEntry[] }) {
  const summary = journalSummary(entries, Date.now())
  const approved = summary.outcomes.find(item => item.outcome === 'approved')?.count ?? 0
  const top = summary.agents[0]

  return (
    <section className="flex flex-col gap-3" data-journal-summary="">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          hint={JOURNAL.summary.approvedOf(approved, summary.byType.decision)}
          icon="verified"
          label={JOURNAL.filters.decision}
          tone={TYPE_META.decision!.tone}
          value={summary.byType.decision}
        />
        <Tile
          hint={JOURNAL.summary.reportsHint}
          icon="file-text"
          label={JOURNAL.filters.report}
          tone={TYPE_META.report!.tone}
          value={summary.byType.report}
        />
        <Tile
          hint={JOURNAL.summary.talksHint}
          icon="comment-discussion"
          label={JOURNAL.filters.conversation}
          tone={TYPE_META.conversation!.tone}
          value={summary.byType.conversation}
        />
        <Tile
          hint={top ? JOURNAL.summary.entries(top.count) : '—'}
          icon="person"
          label={JOURNAL.summary.mostActive}
          tone="var(--ui-text-secondary)"
          value={top?.name ?? '—'}
        />
      </div>
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3">
          <div className="flex items-center gap-3">
            <span className={LABEL}>{JOURNAL.summary.weeks}</span>
            <span className="ml-auto flex gap-3 text-[0.6875rem] text-(--ui-text-tertiary)">
              {(['decision', 'report', 'conversation'] as JournalType[]).map(type => (
                <span className="inline-flex items-center gap-1" key={type}>
                  <span className="size-2 rounded-sm" style={{ backgroundColor: TYPE_META[type]!.tone }} />
                  {JOURNAL.filters[type]}
                </span>
              ))}
            </span>
          </div>
          <WeekChart weeks={summary.weeks} />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3">
          <span className={LABEL}>{JOURNAL.summary.outcomes}</span>
          <OutcomeBar outcomes={summary.outcomes} />
          {summary.agents.length > 1 && (
            <>
              <span className={cn(LABEL, 'mt-1')}>{JOURNAL.summary.byAgent}</span>
              <div className="flex flex-wrap gap-1.5">
                {summary.agents.map(agent => (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-(--ui-bg-tertiary) py-0.5 pr-2 pl-0.5 text-[0.75rem] text-foreground"
                    key={agent.name}
                  >
                    <Avatar name={agent.name} size="1.05rem" />
                    {agent.name}
                    <span className="text-(--ui-text-tertiary) tabular-nums">{agent.count}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/** A table's numbers as horizontal bars, largest first in scale. */
function Bars({ series }: { series: Series }) {
  const most = Math.max(...series.points.map(point => Math.abs(point.value)), 1)

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) p-3"
      data-journal-chart=""
    >
      <span className={LABEL}>{series.name}</span>
      {series.points.map(point => (
        <div
          className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2.5 text-[0.75rem]"
          key={point.label}
        >
          <span className="truncate text-(--ui-text-secondary)">{point.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-(--ui-bg-quaternary)">
            <span
              className="block h-full rounded-full"
              style={{
                backgroundColor: point.value < 0 ? '#f87171' : '#60a5fa',
                width: `${(Math.abs(point.value) / most) * 100}%`
              }}
            />
          </span>
          <span className="text-foreground tabular-nums">{point.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function Conversation({ body }: { body: string }) {
  const messages = messagesOf(body)

  if (!messages.length) {
    return <Markdown text={body} />
  }

  return (
    <ol className="flex flex-col gap-3">
      {messages.map((message, index) => (
        <li className="flex gap-2.5" key={`${message.at}-${index}`}>
          <Avatar name={message.author} size="1.5rem" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[0.75rem]">
              <span className="font-semibold text-foreground">{message.author}</span>
              {message.at && <span className="text-(--ui-text-quaternary)"> · {message.at}</span>}
            </span>
            <Markdown text={message.body} />
          </div>
        </li>
      ))}
    </ol>
  )
}

const REASON = /^your reason$/i
const REPORT = /report/i

function Section({ body, title }: { body: string; title: string }) {
  const series = tableSeries(body)

  if (REASON.test(title)) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border-l-[3px] border-(--ui-green) bg-[color-mix(in_srgb,var(--ui-green)_7%,transparent)] px-4 py-3">
        <span className={LABEL}>{title}</span>
        <Markdown text={body} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>{title}</span>
      {series && <Bars series={series} />}
      {/^\d{4}-\d{2}-\d{2}/.test(title) || body.includes('\n### ') || body.startsWith('### ') ? (
        <Conversation body={body} />
      ) : (
        <div
          className={cn(
            REPORT.test(title) && 'rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) px-4 py-3'
          )}
        >
          <Markdown text={body} />
        </div>
      )}
    </div>
  )
}

/** One entry as a short report: its kind, title and facts, then each section. */
export function EntryReport({ content, entry }: { content: string; entry: JournalEntry }) {
  const { facts, intro, sections } = parseEntry(content)
  const meta = TYPE_META[entry.type] ?? TYPE_META.report!
  const shown = facts.filter(fact => !/^(outcome|agent|date)$/i.test(fact.key))

  return (
    <article className="flex flex-col gap-5" data-journal-report={entry.path}>
      <header className="flex flex-col gap-2.5 border-b border-(--ui-stroke-tertiary) pb-4">
        <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
            style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
          >
            <Codicon name={meta.icon} size="0.8rem" />
            {JOURNAL.types[entry.type as keyof typeof JOURNAL.types] ?? entry.type}
          </span>
          {entry.outcome && (
            <span
              className="rounded-full px-2.5 py-0.5 font-medium"
              style={{
                backgroundColor: `color-mix(in srgb, ${OUTCOME_TONE[entry.outcome] ?? 'var(--ui-text-tertiary)'} 14%, transparent)`,
                color: OUTCOME_TONE[entry.outcome] ?? 'var(--ui-text-secondary)'
              }}
            >
              {outcomeLabel(entry.outcome)}
            </span>
          )}
          {entry.agent && (
            <span className="inline-flex items-center gap-1 text-(--ui-text-secondary)">
              <Avatar name={entry.agent} size="1rem" />
              {entry.agent}
            </span>
          )}
          <span className="text-(--ui-text-tertiary)">
            {new Date(entry.date).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>
        <h2 className="text-[1.25rem] leading-snug font-semibold text-foreground">{entry.title}</h2>
        {shown.length > 0 && (
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem]">
            {shown.map(fact => (
              <div className="flex gap-1.5" key={fact.key}>
                <dt className="text-(--ui-text-tertiary)">{fact.key}</dt>
                <dd className="text-(--ui-text-secondary)">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>
      {intro && <Markdown text={intro} />}
      {sections.map((section, index) => (
        <Section body={section.body} key={`${section.title}-${index}`} title={section.title} />
      ))}
    </article>
  )
}
