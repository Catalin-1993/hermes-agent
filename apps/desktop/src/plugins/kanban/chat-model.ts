/** The Chat page's threads: a task's comments as messages and its work events as short system lines, in time
 *  order; and the team feed, every thread merged. Pure, so it is tested. */

import type { KanbanComment, KanbanEvent } from './types'

/** Comment authors that are the owner writing from the app. */
const OWNER = new Set(['dashboard', 'owner', 'user', 'you'])

/** Work events worth a line in a conversation (comments are messages already). */
export const EVENT_KINDS = [
  'assigned',
  'blocked',
  'claimed',
  'completed',
  'crashed',
  'created',
  'gave_up',
  'review_requested',
  'timed_out',
  'unblocked'
] as const

export type EventKind = (typeof EVENT_KINDS)[number]

export type ChatLine =
  | { at: number; author: string; body: string; id: string; kind: 'message'; mine: boolean; taskId: string }
  | { at: number; event: EventKind; id: string; kind: 'event'; taskId: string }

export const isOwner = (author: string) => OWNER.has(author.trim().toLowerCase())

export function threadLines(
  taskId: string,
  comments: readonly KanbanComment[],
  events: readonly KanbanEvent[]
): ChatLine[] {
  const known = new Set<string>(EVENT_KINDS)

  const messages: ChatLine[] = comments.map(comment => ({
    at: comment.created_at,
    author: comment.author,
    body: comment.body,
    id: `c${comment.id}`,
    kind: 'message',
    mine: isOwner(comment.author),
    taskId
  }))

  const lines: ChatLine[] = events
    .filter(event => known.has(event.kind))
    .map(event => ({ at: event.created_at, event: event.kind as EventKind, id: `e${event.id}`, kind: 'event', taskId }))

  return [...messages, ...lines].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
}

/** Every thread in one feed, oldest first; only the newest `limit` lines are kept. */
export function teamFeed(threads: readonly ChatLine[][], limit: number): ChatLine[] {
  return threads
    .flat()
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .slice(-limit)
}

/** The newest message of a thread, for its row in the list. */
export const lastMessage = (lines: readonly ChatLine[]) =>
  [...lines].reverse().find(line => line.kind === 'message') ?? null
