/** The org chart as trees, and the rules for moving an agent in it. Pure, so they are tested. */

import type { ActivityEvent, KanbanBoard, KanbanProfile } from './types'

export interface OrgNode {
  profile: KanbanProfile
  reports: OrgNode[]
}

const byName = (a: KanbanProfile, b: KanbanProfile) => a.name.localeCompare(b.name)

/**
 * `trees`: every agent that leads someone, or reports to someone, under its top (managers with
 * reports first, then by name). `loose`: agents not placed yet — no manager and no reports.
 * The backend already followed renames and cut loops; a manager missing from the list makes
 * its report a top.
 */
export function orgTree(profiles: KanbanProfile[]): { loose: KanbanProfile[]; trees: OrgNode[] } {
  const nodes = new Map(profiles.map(profile => [profile.name, { profile, reports: [] as OrgNode[] }]))
  const tops: OrgNode[] = []

  for (const profile of [...profiles].sort(byName)) {
    const node = nodes.get(profile.name)!
    const boss = profile.reports_to ? nodes.get(profile.reports_to) : undefined

    if (boss && boss !== node) {
      boss.reports.push(node)
    } else {
      tops.push(node)
    }
  }

  const trees = tops.filter(node => node.reports.length > 0)
  trees.sort((a, b) => b.reports.length - a.reports.length || byName(a.profile, b.profile))

  return { loose: tops.filter(node => node.reports.length === 0).map(node => node.profile), trees }
}

/** Whether `name` may report to `manager` (`''` = to nobody): never itself, never someone below it. */
export function canReportTo(profiles: KanbanProfile[], name: string, manager: string): boolean {
  if (!manager) {
    return true
  }

  const bosses = new Map(profiles.map(profile => [profile.name, profile.reports_to ?? '']))

  if (manager === name || !bosses.has(manager)) {
    return false
  }

  const seen = new Set<string>()

  for (let node = manager; node && !seen.has(node); node = bosses.get(node) ?? '') {
    if (node === name) {
      return false
    }

    seen.add(node)
  }

  return true
}

/** The roster with `name` moved under `manager` (reports lists recomputed) — the optimistic paint. */
export function moveInChart(profiles: KanbanProfile[], name: string, manager: string): KanbanProfile[] {
  const moved = profiles.map(profile => (profile.name === name ? { ...profile, reports_to: manager } : profile))

  return moved.map(profile => ({
    ...profile,
    reports: moved
      .filter(other => other.reports_to === profile.name)
      .map(other => other.name)
      .sort()
  }))
}

/** Where an agent sits under the owner (the CEO): the top of a team, a lead with people under them, or an
 *  executor who does the work. */
export type OrgLevel = 'executor' | 'lead' | 'team'

/** Each placed agent's level, from its place in the tree: a top is the Project Lead, a manager under a manager is
 *  a Team Lead, and anyone with nobody under them is an Executor (a top with nobody under them is not placed). */
export function orgLevels(trees: OrgNode[]): Map<string, OrgLevel> {
  const levels = new Map<string, OrgLevel>()

  const walk = (node: OrgNode, top: boolean) => {
    levels.set(node.profile.name, top ? 'lead' : node.reports.length ? 'team' : 'executor')
    node.reports.forEach(report => walk(report, false))
  }

  trees.forEach(node => walk(node, true))

  return levels
}

export interface AgentWork {
  /** What it is running now. */
  working: null | { id: string; title: string }
  /** The last thing it finished, with when (epoch seconds) when the activity feed knows it. */
  last: null | { at: null | number; title: string }
}

/** What each agent is doing and last finished, from the board's cards and the activity feed's events. */
export function agentWork(board: KanbanBoard, events: readonly ActivityEvent[], name: string): AgentWork {
  const cards = board.columns.flatMap(column => column.tasks).filter(task => task.assignee === name)
  const running = cards.find(task => task.status === 'running')
  const finished = events.filter(event => event.actor === name && event.kind === 'completed')
  const newest = finished.sort((a, b) => b.created_at - a.created_at)[0]
  const done = cards.filter(task => task.status === 'done').at(-1)

  return {
    last: newest ? { at: newest.created_at, title: newest.task_title } : done ? { at: null, title: done.title } : null,
    working: running ? { id: running.id, title: running.title } : null
  }
}

/** Reports drawn in a column under their manager rather than a row: three or more, none leading anyone. */
export const stacks = (node: OrgNode) =>
  node.reports.length >= 3 && node.reports.every(report => !report.reports.length)

/** The tree read top to bottom, each agent right before the ones under it (the order of the card grid). */
export const flattenTree = (nodes: readonly OrgNode[]): KanbanProfile[] =>
  nodes.flatMap(node => [node.profile, ...flattenTree(node.reports)])
