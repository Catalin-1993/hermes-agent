import type { atom } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store/layout', async () => {
  const { atom: make } = await import('nanostores')
  const { $narrowOverlayPaneIds } = await import('@/components/pane-shell/narrow-overlay-state')
  const $leftSideOpen = make(false)

  // The titlebar button's positional toggle: it folds or unfolds the left column.
  return {
    $leftSideOpen,
    CHAT_SIDEBAR_PANE_ID: 'chat-sidebar',
    // A narrow window's overlay: the layout shows it (and publishes it as visible) when asked.
    revealNarrowSidebar: vi.fn((mode: 'close' | 'open') => {
      $narrowOverlayPaneIds.set(mode === 'open' ? new Set(['chat-sidebar']) : new Set())

      return true
    }),
    toggleLeftSide: vi.fn(() => $leftSideOpen.set(!$leftSideOpen.get()))
  }
})

vi.mock('@/components/pane-shell/tree/store', async () => {
  const { atom: make } = await import('nanostores')

  return { $layoutTree: make(null), $narrowViewport: make(false) }
})

vi.mock('@/components/pane-shell/tree/model', () => ({ findGroupOfPane: () => undefined }))

import { $narrowOverlayPaneIds } from '@/components/pane-shell/narrow-overlay-state'
import { $narrowViewport } from '@/components/pane-shell/tree/store'
import { $leftSideOpen, revealNarrowSidebar, toggleLeftSide } from '@/store/layout'

import {
  holdSidebarPeekOff,
  installSidebarPeek,
  isSidebarPeeking,
  leaveSidebarPeek,
  pinSidebarPeek,
  restOnSidebarButton,
  startSidebarPeek
} from './sidebar-peek'

const move = (x: number, y = 300, buttons = 0) =>
  window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, buttons, clientX: x, clientY: y }))

describe('opening the sidebar by pointing at it', () => {
  let stop: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    ;($leftSideOpen as ReturnType<typeof atom<boolean>>).set(false)
    ;($narrowViewport as ReturnType<typeof atom<boolean>>).set(false)
    vi.mocked(toggleLeftSide).mockClear()
    vi.mocked(revealNarrowSidebar).mockClear()
    $narrowOverlayPaneIds.set(new Set())
    // jsdom does no layout: nothing is under the pointer unless a test says so.
    document.elementFromPoint = vi.fn(() => null)
    stop = installSidebarPeek()
  })

  afterEach(() => {
    stop()
    vi.useRealTimers()
  })

  it('opens when the pointer rests on the left edge long enough, and not when it only brushes past', () => {
    move(1)
    vi.advanceTimersByTime(300)
    move(40)
    vi.advanceTimersByTime(1000)

    expect(toggleLeftSide).not.toHaveBeenCalled()

    move(0)
    vi.advanceTimersByTime(850)

    expect($leftSideOpen.get()).toBe(true)
    expect(isSidebarPeeking()).toBe(true)
  })

  it('opens as soon as the pointer is on the button, and closes when it leaves', () => {
    restOnSidebarButton()

    expect($leftSideOpen.get()).toBe(true)
    expect(isSidebarPeeking()).toBe(true)

    leaveSidebarPeek()
    vi.advanceTimersByTime(300)

    expect($leftSideOpen.get()).toBe(false)
    expect(isSidebarPeeking()).toBe(false)
  })

  it('stays open while the pointer is on a menu the sidebar opened, and closes once it leaves', () => {
    const menu = document.createElement('div')

    menu.setAttribute('role', 'menu')
    document.body.append(menu)
    vi.mocked(document.elementFromPoint).mockReturnValue(menu)

    restOnSidebarButton()
    leaveSidebarPeek()
    move(400, 500)
    vi.advanceTimersByTime(2000)

    expect(isSidebarPeeking()).toBe(true)

    vi.mocked(document.elementFromPoint).mockReturnValue(document.body)
    move(600, 500)
    vi.advanceTimersByTime(300)

    expect(isSidebarPeeking()).toBe(false)
    menu.remove()
  })

  it('stays open when the button is pressed during the peek, and when it was already open', () => {
    startSidebarPeek()

    expect(pinSidebarPeek()).toBe(true)

    leaveSidebarPeek()
    vi.advanceTimersByTime(500)

    expect(toggleLeftSide).toHaveBeenCalledTimes(1)
    expect($leftSideOpen.get()).toBe(true)
    expect(pinSidebarPeek()).toBe(false)

    vi.mocked(toggleLeftSide).mockClear()
    startSidebarPeek()

    expect(toggleLeftSide).not.toHaveBeenCalled()
  })

  it('ends the peek when the sidebar closes some other way', () => {
    startSidebarPeek()
    ;($leftSideOpen as ReturnType<typeof atom<boolean>>).set(false)

    expect(isSidebarPeeking()).toBe(false)
  })

  describe('on a narrow window, where the sidebar is an overlay', () => {
    beforeEach(() => {
      ;($narrowViewport as ReturnType<typeof atom<boolean>>).set(true)
    })

    it('opens the overlay as soon as the pointer is on the button, and closes it when the pointer leaves', () => {
      restOnSidebarButton()

      expect(revealNarrowSidebar).toHaveBeenCalledWith('open')
      expect(toggleLeftSide).not.toHaveBeenCalled()
      expect(isSidebarPeeking()).toBe(true)

      leaveSidebarPeek()
      vi.advanceTimersByTime(300)

      expect(revealNarrowSidebar).toHaveBeenLastCalledWith('close')
      expect($narrowOverlayPaneIds.get().size).toBe(0)
      expect(isSidebarPeeking()).toBe(false)
    })

    it('stays open while the pointer is over the overlay itself, which sits under the button', () => {
      const overlay = document.createElement('div')

      overlay.setAttribute('data-narrow-overlay', 'sessions')
      overlay.getBoundingClientRect = () => ({ bottom: 700, left: 0, right: 237, top: 0 }) as DOMRect
      document.body.append(overlay)

      restOnSidebarButton()
      move(150, 20)
      leaveSidebarPeek()
      vi.advanceTimersByTime(2000)

      expect(isSidebarPeeking()).toBe(true)
      expect(revealNarrowSidebar).not.toHaveBeenCalledWith('close')

      move(600, 300)
      vi.advanceTimersByTime(300)

      expect(revealNarrowSidebar).toHaveBeenLastCalledWith('close')
      overlay.remove()
    })

    it('keeps the overlay open when the button is pressed during the peek', () => {
      restOnSidebarButton()

      expect(pinSidebarPeek()).toBe(true)

      leaveSidebarPeek()
      vi.advanceTimersByTime(500)

      expect(revealNarrowSidebar).toHaveBeenCalledTimes(1)
      expect($narrowOverlayPaneIds.get().has('chat-sidebar')).toBe(true)
    })

    it('does not reopen an overlay that is already showing', () => {
      $narrowOverlayPaneIds.set(new Set(['chat-sidebar']))
      restOnSidebarButton()

      expect(revealNarrowSidebar).not.toHaveBeenCalled()
      expect(isSidebarPeeking()).toBe(false)
    })

    it('ends the peek when the overlay is dismissed some other way, even across the open/close flicker', async () => {
      restOnSidebarButton()

      // The layout empties and refills the set in one flush when it opens: that is not a dismissal.
      $narrowOverlayPaneIds.set(new Set())
      $narrowOverlayPaneIds.set(new Set(['chat-sidebar']))
      await Promise.resolve()

      expect(isSidebarPeeking()).toBe(true)

      $narrowOverlayPaneIds.set(new Set())
      await Promise.resolve()

      expect(isSidebarPeeking()).toBe(false)
    })
  })

  it('keeps a pressed-shut sidebar shut while the pointer still rests on the button', () => {
    restOnSidebarButton()
    pinSidebarPeek()

    // The press closes it (the button toggles); the pointer never left, so a hover must stay silent.
    holdSidebarPeekOff()
    toggleLeftSide()
    restOnSidebarButton()

    expect($leftSideOpen.get()).toBe(false)
    expect(isSidebarPeeking()).toBe(false)

    // Leaving and coming back is a new intent: the peek opens again.
    leaveSidebarPeek()
    restOnSidebarButton()

    expect($leftSideOpen.get()).toBe(true)
    expect(isSidebarPeeking()).toBe(true)
  })
})
