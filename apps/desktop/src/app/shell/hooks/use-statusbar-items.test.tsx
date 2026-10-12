import { renderHook } from '@testing-library/react'
import type { WritableAtom } from 'nanostores'
import { isValidElement, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createClientSessionState } from '@/lib/chat-runtime'
import {
  $selectedStoredSessionId,
  $sessions,
  $sessionStartedAt,
  $tileSessionFocusStartedAt,
  setActiveSessionId
} from '@/store/session'
import { $focusedTreePaneId as $focusedTreePaneIdMock } from '@/store/session-focus'
import { $sessionStates, $sessionTiles } from '@/store/session-states'

import { useStatusbarItems } from './use-statusbar-items'

// The mock above replaces the computed store with a writable atom.
const $focusedTreePaneId = $focusedTreePaneIdMock as unknown as WritableAtom<null | string>

// The focused pane is derived from the layout tree; a settable atom stands in
// so a test can focus a tile without building a pane tree.
vi.mock('@/store/session-focus', async () => {
  const { atom } = await import('nanostores')

  return { $focusedTreePaneId: atom<null | string>(null) }
})

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>

afterEach(() => {
  $sessionTiles.set([])
  $focusedTreePaneId.set(null)
  $selectedStoredSessionId.set(null)
  $sessions.set([])
  $sessionStartedAt.set(null)
  $tileSessionFocusStartedAt.set(null)
})

const statusbarOptions = {
  agentsOpen: false,
  chatOpen: true,
  commandCenterOpen: false,
  extraLeftItems: [],
  extraRightItems: [],
  freshDraftReady: false,
  gatewayState: 'ready' as const,
  inferenceStatus: null,
  openAgents: () => {},
  openCommandCenterSection: () => {},
  requestGateway: async () => undefined as never,
  statusSnapshot: null,
  toggleCommandCenter: () => {}
}

// The folder is chosen and managed from the composer's folder menu; the status bar does not repeat it.
describe('statusbar items', () => {
  it('has no workspace folder item', () => {
    const { result } = renderHook(() => useStatusbarItems(statusbarOptions), { wrapper })
    const ids = [...result.current.leftStatusbarItems, ...result.current.statusbarItems].map(item => item.id)

    expect(ids).not.toContain('workspace-cwd')
  })
})

function sessionTimerItem() {
  const { result } = renderHook(() => useStatusbarItems(statusbarOptions), { wrapper })

  return result.current.statusbarItems.find(item => item.id === 'session-timer')
}

function timerSince(item: ReturnType<typeof sessionTimerItem>): number | null {
  return isValidElement<{ since: number | null }>(item?.detail) ? item.detail.props.since : null
}

describe('statusbar session timer — focused since (#103123)', () => {
  const dayOldRowSeconds = 1_700_000_000

  it('uses the primary focus stamp, not the row age, and labels it so a long value is not a turn', () => {
    $selectedStoredSessionId.set('primary')
    $sessionStartedAt.set(4_000)
    $sessions.set([{ id: 'primary', started_at: dayOldRowSeconds }] as never)
    $focusedTreePaneId.set(null)

    const item = sessionTimerItem()

    expect(timerSince(item)).toBe(4_000)
    expect(item?.label).toBe('Focused since')
    expect(item?.title).toMatch(/not how long a turn/)
  })

  it('stamps tile focus instead of the day-old row, on the same labeled item', () => {
    const before = Date.now()

    $selectedStoredSessionId.set('primary')
    $sessionStartedAt.set(4_000)
    $sessions.set([{ id: 'tile-old', started_at: dayOldRowSeconds }] as never)
    $focusedTreePaneId.set('session-tile:tile-old')

    const item = sessionTimerItem()
    const since = timerSince(item)

    expect(since).toBeGreaterThanOrEqual(before)
    expect(since).toBeLessThanOrEqual(Date.now())
    expect(since).not.toBe(dayOldRowSeconds * 1000)
    expect(since).not.toBe(4_000)
    expect(item?.label).toBe('Focused since')
    expect(item?.hidden).toBeFalsy()
  })

  it('re-stamps when the same tile is focused again after primary', () => {
    const now = vi.spyOn(Date, 'now')

    $selectedStoredSessionId.set('primary')
    now.mockReturnValue(10_000)
    $focusedTreePaneId.set('session-tile:tile-old')
    expect($tileSessionFocusStartedAt.get()).toEqual({ since: 10_000, storedId: 'tile-old' })

    now.mockReturnValue(20_000)
    $focusedTreePaneId.set(null)
    expect($tileSessionFocusStartedAt.get()?.since).toBe(10_000)

    now.mockReturnValue(30_000)
    $focusedTreePaneId.set('session-tile:tile-old')
    expect($tileSessionFocusStartedAt.get()).toEqual({ since: 30_000, storedId: 'tile-old' })

    now.mockRestore()
  })

  it('hides the item when a focused tile has no focus stamp', () => {
    $selectedStoredSessionId.set('primary')
    $sessionStartedAt.set(4_000)
    $sessions.set([{ id: 'tile-old', started_at: dayOldRowSeconds }] as never)
    $focusedTreePaneId.set('session-tile:tile-old')
    $tileSessionFocusStartedAt.set(null)

    const item = sessionTimerItem()

    expect(timerSince(item)).toBeNull()
    expect(item?.hidden).toBe(true)
  })
})

describe('useStatusbarItems session timer — runtime cache anchor', () => {
  it("anchors a focused branch tile to its runtime cache instead of the parent's stored age", () => {
    const parentRowStartedAt = 1_600_000_000
    const branchRuntimeStartedAt = 1_800_000_000_000

    // The branch is a live runtime on the focused tile; its slice carries the
    // runtime's own start, which must win over the parent row's stored age.
    setActiveSessionId('branch-runtime')
    $selectedStoredSessionId.set('parent-stored')
    $sessionStartedAt.set(1_700_000_000_000)
    $sessions.set([
      { id: 'parent-stored', started_at: parentRowStartedAt },
      { id: 'branch-stored', parent_session_id: 'parent-stored', started_at: parentRowStartedAt }
    ] as never)
    $sessionTiles.set([
      {
        ownerRoute: { connectionId: null, mode: 'local', profile: 'default' },
        runtimeId: 'branch-runtime',
        storedSessionId: 'branch-stored'
      }
    ] as never)
    $sessionStates.set({
      'branch-runtime': { ...createClientSessionState('branch-stored'), runtimeStartedAt: branchRuntimeStartedAt }
    } as never)
    $focusedTreePaneId.set('session-tile:branch-stored')

    const item = sessionTimerItem()
    const since = timerSince(item)

    expect(since).toBe(branchRuntimeStartedAt)
    expect(since).not.toBe(parentRowStartedAt * 1000)
  })
})
