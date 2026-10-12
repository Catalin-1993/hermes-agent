import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as OpenSession from '@/app/open-session'
import { en } from '@/i18n/en'
import { $notificationFeedUnread, clearFeed, recordFeedItem } from '@/store/notification-feed'

import { NotificationsPanel } from './index'

const openSessionFromPicker = vi.hoisted(() => vi.fn())

vi.mock('@/app/open-session', async importOriginal => ({
  ...(await importOriginal<typeof OpenSession>()),
  openSessionFromPicker
}))

const onOpened = vi.fn()

const renderPane = () =>
  render(
    <MemoryRouter>
      <NotificationsPanel onOpened={onOpened} />
    </MemoryRouter>
  )

describe('NotificationsPanel', () => {
  beforeEach(() => {
    clearFeed()
    openSessionFromPicker.mockClear()
    onOpened.mockClear()
  })

  afterEach(cleanup)

  it('opens the chat a row is about the way session rows do, reads that row and closes behind it', () => {
    recordFeedItem({
      body: 'All tests pass',
      kind: 'reply',
      target: { kind: 'session', storedSessionId: 'chat-a' },
      title: 'Fix the flaky test'
    })
    recordFeedItem({
      kind: 'scheduled',
      target: { kind: 'session', storedSessionId: 'run-1' },
      title: 'Nightly report'
    })
    renderPane()

    fireEvent.click(screen.getByRole('button', { name: /Fix the flaky test/ }), { metaKey: true })

    expect(openSessionFromPicker).toHaveBeenCalledWith('chat-a', expect.any(Function), 'tab')
    expect($notificationFeedUnread.get()).toBe(1)
    expect(onOpened).toHaveBeenCalled()
  })

  it('clears back to the quiet state', () => {
    recordFeedItem({ kind: 'process', title: 'npm run build' })
    renderPane()

    fireEvent.click(screen.getByRole('button', { name: en.notificationFeed.clear }))

    expect(screen.queryByRole('button', { name: /npm run build/ })).toBeNull()
    expect(screen.getByText(en.notificationFeed.emptyTitle)).toBeTruthy()
  })
})
