/**
 * The agent's file: one page per agent, opened from its card in the Org chart or the Agents view.
 * The header is who it is and where it sits (title, manager, direct reports) with its controls;
 * the tabs are its numbers (success rate, runs, typical run, spend, last two weeks), its work on
 * this board, its schedule, and its standing instructions (SOUL.md). Everything is edited in place.
 */

import {
  Button,
  cn,
  Codicon,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  host,
  Input,
  SegmentedControl,
  Textarea,
  useQuery,
  useQueryClient,
  useValue
} from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import { AgentActions, BudgetMeter, Sparkline, STATUS_TONE, statusOf } from './agents-view'
import {
  $agentFile,
  $boardSlug,
  activityKey,
  agentFileKey,
  fetchActivity,
  fetchAgentFile,
  profilesKey,
  saveAgentInstructions,
  saveProfileDescription,
  saveProfileOrg,
  useKanbanScope
} from './api'
import { useControls } from './inbox'
import { canReportTo } from './org-model'
import { useOrgMove, useRoster } from './org-view'
import { teamRows } from './overview-model'
import type { AgentControl, AgentFile, KanbanBoard, KanbanProfile } from './types'
import { ago, Avatar, columnLabel, duration, errText, FIELD_LABEL, type KanbanText, useKanban } from './ui'

type Tab = 'instructions' | 'overview' | 'schedule' | 'work'

const OUTCOME_TONE: Record<string, string> = {
  blocked: '#fb923c',
  completed: '#34d399',
  crashed: '#f87171',
  gave_up: '#f87171',
  running: '#60a5fa',
  spawn_failed: '#f87171',
  timed_out: '#f87171'
}

const TILE = 'flex min-w-0 flex-col gap-1.5 rounded-lg bg-(--ui-bg-quinary) p-3'

const rateTone = (rate: number) => (rate >= 80 ? '#34d399' : rate >= 50 ? '#fbbf24' : '#f87171')

/** Seconds as the owner reads a run: "42s", "6m", "1h 20m". */
function runLength(seconds: null | number): string {
  if (seconds === null) {
    return '—'
  }

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.round(seconds / 60)

  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function SuccessRing({ rate }: { rate: null | number }) {
  const radius = 15
  const circumference = 2 * Math.PI * radius
  const tone = rate === null ? 'var(--ui-text-quaternary)' : rateTone(rate)

  return (
    <span className="flex items-center gap-2.5">
      <svg aria-hidden className="size-11 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" fill="none" r={radius} stroke="var(--ui-bg-quaternary)" strokeWidth="4" />
        {rate !== null && (
          <circle
            cx="18"
            cy="18"
            fill="none"
            r={radius}
            stroke={tone}
            strokeDasharray={`${(rate / 100) * circumference} ${circumference}`}
            strokeLinecap="round"
            strokeWidth="4"
          />
        )}
      </svg>
      <span className="text-xl font-semibold tabular-nums text-foreground">{rate === null ? '—' : `${Math.round(rate)}%`}</span>
    </span>
  )
}

function Tile({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={TILE}>
      <div className={FIELD_LABEL}>{label}</div>
      {children}
    </div>
  )
}

/** Completed / failed / blocked over the window, as one split bar with the counts under it. */
function RunSplit({ file, k }: { file: AgentFile; k: KanbanText }) {
  const parts = [
    ['completed', file.stats.completed, '#34d399'],
    ['failed', file.stats.failed, '#f87171'],
    ['blocked', file.stats.blocked, '#fb923c']
  ] as const

  const total = parts.reduce((sum, [, n]) => sum + n, 0)

  return (
    <>
      <div className="text-xl font-semibold tabular-nums text-foreground">{total}</div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-(--ui-bg-quaternary)">
        {total > 0 &&
          parts.map(([key, n, tone]) => <span key={key} style={{ backgroundColor: tone, width: `${(n / total) * 100}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-2 text-[0.625rem] text-(--ui-text-tertiary)">
        {parts.map(([key, n, tone]) => (
          <span className="inline-flex items-center gap-1" key={key}>
            <span className="size-1.5 rounded-full" style={{ backgroundColor: tone }} />
            {n} {k.overview.outcomes[key]}
          </span>
        ))}
      </div>
    </>
  )
}

function AboutField({ k, profile }: { k: KanbanText; profile: KanbanProfile }) {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const [draft, setDraft] = useState(profile.description)
  const changed = draft.trim() !== profile.description.trim()

  const save = async () => {
    try {
      await saveProfileDescription(profile.name, draft.trim())
      host.notify({ kind: 'success', message: k.file.saved })
      void qc.invalidateQueries({ queryKey: profilesKey(scope) })
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })
    }
  }

  return (
    <section className="flex flex-col gap-1.5">
      <div className={FIELD_LABEL}>{k.file.about}</div>
      <Textarea
        className="min-h-16 text-[0.8125rem]"
        onChange={event => setDraft(event.target.value)}
        placeholder={k.file.aboutPlaceholder}
        value={draft}
      />
      {changed && (
        <div className="flex justify-end gap-1.5">
          <Button onClick={() => setDraft(profile.description)} size="sm" variant="ghost">
            {k.file.undo}
          </Button>
          <Button onClick={() => void save()} size="sm">
            {k.file.save}
          </Button>
        </div>
      )}
    </section>
  )
}

function OverviewTab({
  agent,
  file,
  k,
  profile,
  runs
}: {
  agent?: AgentControl
  file: AgentFile
  k: KanbanText
  profile: KanbanProfile
  runs: number[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Tile label={k.file.successRate}>
          <SuccessRing rate={file.stats.success_rate} />
        </Tile>
        <Tile label={k.file.runsWindow(file.window_days)}>
          <RunSplit file={file} k={k} />
        </Tile>
        <Tile label={k.file.typicalRun}>
          <div className="text-xl font-semibold tabular-nums text-foreground">{runLength(file.stats.median_seconds)}</div>
        </Tile>
        <Tile label={k.file.spentMonth}>{agent ? <BudgetMeter agent={agent} k={k} /> : '—'}</Tile>
      </div>
      <section className="flex flex-col gap-1.5">
        <div className={FIELD_LABEL}>{k.file.activity14}</div>
        <Sparkline color={STATUS_TONE.working} height="h-14" values={runs} />
      </section>
      <AboutField k={k} key={profile.description} profile={profile} />
      <section className="flex flex-col gap-1.5">
        <div className={FIELD_LABEL}>{k.file.tools}</div>
        <div className="flex flex-wrap gap-1.5 text-[0.6875rem]">
          {(file.toolsets ?? [k.file.standardTools]).map(name => (
            <span className="rounded-md bg-(--ui-bg-quaternary) px-1.5 py-0.5 text-(--ui-text-secondary)" key={name}>
              {name}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

function WorkTab({ file, k, onOpen }: { file: AgentFile; k: KanbanText; onOpen: (id: string) => void }) {
  const open = Object.entries(file.open_cards)

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1.5">
        <div className={FIELD_LABEL}>{k.file.openCards}</div>
        {open.length ? (
          <div className="flex flex-wrap gap-1.5">
            {open.map(([status, n]) => (
              <span className="rounded-md bg-(--ui-bg-quinary) px-2 py-1 text-[0.75rem]" key={status}>
                <span className="font-semibold tabular-nums text-foreground">{n}</span>{' '}
                <span className="text-(--ui-text-tertiary)">{columnLabel(k, status)}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[0.75rem] text-(--ui-text-quaternary)">{k.file.noOpenCards}</p>
        )}
      </section>
      <section className="flex flex-col gap-1">
        <div className={FIELD_LABEL}>{k.file.history}</div>
        {file.runs.length ? (
          <ul className="flex flex-col">
            {file.runs.map(run => (
              <li key={run.id}>
                <button
                  className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-(--ui-bg-quinary)"
                  onClick={() => onOpen(run.task_id)}
                  type="button"
                >
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: OUTCOME_TONE[run.outcome] ?? 'var(--ui-text-quaternary)' }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] text-foreground">{run.task_title}</span>
                    {run.note && <span className="block truncate text-[0.6875rem] text-(--ui-text-tertiary)">{run.note}</span>}
                  </span>
                  <span className="shrink-0 text-right text-[0.6875rem] tabular-nums text-(--ui-text-quaternary)">
                    {run.ended_at ? ago(run.ended_at) : k.file.running}
                    <span className="block">{duration(run.started_at, run.ended_at ?? file.now)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.75rem] text-(--ui-text-quaternary)">{k.file.noRuns}</p>
        )}
      </section>
    </div>
  )
}

const when = (iso: null | string) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null

function ScheduleTab({ file, k }: { file: AgentFile; k: KanbanText }) {
  if (!file.schedule.length) {
    return <p className="text-[0.75rem] text-(--ui-text-quaternary)">{k.file.noSchedule}</p>
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {file.schedule.map(job => (
        <li className="flex items-center gap-3 rounded-lg bg-(--ui-bg-quinary) px-3 py-2" key={job.id || job.name}>
          <Codicon className="text-(--ui-text-tertiary)" name="watch" size="0.9rem" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] font-medium text-foreground">{job.name}</span>
            <span className="block truncate text-[0.6875rem] text-(--ui-text-tertiary)">{job.schedule}</span>
          </span>
          <span className="shrink-0 text-right text-[0.6875rem] text-(--ui-text-tertiary)">
            {job.enabled ? (job.next_run_at ? k.file.nextRun(when(job.next_run_at)!) : '') : k.file.off}
          </span>
        </li>
      ))}
    </ul>
  )
}

function InstructionsTab({ file, k, name }: { file: AgentFile; k: KanbanText; name: string }) {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const [draft, setDraft] = useState(file.instructions)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)

    try {
      await saveAgentInstructions(name, draft)
      host.notify({ kind: 'success', message: k.file.saved })
      void qc.invalidateQueries({ queryKey: agentFileKey(scope, slug, name) })
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })
    }

    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.75rem] text-(--ui-text-tertiary)">{k.file.instructionsHint}</p>
      <Textarea
        className="min-h-72 font-mono text-[0.75rem] leading-relaxed"
        onChange={event => setDraft(event.target.value)}
        value={draft}
      />
      <div className="flex justify-end gap-1.5">
        <Button disabled={draft === file.instructions} onClick={() => setDraft(file.instructions)} size="sm" variant="ghost">
          {k.file.undo}
        </Button>
        <Button disabled={saving || draft === file.instructions} onClick={() => void save()} size="sm">
          {k.file.save}
        </Button>
      </div>
    </div>
  )
}

function TitleField({ k, profile }: { k: KanbanText; profile: KanbanProfile }) {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const [draft, setDraft] = useState(profile.title ?? '')

  const commit = async () => {
    if (draft.trim() === (profile.title ?? '')) {
      return
    }

    try {
      await saveProfileOrg(profile.name, { title: draft.trim() })
      void qc.invalidateQueries({ queryKey: profilesKey(scope) })
    } catch (error) {
      setDraft(profile.title ?? '')
      host.notify({ kind: 'error', message: errText(error) })
    }
  }

  return (
    <Input
      aria-label={k.file.titleLabel}
      className="h-7 max-w-64 text-[0.8125rem]"
      maxLength={60}
      onBlur={() => void commit()}
      onChange={event => setDraft(event.target.value)}
      onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()}
      placeholder={k.file.titlePlaceholder}
      value={draft}
    />
  )
}

function ManagerMenu({ k, profile, roster }: { k: KanbanText; profile: KanbanProfile; roster: KanbanProfile[] }) {
  const move = useOrgMove()
  const boss = profile.reports_to ?? ''
  const options = roster.filter(other => other.name !== boss && canReportTo(roster, profile.name, other.name))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          {boss ? <Avatar name={boss} size="1rem" /> : <Codicon name="arrow-up" size="0.8rem" />}
          {boss || k.file.nobody}
          <Codicon name="chevron-down" size="0.7rem" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {boss && (
          <>
            <DropdownMenuItem onSelect={() => void move(profile.name, '')}>
              <Codicon name="arrow-up" size="0.8rem" />
              {k.file.nobody}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.map(other => (
          <DropdownMenuItem key={other.name} onSelect={() => void move(profile.name, other.name)}>
            <Avatar name={other.name} size="0.875rem" />
            {other.name}
            {other.title && <span className="text-(--ui-text-tertiary)">· {other.title}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Header({
  agent,
  board,
  k,
  profile,
  roster
}: {
  agent?: AgentControl
  board: KanbanBoard
  k: KanbanText
  profile: KanbanProfile
  roster: KanbanProfile[]
}) {
  const { data: controls } = useControls()
  const row = teamRows(board).find(item => item.name === profile.name)
  const status = agent ? statusOf(agent, row, !!controls?.all_paused) : row?.running ? 'working' : 'idle'

  return (
    <header className="flex flex-col gap-3 px-5 pt-5 pb-3">
      <div className="flex items-start gap-3">
        <Avatar name={profile.name} size="3rem" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <DialogTitle className="truncate text-lg font-semibold">{profile.name}</DialogTitle>
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[0.625rem] font-medium"
              style={{ backgroundColor: `color-mix(in srgb, ${STATUS_TONE[status]} 14%, transparent)`, color: STATUS_TONE[status] }}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: STATUS_TONE[status] }} />
              {k.agents.status[status]}
            </span>
          </div>
          <TitleField k={k} key={profile.title ?? ''} profile={profile} />
        </div>
        <Button aria-label={k.inbox.cancel} onClick={() => $agentFile.set(null)} size="icon-xs" variant="ghost">
          <Codicon name="close" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.75rem] text-(--ui-text-tertiary)">
        <span className="inline-flex items-center gap-1.5">
          {k.file.reportsTo}
          <ManagerMenu k={k} profile={profile} roster={roster} />
        </span>
        {(profile.reports ?? []).length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            {k.file.directReports}
            {(profile.reports ?? []).map(name => (
              <button
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-(--ui-bg-quinary) py-0.5 pr-2 pl-0.5 text-foreground hover:bg-(--ui-bg-quaternary)"
                key={name}
                onClick={() => $agentFile.set(name)}
                type="button"
              >
                <Avatar name={name} size="1.1rem" />
                {name}
              </button>
            ))}
          </span>
        )}
        {profile.model && (
          <span className="inline-flex items-center gap-1">
            <Codicon name="sparkle" size="0.75rem" />
            {profile.model}
          </span>
        )}
        <span>{k.file.skills(profile.skill_count ?? 0)}</span>
      </div>
      {agent && (
        <div className="-mx-1 flex flex-wrap items-center gap-1">
          <AgentActions agent={agent} k={k} running={row?.running ?? 0} status={status} />
        </div>
      )}
    </header>
  )
}

function Body({
  agent,
  file,
  k,
  name,
  onOpen,
  profile,
  runs
}: {
  agent?: AgentControl
  file?: AgentFile
  k: KanbanText
  name: string
  onOpen: (id: string) => void
  profile: KanbanProfile
  runs: number[]
}) {
  const [tab, setTab] = useState<Tab>('overview')

  if (!file) {
    return <div className="grid h-40 place-items-center text-[0.75rem] text-(--ui-text-quaternary)">…</div>
  }

  const tabs: Record<Tab, ReactNode> = {
    instructions: <InstructionsTab file={file} k={k} key={file.instructions} name={name} />,
    overview: <OverviewTab agent={agent} file={file} k={k} profile={profile} runs={runs} />,
    schedule: <ScheduleTab file={file} k={k} />,
    work: <WorkTab file={file} k={k} onOpen={onOpen} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5">
      <SegmentedControl<Tab>
        onChange={setTab}
        options={(['overview', 'work', 'schedule', 'instructions'] as const).map(id => ({ id, label: k.file.tabs[id] }))}
        value={tab}
      />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{tabs[tab]}</div>
    </div>
  )
}

/** The open agent's file, as a dialog over the team views; Esc or the close icon puts it away. */
export function AgentFileDialog({ board, onOpen }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const k = useKanban()
  const name = useValue($agentFile)
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const { data: roster } = useRoster()
  const { data: controls } = useControls()

  const { data: file, error } = useQuery({
    enabled: !!name,
    queryFn: () => fetchAgentFile(name!),
    queryKey: agentFileKey(scope, slug, name ?? ''),
    refetchInterval: 30_000
  })

  const { data: activity } = useQuery({ queryFn: fetchActivity, queryKey: activityKey(scope, slug), staleTime: 30_000 })
  const profile = roster?.profiles.find(item => item.name === name)

  if (!name || !profile || !roster) {
    return null
  }

  const agent = controls?.agents.find(item => item.profile === name)
  const runs = activity?.by_profile?.[name] ?? Array.from({ length: activity?.days.length ?? 14 }, () => 0)

  return (
    <Dialog onOpenChange={open => !open && $agentFile.set(null)} open>
      <DialogContent
        aria-describedby={undefined}
        bodyClassName="flex max-h-[min(86vh,52rem)] flex-col gap-0 overflow-hidden p-0"
        className="w-[min(54rem,94vw)] max-w-none"
        data-agent-file={name}
        // The first field is the title: focusing it on open would put a stray keystroke into it.
        onOpenAutoFocus={event => event.preventDefault()}
        showCloseButton={false}
      >
        <Header agent={agent} board={board} k={k} key={`header:${name}`} profile={profile} roster={roster.profiles} />
        {error ? (
          <p className={cn('px-5 pb-5 text-[0.8125rem] text-destructive')}>{k.file.loadFailed}</p>
        ) : (
          <Body
            agent={agent}
            file={file}
            k={k}
            key={`body:${name}`}
            name={name}
            onOpen={id => {
              $agentFile.set(null)
              onOpen(id)
            }}
            profile={profile}
            runs={runs}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
