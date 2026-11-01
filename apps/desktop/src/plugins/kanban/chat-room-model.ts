/**
 * The Chat room, worked out from the board: each task is a thread whose first message stands in the channel with a
 * reply count; who is working right now; and the room's notes (the project's objective, the latest decisions from
 * its journal, and what is open). Pure, so it is tested.
 */

import type { ChatLine } from './chat-model'
import { taskKind } from './inbox-model'
import { primaryGoal } from './project-model'
import type { BoardGoal, JournalEntry, KanbanTask } from './types'

/** A thread's head in the channel: its first message (or the task itself), how many replies, and who took part. */
export interface ThreadRoot {
  at: number
  author: string
  body: string
  lastAt: number
  mine: boolean
  participants: string[]
  replies: number
  task: KanbanTask
}

/** Each task's thread as one root, oldest first (the channel reads top to bottom, newest at the bottom). */
export function threadRoots(tasks: readonly KanbanTask[], threads: ReadonlyMap<string, ChatLine[]>): ThreadRoot[] {
  return tasks
    .map(task => {
      const messages = (threads.get(task.id) ?? []).filter(line => line.kind === 'message')
      const first = messages[0]
      const last = (threads.get(task.id) ?? []).at(-1)

      return {
        at: first?.at ?? task.created_at ?? 0,
        author: first?.author ?? task.assignee ?? 'agent',
        body: first?.body ?? task.title ?? task.id,
        lastAt: last?.at ?? first?.at ?? task.created_at ?? 0,
        mine: first?.mine ?? false,
        participants: [...new Set(messages.filter(line => !line.mine).map(line => line.author))],
        replies: Math.max(messages.length - 1, 0),
        task
      }
    })
    .sort((a, b) => a.lastAt - b.lastAt || a.at - b.at)
}

/** The decision a thread waits on, if any: the Inbox's kinds that can be settled from the chat. */
export type ApprovalKind = 'blocked' | 'question' | 'review'

export function approvalKind(task: KanbanTask): ApprovalKind | null {
  const kind = taskKind(task)

  return kind === 'blocked' || kind === 'question' || kind === 'review' ? kind : null
}

/** "Ana is working…", "Ana and Max are working…", "Ana, Max and 2 more are working…". */
export function workingText(names: readonly string[]): string {
  const unique = [...new Set(names)]

  if (!unique.length) {
    return ''
  }

  if (unique.length === 1) {
    return `${unique[0]} is working…`
  }

  if (unique.length === 2) {
    return `${unique[0]} and ${unique[1]} are working…`
  }

  return `${unique[0]}, ${unique[1]} and ${unique.length - 2} more are working…`
}

/** Who is on a task right now, in the room's scope. */
export const workingNames = (tasks: readonly KanbanTask[]) => [
  ...new Set(tasks.filter(task => task.status === 'running' && task.assignee).map(task => task.assignee!))
]

export interface RoomNotes {
  objective: null | { title: string; why: string }
  decisions: JournalEntry[]
  open: { needYou: number; running: number; waiting: number }
}

const NEEDS_YOU = new Set(['blocked', 'review'])

/** The project's objective, its latest decisions (newest first) and what is open on the board. */
export function roomNotes(
  goals: readonly BoardGoal[] | undefined,
  journal: readonly JournalEntry[] | undefined,
  tasks: readonly KanbanTask[],
  limit = 3
): RoomNotes {
  const goal = primaryGoal(goals ? [...goals] : undefined)

  return {
    objective: goal ? { title: goal.title, why: goal.why } : null,
    decisions: (journal ?? [])
      .filter(entry => entry.type === 'decision')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit),
    open: {
      needYou: tasks.filter(task => NEEDS_YOU.has(task.status)).length,
      running: tasks.filter(task => task.status === 'running').length,
      waiting: tasks.filter(task => task.status === 'ready' || task.status === 'todo').length
    }
  }
}
