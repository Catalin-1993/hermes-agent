/**
 * The hierarchy half of the Team page: who leads whom, drawn as a tree of agent cards under the owner (the CEO).
 * Drag a card onto another to make it report there (or onto the CEO to make it a top of the team); the card's ⋯
 * menu does the same without dragging. The chart lives in each profile's `profile.yaml`, so it is the same on
 * every board; the decomposer and every worker read it.
 */

import { cn, Codicon, host, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { type DragEvent, useState } from 'react'

import { $boardView, fetchProfiles, profilesKey, saveProfileOrg, useKanbanScope } from './api'
import { useInboxCount } from './inbox'
import { MemberCard, type MemberProps } from './member-card'
import { ORG } from './org-copy'
import { canReportTo, moveInChart, type OrgNode, stacks } from './org-model'
import type { KanbanBoard, KanbanProfile } from './types'
import { errText, type KanbanText, useKanban } from './ui'

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

/** What every card needs that does not depend on dragging: the page builds it once per agent. */
export type MemberBase = Omit<MemberProps, 'dnd' | 'dragging' | 'highlight'>

export interface ChartState {
  dragging: null | string
  member: (profile: KanbanProfile) => MemberBase
  move: (name: string, manager: string) => void
  over: null | string
  profiles: KanbanProfile[]
  setDragging: (name: null | string) => void
  setOver: (name: null | string) => void
}

/** Whether the card being dragged may land on `target` (`''` = the owner at the top). */
const accepts = (chart: ChartState, target: string) => {
  const dragged = chart.profiles.find(profile => profile.name === chart.dragging)

  return (
    !!dragged &&
    dragged.name !== target &&
    (dragged.reports_to ?? '') !== target &&
    canReportTo(chart.profiles, dragged.name, target)
  )
}

/** Drop-target handlers for a card or the owner. */
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

/** One agent's card with the chart's drag-and-drop on it. */
export function ChartMember({ chart, profile }: { chart: ChartState; profile: KanbanProfile }) {
  const base = chart.member(profile)

  return (
    <MemberCard
      {...base}
      dnd={{
        draggable: true,
        onDragEnd: () => {
          chart.setDragging(null)
          chart.setOver(null)
        },
        onDragStart: event => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', profile.name)
          chart.setDragging(profile.name)
        },
        ...dropTarget(chart, profile.name)
      }}
      dragging={chart.dragging === profile.name}
      highlight={chart.over === profile.name}
    />
  )
}

/** The owner at the top of the chart: the CEO. Dropping a card here makes it a top of the team. */
function CeoCard({ board, chart }: { board: KanbanBoard; chart: ChartState }) {
  const waiting = useInboxCount(board)
  const isOver = chart.over === ''

  return (
    <button
      className={cn(
        'flex w-72 cursor-pointer items-center gap-3 rounded-2xl border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) p-3.5 text-left transition-[box-shadow,border-color] hover:border-(--ui-text-tertiary)',
        isOver && 'border-transparent'
      )}
      data-org-ceo=""
      onClick={() => $boardView.set('inbox')}
      style={{ boxShadow: isOver ? '0 0 0 2px var(--ui-text-secondary)' : undefined }}
      type="button"
      {...dropTarget(chart, '')}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-(--ui-control-active-background) text-foreground">
        <Codicon name="account" size="1.25rem" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.625rem] font-semibold tracking-[0.1em] text-(--ui-text-tertiary) uppercase">
          {ORG.ceo.level}
        </span>
        <span className="block text-[1rem] font-semibold text-foreground">{ORG.ceo.name}</span>
        <span
          className={cn(
            'block text-[0.8125rem]',
            waiting ? 'text-(--ui-text-secondary)' : 'text-(--ui-text-quaternary)'
          )}
        >
          {ORG.ceo.waiting(waiting)}
        </span>
      </span>
    </button>
  )
}

function Branch({ chart, node }: { chart: ChartState; node: OrgNode }) {
  return (
    <li>
      <ChartMember chart={chart} profile={node.profile} />
      {node.reports.length > 0 && (
        <ul className={stacks(node) ? 'kanban-org-stack' : undefined} data-cols={node.reports.length >= 4 ? 2 : 1}>
          {node.reports.map(report => (
            <Branch chart={chart} key={report.profile.name} node={report} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** The tree under the CEO. The page decides the zoom; this only draws. */
export function ChartTree({ board, chart, trees }: { board: KanbanBoard; chart: ChartState; trees: OrgNode[] }) {
  return (
    <ul>
      <li>
        <CeoCard board={board} chart={chart} />
        <ul>
          {trees.map(node => (
            <Branch chart={chart} key={node.profile.name} node={node} />
          ))}
        </ul>
      </li>
    </ul>
  )
}

export function useDragState() {
  const [dragging, setDragging] = useState<null | string>(null)
  const [over, setOver] = useState<null | string>(null)

  return { dragging, over, setDragging, setOver }
}

export type { KanbanText }
