/** The org chart as trees, and the rules for moving an agent in it. Pure, so they are tested. */

import type { KanbanProfile } from './types'

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
