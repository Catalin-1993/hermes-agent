/** Brain: leaving HUD mode parks the window; the next toggle reuses it for the same profile only. */
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ screen: {} }))

const { HUD_PARK_CHANNEL, createHudParking } = await import('./hud-park')

const fakeWindow = () => {
  let destroyed = false

  return {
    destroy: vi.fn(() => (destroyed = true)),
    hide: vi.fn(),
    isDestroyed: () => destroyed,
    webContents: { send: vi.fn() }
  }
}

type Win = Parameters<ReturnType<typeof createHudParking>['park']>[0]

describe('HUD parking', () => {
  it('hides the window after asking it to save, and hands the same window back for its profile', () => {
    const lot = createHudParking()
    const win = fakeWindow()

    lot.park(win as unknown as Win, 'default')

    expect(win.webContents.send).toHaveBeenCalledWith(HUD_PARK_CHANNEL)
    expect(win.hide).toHaveBeenCalled()
    expect(win.destroy).not.toHaveBeenCalled()
    expect(lot.take('coder')).toBeNull()
    expect(lot.take('default')).toBe(win)
    expect(lot.take('default')).toBeNull()
  })

  it('keeps one window in the lot, forgets a closed one, and never hands back a destroyed one', () => {
    const lot = createHudParking()
    const first = fakeWindow()
    const second = fakeWindow()

    lot.park(first as unknown as Win, null)
    lot.park(second as unknown as Win, null)
    expect(first.destroy).toHaveBeenCalled()

    expect(lot.release(first as unknown as Win)).toBe(false)
    expect(lot.release(second as unknown as Win)).toBe(true)
    expect(lot.take(null)).toBeNull()

    lot.park(first as unknown as Win, null)
    expect(lot.take(null)).toBeNull()
  })
})
