/** The Dashboard's and Projects' shared state and reads: which pages are on, which project is open, and every
 *  board's cards, activity and goals fetched through the Kanban API the board page already uses (same cache keys). */

import { atom, host, useQueries, useQuery, useValue } from '@hermes/plugin-sdk'

import {
  $boardSlug,
  $boardView,
  activityKey,
  boardKey,
  boardsKey,
  type BoardView,
  fetchActivityOf,
  fetchBoardOf,
  fetchBoards,
  fetchGoalsOf,
  goalsKey,
  useKanbanScope
} from './api'
import type { ProjectData } from './brain-model'
import type { BoardGoal } from './types'

export interface BrainModules {
  dashboard: boolean
  projects: boolean
}

/** Which Brain pages show in the sidebar. Off only hides: data and backend are untouched. */
export const $brainModules = atom<BrainModules>({ dashboard: true, projects: true })

/** The project open on the Projects page ('' = the list). */
export const $projectSlug = atom<string>('')

/** "+ New Project" pressed in the sidebar: the Projects page opens its dialog on arrival. */
export const $newProjectRequest = atom<boolean>(false)

/** Rows in the owner's order; ids a plugin row registers as `<plugin>:<id>`. Rows that are off simply do not exist. */
export const NAV_ORDER = ['kanban:dashboard', 'new-session', 'cron', 'portfolio:nav', 'artifacts', 'kanban:projects']

export const DASHBOARD_ROUTE = '/dashboard'
export const PROJECTS_ROUTE = '/projects'

export function openProject(slug: string) {
  $projectSlug.set(slug)
  host.navigate(PROJECTS_ROUTE)
}

/** Opens the existing Kanban page on a project's board, at one of its faces. */
export function openKanban(slug: string, view: BoardView) {
  $boardSlug.set(slug)
  $boardView.set(view)
  host.navigate('/kanban')
}

const POLL = 30_000

/** Every project (board) with its cards and 14-day activity, as they load. */
export function useProjects() {
  const scope = useKanbanScope()
  const { data, error, isLoading } = useQuery({ queryFn: fetchBoards, queryKey: boardsKey(scope), staleTime: 30_000 })
  const metas = data?.boards ?? []

  const boards = useQueries({
    queries: metas.map(meta => ({
      queryFn: () => fetchBoardOf(meta.slug),
      queryKey: boardKey(scope, meta.slug, false),
      refetchInterval: 60_000
    }))
  })

  const activities = useQueries({
    queries: metas.map(meta => ({
      queryFn: () => fetchActivityOf(meta.slug),
      queryKey: activityKey(scope, meta.slug),
      refetchInterval: POLL
    }))
  })

  const projects: ProjectData[] = metas.map((meta, index) => ({
    activity: activities[index]?.data,
    board: boards[index]?.data,
    meta
  }))

  return { error: Boolean(error), loading: isLoading, projects }
}

/** Just the names — what the sidebar needs; the cards come with `useProjects`. */
export function useProjectList() {
  const scope = useKanbanScope()

  return useQuery({ queryFn: fetchBoards, queryKey: boardsKey(scope), staleTime: 30_000 }).data?.boards ?? []
}

/** One project's goals; undefined until they load. */
export function useProjectGoals(slug: string): BoardGoal[] | undefined {
  const scope = useKanbanScope()

  return useQuery({ queryFn: () => fetchGoalsOf(slug), queryKey: goalsKey(scope, slug), staleTime: POLL }).data?.goals
}

export const useBrainModules = () => useValue($brainModules)
