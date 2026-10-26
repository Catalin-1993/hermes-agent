/** What the Dashboard and Projects show, derived from the boards the Kanban API already returns. Pure, so it is tested.
 *  A "project" here is a Kanban board: it has its own cards, agents, goals and activity. Nothing is made up — a
 *  number the API does not give is left out by the caller. */

import { needsYou } from './overview-model'
import type { ActivityEvent, BoardGoal, BoardMeta, KanbanActivity, KanbanBoard, KanbanTask } from './types'

export interface ProjectData {
  activity?: KanbanActivity
  board?: KanbanBoard
  goals?: BoardGoal[]
  meta: BoardMeta
}

export type ProjectState = 'blocked' | 'done' | 'empty' | 'idle' | 'running'

export interface ProjectStats {
  blocked: number
  done: number
  needs: KanbanTask[]
  /** Share of cards finished, 0–100. */
  percent: number
  review: number
  running: KanbanTask[]
  state: ProjectState
  total: number
}

const live = (board: KanbanBoard) =>
  board.columns.filter(column => column.name !== 'archived').flatMap(column => column.tasks)

export function projectStats(board?: KanbanBoard): ProjectStats {
  const tasks = board ? live(board) : []
  const count = (status: string) => tasks.filter(task => task.status === status).length
  const running = tasks.filter(task => task.status === 'running')
  const done = count('done')
  const blocked = count('blocked')
  const total = tasks.length

  const state: ProjectState = !total
    ? 'empty'
    : blocked
      ? 'blocked'
      : running.length
        ? 'running'
        : done === total
          ? 'done'
          : 'idle'

  return {
    blocked,
    done,
    needs: board ? needsYou(board) : [],
    percent: total ? Math.round((done / total) * 100) : 0,
    review: count('review'),
    running,
    state,
    total
  }
}

/** Open work left: the project is still going. */
export const isActive = (stats: ProjectStats) => stats.total - stats.done > 0

export interface Attention {
  project: BoardMeta
  task: KanbanTask
}

/** Everything that waits on the owner, across projects: questions first, then reviews, oldest first. */
export function attentionAcross(projects: readonly ProjectData[]): Attention[] {
  const rank = (task: KanbanTask) => (task.status === 'blocked' ? (task.block_kind === 'needs_input' ? 0 : 1) : 2)

  return projects
    .flatMap(({ board, meta }) => (board ? needsYou(board).map(task => ({ project: meta, task })) : []))
    .sort((a, b) => rank(a.task) - rank(b.task) || (a.task.created_at ?? 0) - (b.task.created_at ?? 0))
}

export interface AgentWork {
  name: string
  /** Cards it is running right now, with their project. */
  running: Attention[]
}

/** The agents running something right now, the busiest first. */
export function agentsAcross(projects: readonly ProjectData[]): AgentWork[] {
  const byName = new Map<string, AgentWork>()

  for (const { board, meta } of projects) {
    for (const task of board ? projectStats(board).running : []) {
      if (task.assignee) {
        const row = byName.get(task.assignee) ?? { name: task.assignee, running: [] }
        row.running.push({ project: meta, task })
        byName.set(task.assignee, row)
      }
    }
  }

  return [...byName.values()].sort((a, b) => b.running.length - a.running.length || a.name.localeCompare(b.name))
}

export interface FeedItem {
  event: ActivityEvent
  project: BoardMeta
}

/** The newest moments of work across projects. */
export function feedAcross(projects: readonly ProjectData[], limit: number): FeedItem[] {
  return projects
    .flatMap(({ activity, meta }) => (activity?.events ?? []).map(event => ({ event, project: meta })))
    .sort((a, b) => b.event.created_at - a.event.created_at)
    .slice(0, limit)
}

export interface RunTotals {
  completed: number
  failed: number
  /** Percent of finished runs that completed; null when none finished (or nothing loaded). */
  successRate: null | number
}

/** The last 14 days' finished runs, summed over the projects whose activity loaded; null when none did. */
export function runTotals(projects: readonly ProjectData[]): null | RunTotals {
  const loaded = projects.flatMap(({ activity }) => (activity ? [activity.totals] : []))

  if (!loaded.length) {
    return null
  }

  const sum = (key: 'blocked' | 'completed' | 'failed' | 'other') => loaded.reduce((n, totals) => n + totals[key], 0)
  const completed = sum('completed')
  const finished = completed + sum('failed') + sum('blocked') + sum('other')

  return { completed, failed: sum('failed'), successRate: finished ? Math.round((completed / finished) * 100) : null }
}

/** The goal the project works toward now: the first active one. */
export const objectiveOf = (goals?: readonly BoardGoal[]) => goals?.find(goal => goal.status === 'active') ?? null

export const projectName = (meta: BoardMeta) => meta.name?.trim() || meta.slug
