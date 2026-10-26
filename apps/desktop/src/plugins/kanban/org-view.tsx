/**
 * The Org chart view: who leads whom, drawn as a tree of agent cards. Drag a card onto another to
 * make it report there (or onto the top strip to make it a top of the team); click one to open its
 * file. Agents with no manager and no reports wait in "Not placed yet". The chart lives in each
 * profile's `profile.yaml`, so it is the same on every board; the decomposer and every worker read it.
 */

import { cn, Codicon, host, useQuery, useQueryClient, useValue } from '@hermes/plugin-sdk'
import { type DragEvent, useState } from 'react'

import { AGENT_PALETTE, chartColors, Sparkline, type Status, STATUS_TONE, statusOf } from './agents-view'
import {
  $agentFile,
  $boardSlug,
  $boardView,
  activityKey,
  fetchActivity,
  fetchProfiles,
  profilesKey,
  saveProfileOrg,
  useKanbanScope
} from './api'
import { useControls, useInboxCount } from './inbox'
import { ORG } from './org-copy'
import {
  type AgentWork,
  agentWork,
  canReportTo,
  moveInChart,
  type OrgLevel,
  orgLevels,
  type OrgNode,
  orgTree
} from './org-model'
import { teamRows } from './overview-model'
import { TeamGalleryButton } from './team-gallery'
import type { KanbanBoard, KanbanProfile } from './types'
import { ago, Avatar, errText, type KanbanText, useKanban } from './ui'

/** The roster with its org fields, shared by the chart and the agent file. */
export function useRoster() {
  const scope = useKanbanScope()

  return useQuery({ queryFn: fetchProfiles, queryKey: profilesKey(scope), staleTime: 60_000 })
}

/** Move `name` under `manager` (`''` = to the top): painted at once, rolled back with a toast if refused. */
export function useOrgMove() {
  const k = useKanban()
  const qc = useQueryClient()
  const key = profilesKey(useKanbanScope())

  return async (name: string, manager: string) => {
    const before = qc.getQueryData<{ profiles: KanbanProfile[] }>(key)

    if (before) {
      qc.setQueryData(key, { profiles: moveInChart(before.profiles, name, manager) })
    }

    try {
      await saveProfileOrg(name, { reports_to: manager })
      host.notify({ kind: 'success', message: manager ? k.org.moved(name, manager) : k.org.movedTop(name) })
    } catch (error) {
      if (before) {
        qc.setQueryData(key, before)
      }

      host.notify({ kind: 'error', message: errText(error) })
    }

    void qc.invalidateQueries({ queryKey: key })
  }
}

interface ChartState {
  color: (name: string) => string
  dragging: null | string
  level: (name: string) => OrgLevel | undefined
  over: null | string
  profiles: KanbanProfile[]
  runs: (name: string) => number[]
  setDragging: (name: null | string) => void
  setOver: (name: null | string) => void
  status: (name: string) => Status
  work: (name: string) => AgentWork
  move: (name: string, manager: string) => void
}

/** Whether the card being dragged may land on `target` (`''` = the top strip). */
const accepts = (chart: ChartState, target: string) => {
  const dragged = chart.profiles.find(profile => profile.name === chart.dragging)

  return (
    !!dragged &&
    dragged.name !== target &&
    (dragged.reports_to ?? '') !== target &&
    canReportTo(chart.profiles, dragged.name, target)
  )
}

/** Drop-target handlers for a card or the top strip. */
function dropTarget(chart: ChartState, target: string) {
  return {
    onDragLeave: () => chart.over === target && chart.setOver(null),
    onDragOver: (event: DragEvent) => {
      if (accepts(chart, target)) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        chart.over !== target && chart.setOver(target)
      }
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault()

      if (chart.dragging && accepts(chart, target)) {
        chart.move(chart.dragging, target)
      }

      chart.setOver(null)
      chart.setDragging(null)
    }
  }
}

function OrgCard({ chart, k, profile }: { chart: ChartState; k: KanbanText; profile: KanbanProfile }) {
  const status = chart.status(profile.name)
  const runs = chart.runs(profile.name)
  const total = runs.reduce((sum, value) => sum + value, 0)
  const color = chart.color(profile.name)
  const isOver = chart.over === profile.name
  const level = chart.level(profile.name)
  const work = chart.work(profile.name)

  return (
    <button
      className={cn(
        'flex w-64 cursor-pointer flex-col gap-2.5 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3 text-left transition-[box-shadow,opacity,border-color] hover:border-(--ui-stroke-secondary)',
        chart.dragging === profile.name && 'opacity-50',
        isOver && 'border-transparent'
      )}
      data-org-card={profile.name}
      draggable
      onClick={() => $agentFile.set(profile.name)}
      onDragEnd={() => {
        chart.setDragging(null)
        chart.setOver(null)
      }}
      onDragStart={event => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', profile.name)
        chart.setDragging(profile.name)
      }}
      style={{
        borderTopColor: color,
        borderTopWidth: 3,
        boxShadow: isOver ? `0 0 0 2px ${color}` : undefined
      }}
      type="button"
      {...dropTarget(chart, profile.name)}
    >
      <span className="flex items-center gap-2.5">
        <span className="relative shrink-0">
          <Avatar name={profile.name} size="2.25rem" />
          <span
            aria-hidden
            className={cn(
              'absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-(--ui-bg-elevated)',
              status === 'working' && 'animate-pulse'
            )}
            style={{ backgroundColor: STATUS_TONE[status] }}
          />
        </span>
        <span className="min-w-0 flex-1">
          {level && (
            <span className="block text-[0.5625rem] font-semibold tracking-[0.08em] uppercase" style={{ color }}>
              {ORG.level[level]}
            </span>
          )}
          <span className="block truncate text-[0.875rem] font-semibold text-foreground">{profile.name}</span>
          <span
            className={cn(
              'block truncate text-[0.75rem]',
              profile.title ? 'text-(--ui-text-secondary)' : 'italic text-(--ui-text-quaternary)'
            )}
          >
            {profile.title || k.org.noTitle}
          </span>
        </span>
      </span>
      <span className="flex flex-col gap-1 border-t border-(--ui-stroke-tertiary) pt-2 text-[0.6875rem]">
        <span className="flex gap-1.5">
          <span className="w-[4.5rem] shrink-0 text-(--ui-text-quaternary)">{ORG.workingOn}</span>
          <span className={cn('min-w-0 truncate', work.working ? 'text-foreground' : 'text-(--ui-text-quaternary)')}>
            {work.working?.title ?? ORG.nothingRunning}
          </span>
        </span>
        <span className="flex gap-1.5">
          <span className="w-[4.5rem] shrink-0 text-(--ui-text-quaternary)">{ORG.lastFinished}</span>
          <span
            className={cn('min-w-0 truncate', work.last ? 'text-(--ui-text-secondary)' : 'text-(--ui-text-quaternary)')}
          >
            {work.last ? `${work.last.title}${work.last.at ? ` · ${ago(work.last.at)}` : ''}` : ORG.nothingYet}
          </span>
        </span>
      </span>
      <span className="flex items-end justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-[0.625rem] font-medium" style={{ color: STATUS_TONE[status] }}>
            {k.agents.status[status]}
          </span>
          <span className="text-[0.625rem] tabular-nums text-(--ui-text-quaternary)">{k.org.runs(total)}</span>
        </span>
        <span className="w-20">
          <Sparkline color={color} height="h-5" values={runs} />
        </span>
      </span>
    </button>
  )
}

/** The owner at the top of the chart: the CEO. Dropping a card here makes it a top of the team. */
function CeoCard({ board, chart }: { board: KanbanBoard; chart: ChartState }) {
  const waiting = useInboxCount(board)
  const isOver = chart.over === ''

  return (
    <button
      className={cn(
        'flex w-64 cursor-pointer items-center gap-2.5 rounded-lg border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) p-3 text-left transition-[box-shadow,border-color] hover:border-(--ui-text-tertiary)',
        isOver && 'border-transparent'
      )}
      data-org-ceo=""
      onClick={() => $boardView.set('inbox')}
      style={{ boxShadow: isOver ? '0 0 0 2px var(--ui-text-secondary)' : undefined }}
      type="button"
      {...dropTarget(chart, '')}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-(--ui-control-active-background) text-foreground">
        <Codicon name="account" size="1.1rem" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.5625rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
          {ORG.ceo.level}
        </span>
        <span className="block text-[0.875rem] font-semibold text-foreground">{ORG.ceo.name}</span>
        <span
          className={cn('block text-[0.75rem]', waiting ? 'text-(--ui-text-secondary)' : 'text-(--ui-text-quaternary)')}
        >
          {ORG.ceo.waiting(waiting)}
        </span>
      </span>
    </button>
  )
}

function Branch({ chart, k, node }: { chart: ChartState; k: KanbanText; node: OrgNode }) {
  return (
    <li>
      <OrgCard chart={chart} k={k} profile={node.profile} />
      {node.reports.length > 0 && (
        <ul>
          {node.reports.map(report => (
            <Branch chart={chart} k={k} key={report.profile.name} node={report} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** The strip a card is dropped on to become a top. Always laid out, so a drag never shifts the page. */
function TopZone({ chart, k }: { chart: ChartState; k: KanbanText }) {
  const live = !!chart.dragging && accepts(chart, '')

  return (
    <div
      aria-hidden={!live}
      className={cn(
        'flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 sm:w-72 text-[0.75rem] transition-opacity',
        live ? 'opacity-100' : 'pointer-events-none opacity-0',
        chart.over === ''
          ? 'border-(--ui-text-secondary) text-foreground'
          : 'border-(--ui-stroke-secondary) text-(--ui-text-tertiary)'
      )}
      {...dropTarget(chart, '')}
    >
      <Codicon name="arrow-up" size="0.8rem" />
      {k.org.topZone}
    </div>
  )
}

export function BoardOrg({ board }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const k = useKanban()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const { data: roster } = useRoster()
  const { data: controls } = useControls()
  const move = useOrgMove()
  const [dragging, setDragging] = useState<null | string>(null)
  const [over, setOver] = useState<null | string>(null)

  const { data: activity } = useQuery({
    queryFn: fetchActivity,
    queryKey: activityKey(scope, slug),
    refetchInterval: 30_000
  })

  if (!roster) {
    return <div className="grid flex-1 place-items-center text-[0.75rem] text-(--ui-text-quaternary)">…</div>
  }

  const profiles = roster.profiles
  const rows = new Map(teamRows(board).map(row => [row.name, row]))
  const agents = new Map((controls?.agents ?? []).map(agent => [agent.profile, agent]))
  const colors = chartColors(controls?.agents ?? [])
  const days = activity?.days.length ?? 14
  const { loose, trees } = orgTree(profiles)
  const levels = orgLevels(trees)
  const events = activity?.events ?? []

  const chart: ChartState = {
    color: name => colors.get(name) ?? AGENT_PALETTE[0],
    dragging,
    move: (name, manager) => void move(name, manager),
    level: name => levels.get(name),
    over,
    profiles,
    runs: name => activity?.by_profile?.[name] ?? Array.from({ length: days }, () => 0),
    setDragging,
    setOver,
    work: name => agentWork(board, events, name),
    status: name => {
      const agent = agents.get(name)

      return agent
        ? statusOf(agent, rows.get(name), !!controls?.all_paused)
        : (rows.get(name)?.running ?? 0) > 0
          ? 'working'
          : 'idle'
    }
  }

  if (!profiles.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{k.org.empty}</p>
        <TeamGalleryButton cta />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4" data-kanban-org="">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.75rem] text-(--ui-text-tertiary)">{k.org.subtitle(profiles.length)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <TopZone chart={chart} k={k} />
          <TeamGalleryButton />
        </div>
      </div>
      {trees.length > 0 && (
        <section className="kanban-org overflow-x-auto rounded-lg bg-(--ui-bg-quinary) px-4 py-6">
          <ul>
            <li>
              <CeoCard board={board} chart={chart} />
              <ul>
                {trees.map(node => (
                  <Branch chart={chart} k={k} key={node.profile.name} node={node} />
                ))}
              </ul>
            </li>
          </ul>
        </section>
      )}
      {loose.length > 0 && (
        <section className="flex flex-col gap-2">
          <div>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-(--ui-text-tertiary)">
              {k.org.looseTitle}
            </div>
            <div className="text-[0.6875rem] text-(--ui-text-quaternary)">{k.org.looseHint}</div>
          </div>
          <div className="flex flex-wrap gap-3">
            {loose.map(profile => (
              <OrgCard chart={chart} k={k} key={profile.name} profile={profile} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
