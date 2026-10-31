/**
 * The board's Overview face, in the spirit of Paperclip's dashboard: it answers, in order, what is
 * happening, does it need me, and who is doing what. Four headline numbers; the runs of the last two
 * weeks by outcome and the success rate; how the cards spread across the lanes; what waits on the
 * owner; the team's load; and the recent moments of work. The board and its filters come from the
 * page; the run history and feed from GET /activity.
 */

import { cn, Codicon, Loader, Tip, useQuery, useValue } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'

import { $boardSlug, $boardView, activityKey, fetchActivity, useKanbanScope } from './api'
import { GoalsStrip } from './goals-view'
import { agentsAtWork, needsYou, statusShares, teamRows } from './overview-model'
import { ProjectHeader } from './project-header'
import { useRules } from './team-queries'
import { type ActivityDay, columnMeta, type KanbanActivity, type KanbanBoard } from './types'
import { ago, Avatar, columnLabel, type KanbanText, useKanban } from './ui'
import { WatchdogPanel } from './watchdog'
import { YourActions } from './your-actions'

/** One status vocabulary everywhere: completed runs take the running lane's green. */
const OUTCOME_TONE: Record<keyof KanbanActivity['totals'], string> = {
  // A run that ended blocked waits on someone; one that failed broke. Orange vs red keeps them apart.
  blocked: '#fb923c',
  completed: columnMeta('running').tone,
  failed: '#f87171',
  other: 'var(--ui-text-quaternary)'
}

const OUTCOMES = ['completed', 'failed', 'blocked', 'other'] as const

const CARD = 'flex min-w-0 flex-col gap-3 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3.5'

function Section({
  action,
  children,
  className,
  title
}: {
  action?: ReactNode
  children: ReactNode
  className?: string
  title: string
}) {
  return (
    <section className={cn(CARD, className)}>
      <header className="flex items-center gap-2">
        <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-(--ui-text-tertiary)">{title}</h3>
        <span className="ml-auto text-[0.625rem] text-(--ui-text-quaternary)">{action}</span>
      </header>
      {children}
    </section>
  )
}

function Metric({
  hint,
  icon,
  label,
  tone,
  value
}: {
  hint: string
  icon: string
  label: string
  tone?: string
  value: string
}) {
  return (
    <div className={cn(CARD, 'gap-1.5')}>
      <div className="flex items-center gap-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">
        <Codicon name={icon} size="0.8rem" style={tone ? { color: tone } : undefined} />
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</div>
      <div className="text-[0.6875rem] text-(--ui-text-quaternary)">{hint}</div>
    </div>
  )
}

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).getDate()

function RunChart({ days, k }: { days: ActivityDay[]; k: KanbanText }) {
  const total = (day: ActivityDay) => day.completed + day.failed + day.blocked + day.other
  const peak = Math.max(1, ...days.map(total))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-36 items-end gap-1">
        {days.map(day => (
          <Tip key={day.date} label={k.overview.dayTip(day.date, day.completed, day.failed, day.blocked)}>
            <div className="flex h-full min-w-0 flex-1 cursor-help flex-col justify-end">
              <div
                className="flex flex-col-reverse overflow-hidden rounded-sm"
                style={{ height: `${(total(day) / peak) * 100}%` }}
              >
                {OUTCOMES.map(outcome =>
                  day[outcome] ? (
                    <span key={outcome} style={{ backgroundColor: OUTCOME_TONE[outcome], flexGrow: day[outcome] }} />
                  ) : null
                )}
              </div>
              {total(day) === 0 && <span className="h-0.5 rounded-full bg-(--ui-bg-quaternary)" />}
            </div>
          </Tip>
        ))}
      </div>
      <div className="flex gap-1 text-[0.5625rem] tabular-nums text-(--ui-text-quaternary)">
        {days.map((day, index) => (
          <span className="min-w-0 flex-1 text-center" key={day.date}>
            {index % 2 === days.length % 2 ? '' : dayLabel(day.date)}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[0.6875rem] text-(--ui-text-tertiary)">
        {OUTCOMES.map(outcome => (
          <span className="inline-flex items-center gap-1.5" key={outcome}>
            <span className="size-2 rounded-sm" style={{ backgroundColor: OUTCOME_TONE[outcome] }} />
            {k.overview.outcomes[outcome]}
          </span>
        ))}
      </div>
    </div>
  )
}

function StatusBar({ board, k }: { board: KanbanBoard; k: KanbanText }) {
  const shares = statusShares(board)
  const total = shares.reduce((sum, share) => sum + share.count, 0)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-(--ui-bg-quaternary)">
        {shares.map(share => (
          <span key={share.name} style={{ backgroundColor: columnMeta(share.name).tone, flexGrow: share.count }} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.75rem]">
        {shares.map(share => (
          <li className="flex items-center gap-1.5 text-(--ui-text-secondary)" key={share.name}>
            <span className="size-2 rounded-full" style={{ backgroundColor: columnMeta(share.name).tone }} />
            {columnLabel(k, share.name)}
            <span className="ml-auto tabular-nums text-(--ui-text-tertiary)">
              {share.count}
              <span className="ml-1 text-(--ui-text-quaternary)">
                {total ? Math.round((share.count / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Team({ board, k }: { board: KanbanBoard; k: KanbanText }) {
  const rows = teamRows(board)
  const counts = ['running', 'queued', 'blocked', 'done'] as const

  const tone = {
    blocked: columnMeta('blocked').tone,
    done: 'var(--ui-text-tertiary)',
    queued: columnMeta('ready').tone,
    running: columnMeta('running').tone
  }

  return rows.length ? (
    <ul className="flex flex-col gap-2.5">
      {rows.map(row => (
        <li className="flex items-center gap-2.5" key={row.name}>
          <span className="relative">
            <Avatar name={row.name} size="1.75rem" />
            {row.running > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -bottom-0.5 size-2.5 animate-pulse rounded-full border-2 border-(--ui-bg-elevated)"
                style={{ backgroundColor: tone.running }}
              />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-foreground">{row.name}</span>
          <span className="flex shrink-0 gap-2.5 text-[0.6875rem] tabular-nums">
            {counts.map(key =>
              row[key] ? (
                <span className="inline-flex items-center gap-1" key={key} style={{ color: tone[key] }}>
                  {row[key]}
                  <span className="text-(--ui-text-quaternary)">{k.overview.team[key]}</span>
                </span>
              ) : null
            )}
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-[0.75rem] text-(--ui-text-quaternary)">{k.overview.teamEmpty}</p>
  )
}

function Feed({ activity, k, onOpen }: { activity: KanbanActivity; k: KanbanText; onOpen: (id: string) => void }) {
  return activity.events.length ? (
    <ul className="-mx-1.5 flex flex-col">
      {activity.events.slice(0, 12).map(event => (
        <li key={event.id}>
          <button
            className="flex w-full cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-(--chrome-action-hover)"
            onClick={() => onOpen(event.task_id)}
            type="button"
          >
            {event.actor ? (
              <Avatar name={event.actor} size="1.25rem" />
            ) : (
              <Codicon className="mt-0.5" name="pulse" size="0.85rem" />
            )}
            <span className="min-w-0 flex-1 text-[0.75rem] leading-snug text-(--ui-text-tertiary)">
              <span className="font-medium text-(--ui-text-secondary)">{event.actor || k.overview.someone}</span>{' '}
              {k.overview.feed[event.kind as keyof KanbanText['overview']['feed']] ?? event.kind}{' '}
              <span className="text-foreground">{event.task_title}</span>
            </span>
            <span className="shrink-0 text-[0.625rem] text-(--ui-text-quaternary)">{ago(event.created_at)}</span>
          </button>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-[0.75rem] text-(--ui-text-quaternary)">{k.overview.feedEmpty}</p>
  )
}

/** The Rules card beside the numbers: how many approval rules are on, how many cards they hold for you now, and
 *  the way into them (Rules has no tab of its own). */
function RulesMetric() {
  const k = useKanban()
  const { data } = useRules()
  const on = data?.rules.filter(rule => rule.enabled).length ?? 0
  const held = Object.keys(data?.holds ?? {}).length

  return (
    <button
      className={cn(CARD, 'cursor-pointer gap-1.5 text-left transition-colors hover:border-(--ui-stroke-secondary)')}
      data-overview-rules=""
      onClick={() => $boardView.set('rules')}
      type="button"
    >
      <div className="flex items-center gap-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">
        <Codicon name="law" size="0.8rem" />
        {k.overview.views.rules}
        <Codicon className="ml-auto" name="arrow-right" size="0.75rem" />
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{data ? on : '—'}</div>
      <div className="text-[0.6875rem] text-(--ui-text-quaternary)">{RULES_HINT(on, held)}</div>
    </button>
  )
}

const RULES_HINT = (on: number, held: number) =>
  held
    ? `${on} on · ${held} holding a card for you`
    : on === 1
      ? '1 rule on · who approves what'
      : `${on} rules on · who approves what`

export function BoardOverview({ board, onOpen }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const k = useKanban()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  const { data: activity, error } = useQuery({
    queryFn: fetchActivity,
    queryKey: activityKey(scope, slug),
    refetchInterval: 30_000
  })

  const running = board.columns.find(column => column.name === 'running')?.tasks.length ?? 0
  const waiting = needsYou(board).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4" data-kanban-overview="">
      <ProjectHeader board={board} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Metric
          hint={k.overview.tasksInProgress(running)}
          icon="organization"
          label={k.overview.agentsAtWork}
          tone={columnMeta('running').tone}
          value={String(agentsAtWork(board))}
        />
        <Metric
          hint={k.overview.needsYouHint}
          icon="bell-dot"
          label={k.overview.needsYou}
          tone={waiting ? columnMeta('blocked').tone : undefined}
          value={String(waiting)}
        />
        <Metric
          hint={activity ? k.overview.failedHint(activity.totals.failed) : '—'}
          icon="pass-filled"
          label={k.overview.finished}
          value={activity ? String(activity.totals.completed) : '—'}
        />
        <Metric
          hint={activity?.success_rate === null ? k.overview.noRuns : k.overview.successRateHint}
          icon="graph"
          label={k.overview.successRate}
          value={activity && activity.success_rate !== null ? `${Math.round(activity.success_rate)}%` : '—'}
        />
        <RulesMetric />
      </div>
      {/* What may be stuck and what waits on you, side by side: the two things to look at first. */}
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <WatchdogPanel onOpen={onOpen} />
          <GoalsStrip narrow onShow={() => $boardView.set('goals')} />
        </div>
        <YourActions board={board} compact />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Section action={k.overview.last14Days} className="lg:col-span-2" title={k.overview.activityTitle}>
          {activity ? (
            <RunChart days={activity.days} k={k} />
          ) : (
            <div className="grid h-36 place-items-center text-[0.75rem] text-(--ui-text-quaternary)">
              {error ? k.overview.loadFailed : <Loader type="lemniscate-bloom" />}
            </div>
          )}
        </Section>
        <Section title={k.overview.statusTitle}>
          <StatusBar board={board} k={k} />
        </Section>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Section title={k.overview.teamTitle}>
          <Team board={board} k={k} />
        </Section>
        <Section title={k.overview.feedTitle}>
          {activity ? <Feed activity={activity} k={k} onOpen={onOpen} /> : null}
        </Section>
      </div>
    </div>
  )
}
