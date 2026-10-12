import { beforeEach, describe, expect, it } from 'vitest'

import {
  $notificationFeed,
  $notificationFeedUnread,
  clearFeed,
  markFeedItemRead,
  markFeedRead,
  markFeedSessionRead,
  recordFeedItem
} from './notification-feed'

const about = (storedSessionId: string) => ({ kind: 'session' as const, storedSessionId })

describe('the notification feed', () => {
  beforeEach(() => clearFeed())

  it('puts the newest first, collapses a replay of one event, and stays bounded', () => {
    const start = 1_000_000

    recordFeedItem({ key: 'a', kind: 'reply', title: 'First' }, start)
    recordFeedItem({ key: 'a', kind: 'reply', title: 'First, replayed' }, start + 10)
    recordFeedItem({ key: 'b', kind: 'reply', title: 'Second' }, start + 20)

    expect($notificationFeed.get().map(item => item.title)).toEqual(['Second', 'First'])

    const burst = 500

    for (let index = 0; index < burst; index += 1) {
      recordFeedItem({ kind: 'scheduled', title: `Run ${index}` }, start + 100_000 + index)
    }

    expect($notificationFeed.get().length).toBeLessThan(burst)
    expect($notificationFeed.get()[0]?.title).toBe(`Run ${burst - 1}`)
  })

  it('counts as unread only what has not been opened, looked at, or marked', () => {
    recordFeedItem({ kind: 'reply', target: about('chat-a'), title: 'A finished' })
    recordFeedItem({ kind: 'agent', target: about('chat-a'), title: 'A’s agent delivered' })
    recordFeedItem({ kind: 'scheduled', target: about('run-1'), title: 'Nightly report' })
    recordFeedItem({ kind: 'process', target: about('chat-b'), title: 'B’s build exited' })

    expect($notificationFeedUnread.get()).toBe(4)

    markFeedSessionRead('chat-a')
    expect($notificationFeedUnread.get()).toBe(2)

    const nightly = $notificationFeed.get().find(item => item.title === 'Nightly report')!
    markFeedItemRead(nightly.id)
    expect($notificationFeedUnread.get()).toBe(1)

    markFeedRead()
    expect($notificationFeedUnread.get()).toBe(0)
    expect($notificationFeed.get()).toHaveLength(4)
  })
})
