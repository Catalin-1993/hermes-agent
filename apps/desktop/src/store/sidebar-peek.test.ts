import type { atom } from 'nanostores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store/layout', async () => {
  const { atom: make } = await import('nanostores')
  const $sidebarOpen = make(false)

  return {
    $sidebarOpen,
    setSidebarOpen: vi.fn((next: boolean) => $sidebarOpen.set(next))
  }
})

vi.mock('@/components/pane-shell/tree/store', async () => {
  const { atom: make } = await import('nanostores')

  return { $layoutTree: make(null), $narrowViewport: make(false) }
})

vi.mock('@/components/pane-shell/tree/model', () => ({ findGroupOfPane: () => undefined }))

import { $narrowViewport } from '@/components/pane-shell/tree/store'
import { $sidebarOpen, setSidebarOpen } from '@/store/layout'

import {
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
    ;($sidebarOpen as ReturnType<typeof atom<boolean>>).set(false)
    ;($narrowViewport as ReturnType<typeof atom<boolean>>).set(false)
    vi.mocked(setSidebarOpen).mockClear()
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

    expect(setSidebarOpen).not.toHaveBeenCalled()

    move(0)
    vi.advanceTimersByTime(850)

    expect(setSidebarOpen).toHaveBeenCalledWith(true)
    expect(isSidebarPeeking()).toBe(true)
  })

  it('opens on the button only after resting there a second and a half, and not on a shorter pass', () => {
    restOnSidebarButton()
    vi.advanceTimersByTime(1400)
    leaveSidebarPeek()
    vi.advanceTimersByTime(2000)

    expect(setSidebarOpen).not.toHaveBeenCalled()

    restOnSidebarButton()
    vi.advanceTimersByTime(1500)

    expect(setSidebarOpen).toHaveBeenLastCalledWith(true)

    leaveSidebarPeek()
    vi.advanceTimersByTime(300)

    expect(setSidebarOpen).toHaveBeenLastCalledWith(false)
    expect(isSidebarPeeking()).toBe(false)
  })

  it('stays open while the pointer is on a menu the sidebar opened, and closes once it leaves', () => {
    const menu = document.createElement('div')

    menu.setAttribute('role', 'menu')
    document.body.append(menu)
    vi.mocked(document.elementFromPoint).mockReturnValue(menu)

    restOnSidebarButton()
    vi.advanceTimersByTime(1500)
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

  it('does not open later from a rest that a press ended first', () => {
    restOnSidebarButton()
    vi.advanceTimersByTime(800)
    pinSidebarPeek()
    vi.advanceTimersByTime(2000)

    expect(setSidebarOpen).not.toHaveBeenCalled()
  })

  it('stays open when the button is pressed during the peek, and when it was already open', () => {
    startSidebarPeek()

    expect(pinSidebarPeek()).toBe(true)

    leaveSidebarPeek()
    vi.advanceTimersByTime(500)

    expect(setSidebarOpen).toHaveBeenCalledTimes(1)
    expect($sidebarOpen.get()).toBe(true)
    expect(pinSidebarPeek()).toBe(false)

    vi.mocked(setSidebarOpen).mockClear()
    startSidebarPeek()

    expect(setSidebarOpen).not.toHaveBeenCalled()
  })

  it('does nothing on a narrow window, which has its own reveal, or when the sidebar closes some other way', () => {
    ;($narrowViewport as ReturnType<typeof atom<boolean>>).set(true)
    startSidebarPeek()

    expect(setSidebarOpen).not.toHaveBeenCalled()
    ;($narrowViewport as ReturnType<typeof atom<boolean>>).set(false)
    startSidebarPeek()
    ;($sidebarOpen as ReturnType<typeof atom<boolean>>).set(false)

    expect(isSidebarPeeking()).toBe(false)
  })
})
