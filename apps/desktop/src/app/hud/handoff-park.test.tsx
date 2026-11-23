// @vitest-environment jsdom
/** Brain: a parked HUD comes back connected — it takes the session back from the app window, and only after a park. */
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import type * as WindowsModule from '@/store/windows'

vi.mock('../chat/composer/focus', () => ({ getActiveComposer: () => 'main', requestComposerFocus: vi.fn() }))
vi.mock('../open-session', () => ({ openSession: vi.fn() }))
vi.mock('@/store/composer', () => ({ reloadPersistedDrafts: vi.fn(), requestComposerDraftSync: vi.fn() }))
vi.mock('@/store/session-states', () => ({ focusOpenSession: () => 'main', sessionTileDelegate: () => null }))
vi.mock('@/store/windows', async importOriginal => ({
  ...(await importOriginal<typeof WindowsModule>()),
  isHudWindow: () => true
}))

const { $selectedStoredSessionId } = await import('@/store/session')
const { HUD_PARK_EVENT } = await import('@/store/hud')
const { useHudHandoff } = await import('./handoff')

type HudChanged = (state: { open: boolean; sessionId: null | string }) => void

const desktopWindow = window as unknown as { hermesDesktop?: Window['hermesDesktop'] }
let emitHudChanged: HudChanged | null = null
let emitPark: (() => void) | null = null

beforeEach(() => {
  emitHudChanged = null
  emitPark = null
  $selectedStoredSessionId.set('s1')
  desktopWindow.hermesDesktop = {
    hud: {
      onChanged: (listener: HudChanged) => {
        emitHudChanged = listener

        return () => undefined
      },
      onPark: (listener: () => void) => {
        emitPark = listener

        return () => undefined
      }
    }
  } as unknown as Window['hermesDesktop']
})

afterEach(() => {
  delete desktopWindow.hermesDesktop
})

it('asks the composer to save on park, and takes the session back on return — not on its first open', () => {
  const resumeSession = vi.fn()

  renderHook(() => useHudHandoff({ navigate: vi.fn(), resumeSession }))

  emitHudChanged?.({ open: true, sessionId: 's1' })
  expect(resumeSession).not.toHaveBeenCalled()

  const saved = vi.fn()

  window.addEventListener(HUD_PARK_EVENT, saved)
  emitPark?.()
  expect(saved).toHaveBeenCalledOnce()
  emitHudChanged?.({ open: false, sessionId: 's1' })
  expect(resumeSession).not.toHaveBeenCalled()

  emitHudChanged?.({ open: true, sessionId: 's1' })
  expect(resumeSession).toHaveBeenCalledExactlyOnceWith('s1')
})
