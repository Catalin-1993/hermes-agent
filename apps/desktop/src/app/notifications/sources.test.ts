import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { $notificationFeed, clearFeed, recordFeedItem } from '@/store/notification-feed'
import { $cronSessions, $selectedStoredSessionId, setActiveSessionId } from '@/store/session'
import { $subagentsBySession, type SubagentProgress } from '@/store/subagents'
import type { SessionInfo } from '@/types/hermes'

import { watchFeedSources } from './sources'

// What reaches the feed without passing through a notification: scheduled runs and agents that end
// after the window opened (once each), and the rows you have since looked at, read.

const OPENED_AT = 1_800_000_000_000
const inSeconds = (ms: number) => ms / 1000

const run = (id: string, fields: Partial<SessionInfo> = {}) =>
  ({
    ended_at: null,
    id,
    preview: null,
    source: 'cron',
    started_at: inSeconds(OPENED_AT) - 60,
    title: `Job ${id}`,
    ...fields
  }) as SessionInfo

const agent = (id: string, fields: Partial<SubagentProgress> = {}): SubagentProgress => ({
  filesRead: [],
  filesWritten: [],
  goal: `Goal ${id}`,
  id,
  parentId: null,
  startedAt: OPENED_AT,
  status: 'running',
  stream: [],
  taskCount: 1,
  taskIndex: 0,
  updatedAt: OPENED_AT,
  ...fields
})

function setWindowFocused(focused: boolean) {
  Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => focused })
}

let stop: () => void = () => undefined

beforeEach(() => {
  clearFeed()
  setWindowFocused(false)
})

afterEach(() => {
  stop()
  $cronSessions.set([])
  $subagentsBySession.set({})
  $selectedStoredSessionId.set(null)
  setActiveSessionId(null)
})

describe('watchFeedSources', () => {
  it('reports a scheduled run once, as it ends after the window opened, and leaves history out', () => {
    $cronSessions.set([run('run-old', { ended_at: inSeconds(OPENED_AT) - 30 }), run('run-live')])
    stop = watchFeedSources(OPENED_AT)

    expect($notificationFeed.get()).toEqual([])

    const ended = run('run-live', { ended_at: inSeconds(OPENED_AT) + 5, preview: 'Report sent to the team' })
    $cronSessions.set([run('run-old', { ended_at: inSeconds(OPENED_AT) - 30 }), ended])
    $cronSessions.set([{ ...ended }])

    expect($notificationFeed.get()).toEqual([
      expect.objectContaining({
        body: 'Report sent to the team',
        kind: 'scheduled',
        target: expect.objectContaining({ kind: 'session', storedSessionId: 'run-live' }),
        title: 'Job run-live'
      })
    ])
  })

  it('reports an agent once as it settles, never one that settled before, nor one you are watching', () => {
    $subagentsBySession.set({ 'rt-a': [agent('agent-history', { status: 'completed', updatedAt: OPENED_AT - 1 })] })
    stop = watchFeedSources(OPENED_AT)

    const done = agent('agent-new', {
      filesWritten: ['db/migration.sql'],
      sessionId: 'child-chat',
      status: 'completed',
      summary: 'Wrote the migration',
      updatedAt: OPENED_AT + 1000
    })

    $subagentsBySession.set({ 'rt-a': [agent('agent-new')] })
    $subagentsBySession.set({ 'rt-a': [done] })
    $subagentsBySession.set({ 'rt-a': [{ ...done }] })

    setWindowFocused(true)
    setActiveSessionId('rt-watched')
    $subagentsBySession.set({
      'rt-a': [done],
      'rt-watched': [agent('agent-watched', { status: 'failed', updatedAt: OPENED_AT + 2000 })]
    })

    expect($notificationFeed.get()).toEqual([
      expect.objectContaining({
        body: 'Wrote the migration',
        kind: 'agent',
        target: expect.objectContaining({ kind: 'session', storedSessionId: 'child-chat' }),
        title: 'Goal agent-new'
      })
    ])
  })

  it('reads the rows about a session once you look at it — opened, or back in the window', () => {
    recordFeedItem({ kind: 'reply', target: { kind: 'session', storedSessionId: 'chat-x' }, title: 'X finished' })
    recordFeedItem({ kind: 'reply', target: { kind: 'session', storedSessionId: 'chat-y' }, title: 'Y finished' })
    stop = watchFeedSources(OPENED_AT)

    const unread = () =>
      $notificationFeed
        .get()
        .filter(item => !item.read)
        .map(item => item.title)

    $selectedStoredSessionId.set('chat-x')
    expect(unread()).toEqual(['Y finished', 'X finished'])

    setWindowFocused(true)
    window.dispatchEvent(new Event('focus'))
    expect(unread()).toEqual(['Y finished'])
  })
})
