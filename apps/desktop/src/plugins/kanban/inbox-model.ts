/** What waits on the owner, as one ordered list of decisions. Pure, so it is tested. */

import type { KanbanBoard, KanbanControls, KanbanTask } from './types'

/** In the order they are shown: an agent's question first, then money, reviews, blocks, problems. */
export const INBOX_KINDS = ['question', 'budget', 'review', 'blocked', 'problem'] as const
export type InboxKind = (typeof INBOX_KINDS)[number]

export interface InboxItem {
  /** Stable across refreshes, so a snooze sticks: `<kind>:<task or agent>`. */
  id: string
  kind: InboxKind
  /** The agent the decision concerns. */
  agent: string
  /** When it started waiting (epoch seconds); 0 when unknown. */
  since: number
  task?: KanbanTask
}

const SERIOUS = new Set(['critical', 'error'])

function taskKind(task: KanbanTask): InboxKind | null {
  if (task.status === 'blocked') {
    return task.block_kind === 'needs_input' ? 'question' : 'blocked'
  }

  if (task.status === 'review') {
    return 'review'
  }

  const severity = task.warnings?.highest_severity

  return task.warnings && task.warnings.count > 0 && severity && SERIOUS.has(severity) ? 'problem' : null
}

/** Every decision on the board, minus the ones put off until later; oldest first within a kind. */
export function buildInbox(
  board: KanbanBoard,
  controls: KanbanControls | undefined,
  snoozed: Record<string, number>,
  now = Date.now()
): InboxItem[] {
  const items: InboxItem[] = []

  for (const task of board.columns.flatMap(column => column.tasks)) {
    const kind = taskKind(task)

    if (kind) {
      items.push({ agent: task.assignee ?? '', id: `${kind}:${task.id}`, kind, since: task.created_at ?? 0, task })
    }
  }

  for (const agent of controls?.agents ?? []) {
    if (agent.paused && agent.pause_reason === 'budget') {
      items.push({ agent: agent.profile, id: `budget:${agent.profile}`, kind: 'budget', since: agent.paused_at ?? 0 })
    }
  }

  const rank = (item: InboxItem) => INBOX_KINDS.indexOf(item.kind)

  return items.filter(item => !(snoozed[item.id] > now)).sort((a, b) => rank(a) - rank(b) || a.since - b.since)
}

/** How many items of each kind, for the filter chips. */
export function countByKind(items: InboxItem[]): Record<InboxKind, number> {
  const counts = Object.fromEntries(INBOX_KINDS.map(kind => [kind, 0])) as Record<InboxKind, number>

  for (const item of items) {
    counts[item.kind] += 1
  }

  return counts
}

/** Put an item off for a day; expired entries are dropped so the stored map stays small. */
export function snooze(snoozed: Record<string, number>, id: string, now = Date.now()): Record<string, number> {
  const kept = Object.fromEntries(Object.entries(snoozed).filter(([, until]) => until > now))

  return { ...kept, [id]: now + 24 * 3600 * 1000 }
}
