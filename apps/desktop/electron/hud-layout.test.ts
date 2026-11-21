import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn() },
  Menu: { buildFromTemplate: vi.fn() },
  nativeImage: {},
  screen: {},
  Tray: vi.fn()
}))

const {
  barBesideEdgeBounds,
  barUnderTrayBounds,
  EDGE_WINDOW,
  edgeWidgetBounds,
  hudLayoutMenu,
  sanitizeHudLayout,
  trayGlyph,
  trayTitle
} = await import('./hud-layout')

const area = { x: 0, y: 25, width: 1440, height: 875 }

describe('HUD layouts', () => {
  it('reads a saved layout, falling back to the floating bar for anything it does not know', () => {
    expect(sanitizeHudLayout({ mode: 'edge', edgeHoverOnly: false })).toEqual({
      mode: 'edge',
      edgeHoverOnly: false,
      edgePopups: true
    })
    expect(sanitizeHudLayout({ mode: 'dock' }).mode).toBe('bar')
    expect(sanitizeHudLayout(null).mode).toBe('bar')
  })

  it('docks the edge widget flush with the right edge and keeps it on screen', () => {
    const tab = edgeWidgetBounds(area)

    expect(tab.x + tab.width).toBe(area.x + area.width)
    expect(tab).toMatchObject(EDGE_WINDOW)
    expect(edgeWidgetBounds(area, 10_000).y + EDGE_WINDOW.height).toBe(area.y + area.height)
    expect(edgeWidgetBounds(area, -50).y).toBe(area.y)
  })

  it('opens the bar beside the edge tab, centred on it and inside the screen', () => {
    const bar = barBesideEdgeBounds(area, { width: 620, height: 320 }, 500)

    expect(bar.x + bar.width).toBe(area.width - 12)
    expect(bar.y + bar.height / 2).toBe(500)
    expect(barBesideEdgeBounds(area, { width: 620, height: 320 }, 890).y + 320).toBeLessThanOrEqual(
      area.y + area.height
    )
  })

  it('drops the bar under a menu-bar icon, and above a tray at the bottom of the screen', () => {
    const below = barUnderTrayBounds({ x: 1300, y: 0, width: 24, height: 24 }, { width: 620, height: 320 }, area)

    expect(below.y).toBe(30)
    expect(below.x + below.width).toBeLessThanOrEqual(area.width - 12)

    const above = barUnderTrayBounds({ x: 700, y: 876, width: 24, height: 24 }, { width: 620, height: 320 }, area)

    expect(above.y + above.height).toBe(870)
    expect(above.x + above.width / 2).toBe(712)
  })

  it('shows nothing beside the icon while idle, and the agent state otherwise', () => {
    expect(trayTitle('idle')).toBe('')
    expect(trayTitle('working')).toContain('Working')
    expect(trayTitle('waiting')).toContain('Needs you')
    expect(trayTitle('done')).toContain('Done')
  })

  it('draws a template glyph: opaque ring and dot, transparent corners', () => {
    const px = 36
    const glyph = trayGlyph(px)
    const alpha = (x: number, y: number) => glyph[(y * px + x) * 4 + 3]

    expect(glyph.length).toBe(px * px * 4)
    expect(alpha(18, 18)).toBe(255)
    expect(alpha(0, 0)).toBe(0)
    expect(alpha(18, 3)).toBeGreaterThan(200)
  })

  it('offers the widget options only for the edge layout, and Reset only for the floating bar', () => {
    const actions = {
      closeHud: vi.fn(),
      resetLayout: vi.fn(),
      setMode: vi.fn(),
      toggleEdgeHoverOnly: vi.fn(),
      toggleEdgePopups: vi.fn()
    }

    const labels = (mode: 'bar' | 'edge' | 'menubar') =>
      hudLayoutMenu({ mode, edgeHoverOnly: true, edgePopups: false, expanded: false }, actions, true).map(
        item => item.label
      )

    expect(labels('bar')).toContain('Reset position and size')
    expect(labels('bar')).not.toContain('Show only on hover')
    expect(labels('edge')).toEqual(expect.arrayContaining(['Show only on hover', 'Pop up replies']))
    expect(labels('menubar')).toContain('Icon in the menu bar')

    const menubar = hudLayoutMenu(
      { mode: 'bar', edgeHoverOnly: true, edgePopups: true, expanded: false },
      actions,
      true
    ).find(item => item.label === 'Icon in the menu bar')

    menubar?.click?.({} as never, undefined, {} as never)
    expect(actions.setMode).toHaveBeenCalledWith('menubar')
  })
})
