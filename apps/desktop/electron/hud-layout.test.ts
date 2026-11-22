import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn() },
  Menu: { buildFromTemplate: vi.fn() },
  nativeImage: {},
  screen: {},
  Tray: vi.fn()
}))

const {
  barUnderTrayBounds,
  EDGE_WINDOW,
  edgeAnchorFor,
  edgeBarBounds,
  edgeWidgetBounds,
  hudLayoutMenu,
  sanitizeHudLayout,
  sideBounds,
  strongestStatus,
  trayFrames,
  trayTitle
} = await import('./hud-layout')

const { HUD_TRAY_ICONS } = await import('./hud-tray-icons')

const area = { x: 0, y: 25, width: 1440, height: 875 }
const bar = { width: 620, height: 320 }

describe('HUD layouts', () => {
  it('reads a saved layout, falling back to the floating bar for anything it does not know', () => {
    expect(sanitizeHudLayout({ mode: 'side', edgeHoverOnly: false, edgeAnchor: 0.2, sideWidth: 9999 })).toMatchObject({
      mode: 'side',
      edgeHoverOnly: false,
      edgePopups: true,
      edgeAnchor: 0.2,
      sideWidth: 760
    })
    expect(sanitizeHudLayout({ mode: 'dock', edgeAnchor: 4, edgeBar: { x: 1 } })).toMatchObject({
      mode: 'bar',
      edgeAnchor: null,
      edgeBar: null
    })
  })

  it('docks the edge tab flush with the right edge where it was left, and keeps it on screen', () => {
    const tab = edgeWidgetBounds(area, 0.2)

    expect(tab.x + tab.width).toBe(area.x + area.width)
    expect(tab).toMatchObject(EDGE_WINDOW)
    expect(edgeAnchorFor(area, tab.y)).toBeCloseTo(0.2, 2)
    expect(edgeWidgetBounds(area, 1).y + EDGE_WINDOW.height).toBe(area.y + area.height)
    expect(edgeWidgetBounds(area, 0).y).toBe(area.y)
  })

  it('opens the bar from the tab in the top right corner, then where it was left, settling against the edge', () => {
    expect(edgeBarBounds(area, bar, null)).toEqual({ x: 1440 - 620 - 12, y: 25 + 12, width: 620, height: 320 })

    const left = edgeBarBounds(area, bar, { x: 300, y: 400, width: 620, height: 320 })

    expect(left).toMatchObject({ x: 300, y: 400 })

    const nearEdge = edgeBarBounds(area, bar, { x: 790, y: 400, width: 620, height: 320 })

    expect(nearEdge.x + nearEdge.width).toBe(1440 - 12)

    const offScreen = edgeBarBounds(area, bar, { x: 4000, y: 400, width: 620, height: 320 })

    expect(offScreen).toMatchObject({ x: 1440 - 620 - 12, y: 37 })
  })

  it('pins the bar to the right side at full height, within its width limits', () => {
    const side = sideBounds(area, 440)

    expect(side).toEqual({ x: 1440 - 440 - 12, y: 37, width: 440, height: 875 - 24 })
    expect(sideBounds(area, 100).width).toBe(380)
    expect(sideBounds(area, 2000).width).toBe(760)
  })

  it('drops the bar under a menu-bar icon, and above a tray at the bottom of the screen', () => {
    const below = barUnderTrayBounds({ x: 1300, y: 0, width: 24, height: 24 }, bar, area)

    expect(below.y).toBe(30)
    expect(below.x + below.width).toBeLessThanOrEqual(area.width - 12)

    const above = barUnderTrayBounds({ x: 700, y: 876, width: 24, height: 24 }, bar, area)

    expect(above.y + above.height).toBe(870)
    expect(above.x + above.width / 2).toBe(712)
  })

  it('keeps the menu-bar icon quiet while idle and shows whatever needs you most', () => {
    expect(trayTitle('idle')).toBe('')
    expect(trayTitle('working')).toBe(' Working')
    expect(strongestStatus(['idle', 'working', 'done'])).toBe('working')
    expect(strongestStatus(['working', 'waiting'])).toBe('waiting')
    expect(strongestStatus([])).toBe('idle')
    expect(trayFrames('working').length).toBeGreaterThan(1)

    for (const status of ['idle', 'working', 'waiting', 'done'] as const) {
      for (const frame of trayFrames(status)) {
        expect(HUD_TRAY_ICONS[`${frame}@1x`]).toBeTruthy()
        expect(HUD_TRAY_ICONS[`${frame}@2x`]).toBeTruthy()
      }
    }
  })

  it('offers every layout, the widget options only for the edge, and the right Reset', () => {
    const actions = {
      closeHud: vi.fn(),
      resetLayout: vi.fn(),
      setMode: vi.fn(),
      toggleEdgeHoverOnly: vi.fn(),
      toggleEdgePopups: vi.fn()
    }

    const labels = (mode: 'bar' | 'edge' | 'menubar' | 'side') =>
      hudLayoutMenu({ mode, edgeHoverOnly: true, edgePopups: false, expanded: false }, actions, true).map(
        item => item.label
      )

    expect(labels('bar')).toEqual(
      expect.arrayContaining([
        'Floating bar',
        'Pinned to the right',
        'Widget at the screen edge',
        'Reset position and size'
      ])
    )
    expect(labels('bar')).not.toContain('Show only on hover')
    expect(labels('edge')).toEqual(
      expect.arrayContaining(['Show only on hover', 'Pop up replies', 'Reset widget position'])
    )

    const pinned = hudLayoutMenu(
      { mode: 'bar', edgeHoverOnly: true, edgePopups: true, expanded: false },
      actions,
      true
    ).find(item => item.label === 'Pinned to the right')

    pinned?.click?.({} as never, undefined, {} as never)
    expect(actions.setMode).toHaveBeenCalledWith('side')
  })
})
