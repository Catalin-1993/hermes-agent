/**
 * The Agents view: the owner's control room. One switch pauses the whole board (and a second
 * button stops what is running now); a ring shows this month's spend by agent against the budgets;
 * then one card per agent — live status, load, its last two weeks of finished runs, spend against
 * its monthly budget — with Pause/Resume, Stop now and the budget editor on the card. Controls are
 * board-scoped and enforced by the dispatcher (`kanban_db_controls`).
 */

import {
  Button,
  cn,
  Codicon,
  ConfirmDialog,
  host,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useQuery,
  useValue
} from '@hermes/plugin-sdk'
import { useState } from 'react'

import { $agentFile, $boardSlug, activityKey, fetchActivity, setControl, stopAgentWork, useKanbanScope } from './api'
import { usd, useControls } from './inbox'
import { type TeamRow, teamRows } from './overview-model'
import type { AgentControl, KanbanBoard, KanbanControls } from './types'
import { Avatar, errText, type KanbanText, useKanban } from './ui'

/** Chart colours, one per agent and distinct from each other (avatar hues can repeat). */
export const AGENT_PALETTE = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#22d3ee', '#fb923c', '#f87171']

export const chartColors = (agents: AgentControl[]) =>
  new Map(
    [...agents.map(agent => agent.profile)]
      .sort()
      .map((name, index) => [name, AGENT_PALETTE[index % AGENT_PALETTE.length]])
  )

const CARD = 'flex min-w-0 flex-col gap-3 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3.5'

export type Status = 'boardPaused' | 'budget' | 'idle' | 'paused' | 'working'

export const STATUS_TONE: Record<Status, string> = {
  boardPaused: '#fbbf24',
  budget: '#f87171',
  idle: 'var(--ui-text-quaternary)',
  paused: '#fbbf24',
  working: '#34d399'
}

export function statusOf(agent: AgentControl, row: TeamRow | undefined, allPaused: boolean): Status {
  if (agent.paused) {
    return agent.pause_reason === 'budget' ? 'budget' : 'paused'
  }

  if (allPaused) {
    return 'boardPaused'
  }

  return row && row.running > 0 ? 'working' : 'idle'
}

/** A control call with its toast; the controls query is refreshed with the answer. */
function useControlWrite() {
  const { refetch } = useControls()

  return async (write: () => Promise<unknown>, done: string) => {
    try {
      await write()
      host.notify({ kind: 'success', message: done })
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })
    }

    void refetch()
  }
}

function StopButton({
  count,
  k,
  label,
  profile,
  title
}: {
  count: number
  k: KanbanText
  label: string
  profile: string
  title: string
}) {
  const [asking, setAsking] = useState(false)
  const write = useControlWrite()

  return (
    <>
      <Button disabled={count === 0} onClick={() => setAsking(true)} size="sm" variant="ghost">
        <Codicon className="text-destructive" name="debug-stop" size="0.8rem" />
        {label}
      </Button>
      {asking && (
        <ConfirmDialog
          cancelLabel={k.inbox.cancel}
          confirmLabel={k.agents.stop}
          description={k.agents.stopBody(count)}
          destructive
          onClose={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false)
            void write(() => stopAgentWork(profile), k.agents.stopped(count))
          }}
          open
          title={title}
        />
      )}
    </>
  )
}

function MasterControl({ board, controls, k }: { board: KanbanBoard; controls: KanbanControls; k: KanbanText }) {
  const write = useControlWrite()
  const running = board.columns.find(column => column.name === 'running')?.tasks.length ?? 0
  const paused = controls.all_paused

  return (
    <section
      className={cn(CARD, 'justify-between sm:flex-row sm:items-center')}
      style={paused ? { borderColor: 'color-mix(in srgb, #fbbf24 45%, transparent)' } : undefined}
    >
      <div className="flex items-center gap-3">
        <span
          className="grid size-10 place-items-center rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${paused ? '#fbbf24' : '#34d399'} 14%, transparent)`,
            color: paused ? '#fbbf24' : '#34d399'
          }}
        >
          <Codicon name={paused ? 'debug-pause' : 'pulse'} size="1.1rem" />
        </span>
        <div>
          <div className="text-[0.9375rem] font-semibold text-foreground">
            {paused ? k.agents.boardPaused : k.agents.everyoneWorking}
          </div>
          <div className="text-[0.75rem] text-(--ui-text-tertiary)">
            {paused ? k.agents.boardPausedHint : k.agents.everyoneWorkingHint}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StopButton count={running} k={k} label={k.agents.stopAll} profile="*" title={k.agents.stopAllTitle} />
        <Button
          className={cn(!paused && 'border-[#fbbf24]/50 text-[#fbbf24] hover:bg-[#fbbf24]/10')}
          onClick={() =>
            void write(
              () => setControl({ paused: !paused, profile: '*' }),
              paused ? k.agents.resumeAll : k.agents.pauseAll
            )
          }
          size="sm"
          variant={paused ? 'default' : 'outline'}
        >
          <Codicon name={paused ? 'debug-start' : 'debug-pause'} size="0.8rem" />
          {paused ? k.agents.resumeAll : k.agents.pauseAll}
        </Button>
      </div>
    </section>
  )
}

/** This month's spend by agent as a ring, with the total against the budgets in the middle. */
function SpendRing({ agents, colors, k }: { agents: AgentControl[]; colors: Map<string, string>; k: KanbanText }) {
  const spent = agents.filter(agent => (agent.month_spend_usd ?? 0) > 0)
  const total = spent.reduce((sum, agent) => sum + (agent.month_spend_usd ?? 0), 0)
  const budgets = agents.reduce((sum, agent) => sum + (agent.monthly_budget_usd ?? 0), 0)
  const radius = 34
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <section className={cn(CARD, 'flex-row items-center gap-4')}>
      <svg aria-hidden className="size-24 shrink-0 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" fill="none" r={radius} stroke="var(--ui-bg-quaternary)" strokeWidth="9" />
        {spent.map(agent => {
          const length = ((agent.month_spend_usd ?? 0) / total) * circumference

          const dash = (
            <circle
              cx="40"
              cy="40"
              fill="none"
              key={agent.profile}
              r={radius}
              stroke={colors.get(agent.profile)}
              strokeDasharray={`${Math.max(length - 1.5, 0.5)} ${circumference}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              strokeWidth="9"
            />
          )

          offset += length

          return dash
        })}
      </svg>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-(--ui-text-tertiary)">
          {k.agents.spendTitle}
        </div>
        <div className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{usd(total)}</div>
        <div className="text-[0.6875rem] text-(--ui-text-quaternary)">
          {budgets > 0 ? k.agents.spendTotal(usd(total), usd(budgets)) : k.agents.spendNoBudgets(usd(total))}
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-(--ui-text-secondary)">
          {spent.map(agent => (
            <li className="inline-flex items-center gap-1.5" key={agent.profile}>
              <span className="size-2 rounded-full" style={{ backgroundColor: colors.get(agent.profile) }} />
              {agent.profile}
              <span className="tabular-nums text-(--ui-text-tertiary)">{usd(agent.month_spend_usd ?? 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function Sparkline({ color, height = 'h-8', values }: { color: string; height?: string; values: number[] }) {
  const peak = Math.max(1, ...values)

  return (
    <div className={cn('flex items-end gap-0.5', height)}>
      {values.map((value, index) => (
        <span
          className="min-w-0 flex-1 rounded-[2px]"
          key={index}
          style={{
            backgroundColor: value ? color : 'var(--ui-bg-quaternary)',
            height: value ? `${Math.max(12, (value / peak) * 100)}%` : '2px',
            opacity: value ? 0.85 : 1
          }}
        />
      ))}
    </div>
  )
}

export function BudgetMeter({ agent, k }: { agent: AgentControl; k: KanbanText }) {
  const spend = agent.month_spend_usd
  const budget = agent.monthly_budget_usd

  if (spend === null) {
    return <div className="text-[0.75rem] text-(--ui-text-quaternary)">{k.agents.noStore}</div>
  }

  const share = budget ? spend / budget : 0
  const tone = share >= 1 ? '#f87171' : share >= 0.75 ? '#fbbf24' : '#34d399'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[0.75rem]">
        <span className="font-medium tabular-nums text-foreground">
          {budget ? k.agents.ofBudget(usd(spend), usd(budget)) : k.agents.noLimit(usd(spend))}
        </span>
        {budget ? <span className="tabular-nums text-(--ui-text-tertiary)">{Math.round(share * 100)}%</span> : null}
      </div>
      {budget ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-(--ui-bg-quaternary)">
          <div
            className="h-full rounded-full"
            style={{ backgroundColor: tone, width: `${Math.min(100, share * 100)}%` }}
          />
        </div>
      ) : null}
      {agent.unpriced_sessions > 0 && (
        <div className="text-[0.625rem] text-(--ui-text-quaternary)">{k.agents.unpriced(agent.unpriced_sessions)}</div>
      )}
    </div>
  )
}

function BudgetEditor({ agent, k, raise }: { agent: AgentControl; k: KanbanText; raise: boolean }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(agent.monthly_budget_usd ? String(agent.monthly_budget_usd) : '')
  const write = useControlWrite()
  const amount = Number(value.replace(',', '.'))

  const save = (body: Parameters<typeof setControl>[0]) => {
    setOpen(false)
    void write(() => setControl(body), k.inbox.done.budget)
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={raise ? 'default' : 'ghost'}>
          <Codicon name={raise ? 'arrow-up' : 'credit-card'} size="0.8rem" />
          {raise ? k.agents.raiseBudget : agent.monthly_budget_usd ? k.agents.editBudget : k.agents.setBudget}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-2.5 p-3">
        <label className="flex flex-col gap-1.5 text-[0.75rem] font-medium text-foreground">
          {k.agents.budgetLabel}
          <Input
            autoFocus
            inputMode="decimal"
            onChange={event => setValue(event.target.value)}
            placeholder="20"
            value={value}
          />
        </label>
        <p className="text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">{k.agents.budgetHint}</p>
        <div className="flex items-center justify-between gap-2">
          {agent.monthly_budget_usd ? (
            <Button onClick={() => save({ clear_budget: true, profile: agent.profile })} size="sm" variant="ghost">
              {k.agents.removeBudget}
            </Button>
          ) : (
            <span />
          )}
          <Button
            disabled={!(amount > 0)}
            onClick={() => save({ monthly_budget_usd: amount, profile: agent.profile })}
            size="sm"
          >
            {k.inbox.save}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AgentCard({
  agent,
  allPaused,
  color,
  k,
  row,
  runs
}: {
  agent: AgentControl
  allPaused: boolean
  color: string
  k: KanbanText
  row?: TeamRow
  runs: number[]
}) {
  const status = statusOf(agent, row, allPaused)
  const counts = ['running', 'queued', 'blocked', 'done'] as const

  return (
    <article className={CARD} data-agent-card={agent.profile}>
      <header className="flex items-center gap-2.5">
        <span className="relative">
          <Avatar name={agent.profile} size="2.25rem" />
          {status === 'working' && (
            <span
              aria-hidden
              className="absolute -right-0.5 -bottom-0.5 size-3 animate-pulse rounded-full border-2 border-(--ui-bg-elevated)"
              style={{ backgroundColor: STATUS_TONE.working }}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <button
            className="block max-w-full cursor-pointer truncate text-left text-[0.9375rem] font-semibold text-foreground hover:underline"
            onClick={() => $agentFile.set(agent.profile)}
            type="button"
          >
            {agent.profile}
          </button>
          <span
            className="mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[0.625rem] font-medium"
            style={{
              backgroundColor: `color-mix(in srgb, ${STATUS_TONE[status]} 14%, transparent)`,
              color: STATUS_TONE[status]
            }}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: STATUS_TONE[status] }} />
            {k.agents.status[status]}
          </span>
        </div>
      </header>
      <div className="grid grid-cols-4 gap-1 text-center">
        {counts.map(key => (
          <div className="rounded-md bg-(--ui-bg-quinary) py-1.5" key={key}>
            <div className="text-[0.9375rem] font-semibold tabular-nums text-foreground">{row?.[key] ?? 0}</div>
            <div className="text-[0.5625rem] uppercase tracking-wide text-(--ui-text-quaternary)">
              {k.overview.team[key]}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-[0.625rem] uppercase tracking-wide text-(--ui-text-quaternary)">{k.agents.runs14}</div>
        <Sparkline color={color} values={runs} />
      </div>
      <BudgetMeter agent={agent} k={k} />
      <footer className="-mx-1 flex flex-wrap items-center gap-1 border-t border-(--ui-stroke-tertiary) pt-2">
        <AgentActions agent={agent} k={k} running={row?.running ?? 0} status={status} />
      </footer>
    </article>
  )
}

/** Pause/Resume, Stop now and the budget editor for one agent (its card and its file). */
export function AgentActions({
  agent,
  k,
  running,
  status
}: {
  agent: AgentControl
  k: KanbanText
  running: number
  status: Status
}) {
  const write = useControlWrite()

  return (
    <>
        {/* Over budget, Resume would only be paused again by the next check: the way back is the limit. */}
        {status !== 'budget' && (
          <Button
            onClick={() =>
              void write(
                () => setControl({ paused: !agent.paused, profile: agent.profile }),
                agent.paused ? k.agents.resumedToast(agent.profile) : k.agents.pausedToast(agent.profile)
              )
            }
            size="sm"
            variant={agent.paused ? 'default' : 'outline'}
          >
            <Codicon name={agent.paused ? 'debug-start' : 'debug-pause'} size="0.8rem" />
            {agent.paused ? k.agents.resume : k.agents.pause}
          </Button>
        )}
        <StopButton
          count={running}
          k={k}
          label={k.agents.stop}
          profile={agent.profile}
          title={k.agents.stopTitle(agent.profile)}
        />
        <span className="ml-auto">
          <BudgetEditor agent={agent} k={k} key={agent.monthly_budget_usd ?? 'none'} raise={status === 'budget'} />
        </span>
    </>
  )
}

export function BoardAgents({ board }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const k = useKanban()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const { data: controls } = useControls()

  const { data: activity } = useQuery({
    queryFn: fetchActivity,
    queryKey: activityKey(scope, slug),
    refetchInterval: 30_000
  })

  const rows = new Map(teamRows(board).map(row => [row.name, row]))
  const days = activity?.days.length ?? 14

  if (!controls) {
    return <div className="grid flex-1 place-items-center text-[0.75rem] text-(--ui-text-quaternary)">…</div>
  }

  // Busiest first: working, then by load; agents with nothing at all keep their alphabetical place last.
  const load = (name: string) => {
    const row = rows.get(name)

    return row ? row.running * 1000 + row.blocked * 100 + row.queued * 10 + row.done : -1
  }

  const agents = [...controls.agents].sort((a, b) => load(b.profile) - load(a.profile))
  const colors = chartColors(controls.agents)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4" data-kanban-agents="">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <MasterControl board={board} controls={controls} k={k} />
        <SpendRing agents={controls.agents} colors={colors} k={k} />
      </div>
      {agents.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {agents.map(agent => (
            <AgentCard
              agent={agent}
              allPaused={controls.all_paused}
              color={colors.get(agent.profile) ?? AGENT_PALETTE[0]}
              k={k}
              key={agent.profile}
              row={rows.get(agent.profile)}
              runs={activity?.by_profile?.[agent.profile] ?? Array.from({ length: days }, () => 0)}
            />
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-[0.8125rem] text-(--ui-text-tertiary)">{k.agents.empty}</p>
      )}
    </div>
  )
}

/** Above the board in either look, while everyone is paused: say so, with the way back. */
export function PauseBanner() {
  const k = useKanban()
  const { data: controls, refetch } = useControls()

  if (!controls?.all_paused) {
    return null
  }

  return (
    <div
      className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[0.8125rem]"
      role="status"
      style={{ backgroundColor: 'color-mix(in srgb, #fbbf24 12%, transparent)', color: '#fbbf24' }}
    >
      <Codicon name="debug-pause" size="0.9rem" />
      <span className="flex-1 text-foreground">{k.agents.bannerText}</span>
      <Button
        onClick={() =>
          void setControl({ paused: false, profile: '*' })
            .then(() => refetch())
            .catch(error => host.notify({ kind: 'error', message: errText(error) }))
        }
        size="sm"
        variant="outline"
      >
        <Codicon name="debug-start" size="0.75rem" />
        {k.agents.bannerResume}
      </Button>
    </div>
  )
}
