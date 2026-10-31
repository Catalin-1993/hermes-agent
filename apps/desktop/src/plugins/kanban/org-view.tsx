/**
 * The team's org chart, shared by both looks of the Agents page: the roster, moving an agent under another manager
 * (painted at once, rolled back if refused), and the drag-onto-a-card handlers of the card grid. The chart itself is
 * drawn by `org-canvas`. It lives in each profile's `profile.yaml`, so it is the same on every board; the decomposer
 * and every worker read it.
 */

import { host, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { type DragEvent, useState } from 'react'

import { fetchProfiles, profilesKey, saveProfileOrg, useKanbanScope } from './api'
import { MemberCard, type MemberProps } from './member-card'
import { canReportTo, moveInChart } from './org-model'
import type { KanbanProfile } from './types'
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

/** Drop-target handlers for a card or the owner (`''`): where an agent dragged from the grid or from "Not placed
 *  yet" lands. */
export function dropTarget(chart: ChartState, target: string) {
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

export function useDragState() {
  const [dragging, setDragging] = useState<null | string>(null)
  const [over, setOver] = useState<null | string>(null)

  return { dragging, over, setDragging, setOver }
}

export type { KanbanText }
