import { computed } from 'nanostores'

import { Codecs, persistentAtom } from '@/lib/persisted'
import type { SessionOwnerRoute } from '@/store/session-request-router'

/**
 * The notifications feed behind the titlebar bell: what happened while you were looking elsewhere — a background chat
 * finished or failed, an agent delivered, a scheduled job ran, a command exited, a session is waiting
 * on you. Fed by the app's one notification door (`dispatchNativeNotification`) and by the watchers in
 * `app/notifications/sources.ts`. Persisted (capped) so a reload keeps what you missed.
 */
export type FeedKind = 'agent' | 'approval' | 'error' | 'plugin' | 'process' | 'question' | 'reply' | 'scheduled'

/** Where a row leads. A session keeps the (connection, profile) of the row it came from, so a run
 *  served by another profile or an SSH backend opens there, not on whichever backend is ambient. */
export type FeedTarget =
  { kind: 'route'; path: string } | { kind: 'session'; owner?: SessionOwnerRoute; storedSessionId: string }

export interface FeedItem {
  at: number
  body?: string
  /** A secondary line: "3 files written · 2m 10s". */
  detail?: string
  failed?: boolean
  id: string
  kind: FeedKind
  read: boolean
  target?: FeedTarget
  title: string
}

export type FeedEntry = Omit<FeedItem, 'at' | 'id' | 'read'> & {
  /** Collapses replays of one event (same kind + key within a few seconds) into a single item. */
  key?: string
}

const MAX_ITEMS = 60
const REPLAY_WINDOW_MS = 4000
const BODY_LIMIT = 280

const isFeedItem = (value: unknown): value is FeedItem =>
  Boolean(value) &&
  typeof value === 'object' &&
  typeof (value as FeedItem).id === 'string' &&
  typeof (value as FeedItem).title === 'string' &&
  typeof (value as FeedItem).at === 'number'

export const $notificationFeed = persistentAtom<FeedItem[]>(
  'hermes.desktop.notification-feed.v1',
  [],
  Codecs.json(value => (Array.isArray(value) ? value.filter(isFeedItem).slice(0, MAX_ITEMS) : []))
)

export const $notificationFeedUnread = computed($notificationFeed, items => items.filter(item => !item.read).length)

const recentKeys = new Map<string, number>()

export function recordFeedItem({ key, ...entry }: FeedEntry, now = Date.now()): void {
  for (const [seen, at] of recentKeys) {
    if (now - at >= REPLAY_WINDOW_MS) {
      recentKeys.delete(seen)
    }
  }

  const replayKey = `${entry.kind}:${key ?? ''}`

  if (key && recentKeys.has(replayKey)) {
    return
  }

  if (key) {
    recentKeys.set(replayKey, now)
  }

  const body = entry.body?.trim()

  const item: FeedItem = {
    ...entry,
    at: now,
    body: body ? (body.length > BODY_LIMIT ? `${body.slice(0, BODY_LIMIT).trimEnd()}…` : body) : undefined,
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    read: false,
    title: entry.title.trim() || entry.kind
  }

  $notificationFeed.set([item, ...$notificationFeed.get()].slice(0, MAX_ITEMS))
}

function markRead(matches: (item: FeedItem) => boolean): void {
  const items = $notificationFeed.get()

  if (items.some(item => !item.read && matches(item))) {
    $notificationFeed.set(items.map(item => (!item.read && matches(item) ? { ...item, read: true } : item)))
  }
}

export const markFeedItemRead = (id: string) => markRead(item => item.id === id)

export const markFeedRead = () => markRead(() => true)

/** You are looking at this session now: whatever the feed says about it has been seen. */
export const markFeedSessionRead = (storedSessionId: string) =>
  markRead(item => item.target?.kind === 'session' && item.target.storedSessionId === storedSessionId)

export function clearFeed(): void {
  $notificationFeed.set([])
}
