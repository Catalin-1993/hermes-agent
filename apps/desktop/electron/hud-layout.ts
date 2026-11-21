/**
 * Brain: the HUD's three layouts and the right-click menu that switches them.
 *
 * - `bar`     — the floating Spotlight bar (the default; the only layout that remembers where you park it).
 * - `edge`    — a small tab docked to the right edge of the screen. It can stay tucked away until the pointer
 *               reaches the edge, and it can pop a reply up beside itself. Clicking it opens the bar next to it;
 *               leaving the bar folds it back into the tab.
 * - `menubar` — an icon in the system menu bar (macOS) or tray. Clicking it drops the bar below the icon;
 *               leaving the bar hides it. While the agent works the icon carries a short status and an emoji.
 *
 * One HUD window serves all three, so the conversation, its stream and its composer never restart when the
 * layout changes: main only moves, resizes, hides or shows that window, and tells its renderer which layout it is
 * in. The choice is a device-local preference (`hud-layout.json`), like the HUD's bounds.
 */

import fs from 'node:fs'
import path from 'node:path'

import {
  type BrowserWindow,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  nativeImage,
  type Rectangle,
  screen,
  Tray
} from 'electron'

import { applyHudResetBounds } from './hud-geometry'
import type { HudAgentStatus, HudLayoutMode, HudLayoutPrefs, HudLayoutView } from './hud-layout-types'

export const DEFAULT_HUD_LAYOUT: HudLayoutPrefs = { mode: 'bar', edgeHoverOnly: true, edgePopups: true }

/** The edge widget's window: the tab on its right, room for a reply bubble on its left. At the HUD's minimum size. */
export const EDGE_WINDOW = { width: 380, height: 240 }
const SCREEN_GAP = 12
const TRAY_GAP = 6

const MODES: readonly HudLayoutMode[] = ['bar', 'edge', 'menubar']

export function sanitizeHudLayout(raw: unknown): HudLayoutPrefs {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof HudLayoutPrefs, unknown>>

  return {
    mode: MODES.includes(value.mode as HudLayoutMode) ? (value.mode as HudLayoutMode) : DEFAULT_HUD_LAYOUT.mode,
    edgeHoverOnly: typeof value.edgeHoverOnly === 'boolean' ? value.edgeHoverOnly : DEFAULT_HUD_LAYOUT.edgeHoverOnly,
    edgePopups: typeof value.edgePopups === 'boolean' ? value.edgePopups : DEFAULT_HUD_LAYOUT.edgePopups
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/** The edge widget's window, flush with the right edge of `area`, its middle at `anchorY` (default: a little
 *  below the middle of the screen, where a hand coming in from the side lands). */
export function edgeWidgetBounds(area: Rectangle, anchorY?: number): Rectangle {
  const { width, height } = EDGE_WINDOW
  const middle = anchorY ?? area.y + area.height * 0.55

  return {
    x: area.x + area.width - width,
    y: Math.round(clamp(middle - height / 2, area.y, area.y + area.height - height)),
    width,
    height
  }
}

/** The bar opened from the edge tab: right next to the edge, its middle at the tab's. */
export function barBesideEdgeBounds(
  area: Rectangle,
  size: { height: number; width: number },
  anchorY: number
): Rectangle {
  const width = Math.min(size.width, area.width - 2 * SCREEN_GAP)
  const height = Math.min(size.height, area.height - 2 * SCREEN_GAP)

  return {
    x: area.x + area.width - width - SCREEN_GAP,
    y: Math.round(clamp(anchorY - height / 2, area.y + SCREEN_GAP, area.y + area.height - height - SCREEN_GAP)),
    width,
    height
  }
}

/** The bar dropped from the menu-bar icon: centred under it (above it for a tray at the bottom of the screen). */
export function barUnderTrayBounds(
  tray: Rectangle,
  size: { height: number; width: number },
  area: Rectangle
): Rectangle {
  const width = Math.min(size.width, area.width - 2 * SCREEN_GAP)
  const height = Math.min(size.height, area.height - 2 * SCREEN_GAP)
  const below = tray.y + tray.height / 2 < area.y + area.height / 2

  return {
    x: Math.round(
      clamp(tray.x + tray.width / 2 - width / 2, area.x + SCREEN_GAP, area.x + area.width - width - SCREEN_GAP)
    ),
    y: below ? Math.max(area.y, tray.y + tray.height + TRAY_GAP) : Math.round(tray.y - height - TRAY_GAP),
    width,
    height
  }
}

/** The text beside the menu-bar icon: nothing while idle, so the icon stays as quiet as the system's own. */
export function trayTitle(status: HudAgentStatus): string {
  return { done: ' ✅ Done', idle: '', waiting: ' ✋ Needs you', working: ' 🧠 Working…' }[status]
}

export function trayTooltip(status: HudAgentStatus): string {
  return {
    done: 'Brain — reply ready',
    idle: 'Brain',
    waiting: 'Brain — waiting for you',
    working: 'Brain — working…'
  }[status]
}

/**
 * The menu-bar glyph as a BGRA bitmap of `px`×`px`: a ring with a dot in it, drawn with anti-aliased edges. Black
 * on transparent, so macOS can use it as a template image and tint it for light and dark menu bars.
 */
export function trayGlyph(px: number): Buffer {
  const pixels = Buffer.alloc(px * px * 4)
  const centre = px / 2
  const outer = px * 0.42
  const inner = px * 0.3
  const dot = px * 0.13
  const coverage = (distance: number) => clamp(0.5 - distance, 0, 1)

  for (let y = 0; y < px; y += 1) {
    for (let x = 0; x < px; x += 1) {
      const r = Math.hypot(x + 0.5 - centre, y + 0.5 - centre)
      const ring = Math.min(coverage(r - outer), coverage(inner - r))
      const alpha = Math.max(ring, coverage(r - dot))
      const offset = (y * px + x) * 4

      pixels[offset + 3] = Math.round(alpha * 255)
    }
  }

  return pixels
}

/** The floating bar's saved bounds (`hud-state.json`), or null on a first run or an unreadable file. */
export function readSavedHudBounds(statePath: string): null | Rectangle {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'))

    if ([raw?.x, raw?.y, raw?.width, raw?.height].every(Number.isFinite) && raw.width >= 380 && raw.height >= 160) {
      return raw
    }
  } catch {
    // First run / unreadable — the caller falls back to the defaults.
  }

  return null
}

export interface HudLayoutActions {
  setMode: (mode: HudLayoutMode) => void
  toggleEdgeHoverOnly: () => void
  toggleEdgePopups: () => void
  resetLayout: () => void
  closeHud: () => void
}

/** The HUD's right-click menu: layout first (the thing you came for), the edge widget's two options while it is
 *  the layout, then the window verbs. Native, so it is never clipped by the bar's small window. */
export function hudLayoutMenu(
  view: HudLayoutView,
  actions: HudLayoutActions,
  isMac: boolean
): MenuItemConstructorOptions[] {
  const layout = (mode: HudLayoutMode, label: string): MenuItemConstructorOptions => ({
    label,
    type: 'radio',
    checked: view.mode === mode,
    click: () => actions.setMode(mode)
  })

  return [
    { label: 'Cut', role: 'cut' },
    { label: 'Copy', role: 'copy' },
    { label: 'Paste', role: 'paste' },
    { type: 'separator' },
    layout('bar', 'Floating bar'),
    layout('edge', 'Widget at the screen edge'),
    layout('menubar', isMac ? 'Icon in the menu bar' : 'Icon in the system tray'),
    ...(view.mode === 'edge'
      ? ([
          { type: 'separator' },
          {
            label: 'Show only on hover',
            type: 'checkbox',
            checked: view.edgeHoverOnly,
            click: actions.toggleEdgeHoverOnly
          },
          { label: 'Pop up replies', type: 'checkbox', checked: view.edgePopups, click: actions.toggleEdgePopups }
        ] satisfies MenuItemConstructorOptions[])
      : []),
    { type: 'separator' },
    ...(view.mode === 'bar' ? [{ label: 'Reset position and size', click: actions.resetLayout }] : []),
    { label: 'Exit HUD', click: actions.closeHud }
  ]
}

export interface HudLayoutDeps {
  isMac: boolean
  prefsPath: string
  getHudWindow: () => BrowserWindow | null
  /** Where the bar lives in the `bar` layout (the saved bounds, or the default for the display). */
  barBounds: (area: Rectangle) => { height: number; width: number; x?: number; y?: number }
  resetLayout: () => boolean
  closeHud: () => void
  log: (message: string) => void
}

/** How long the bar may be unfocused before the edge tab folds it back / the menu-bar bar hides. Long enough for a
 *  native menu or a file dialog to take focus and give it back. */
const LEAVE_DELAY_MS = 220

export function createHudLayout(deps: HudLayoutDeps) {
  let prefs = readPrefs()
  let expanded = false
  let tray: null | Tray = null
  let status: HudAgentStatus = 'idle'
  let leaveTimer: null | ReturnType<typeof setTimeout> = null
  const attached = new WeakSet<BrowserWindow>()

  function readPrefs(): HudLayoutPrefs {
    try {
      return sanitizeHudLayout(JSON.parse(fs.readFileSync(deps.prefsPath, 'utf8')))
    } catch {
      return { ...DEFAULT_HUD_LAYOUT }
    }
  }

  function savePrefs() {
    try {
      fs.mkdirSync(path.dirname(deps.prefsPath), { recursive: true })
      fs.writeFileSync(deps.prefsPath, JSON.stringify(prefs, null, 2), 'utf8')
    } catch (error) {
      deps.log(`[hud-layout] could not save the layout: ${(error as Error)?.message ?? error}`)
    }
  }

  const view = (): HudLayoutView => ({ ...prefs, expanded })
  const liveWindow = () => (win => (win && !win.isDestroyed() ? win : null))(deps.getHudWindow())
  const workArea = (win: BrowserWindow) => screen.getDisplayMatching(win.getBounds()).workArea

  const publish = () => liveWindow()?.webContents.send('hermes:hud:layout', view())

  const clearLeave = () => {
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
  }

  function destroyTray() {
    tray?.destroy()
    tray = null
  }

  function trayImage() {
    const image = nativeImage.createEmpty()

    for (const scaleFactor of [1, 2]) {
      const px = 18 * scaleFactor
      image.addRepresentation({ scaleFactor, width: px, height: px, buffer: toPng(trayGlyph(px), px) })
    }

    image.setTemplateImage(true)

    return image
  }

  function ensureTray(): boolean {
    if (tray && !tray.isDestroyed()) {
      return true
    }

    try {
      tray = new Tray(trayImage())
    } catch (error) {
      deps.log(`[hud-layout] no menu-bar icon on this desktop: ${(error as Error)?.message ?? error}`)
      tray = null

      return false
    }

    tray.setIgnoreDoubleClickEvents(true)
    applyStatus()
    tray.on('click', () => toggleFromTray())
    tray.on('right-click', () => tray?.popUpContextMenu(Menu.buildFromTemplate(trayMenu())))

    return true
  }

  function trayMenu(): MenuItemConstructorOptions[] {
    return [
      { label: 'Show Brain bar', click: () => toggleFromTray(true) },
      { type: 'separator' },
      { label: 'Floating bar', click: () => setMode('bar') },
      { label: 'Widget at the screen edge', click: () => setMode('edge') },
      { type: 'separator' },
      { label: 'Exit HUD', click: deps.closeHud }
    ]
  }

  function applyStatus() {
    if (!tray || tray.isDestroyed()) {
      return
    }

    if (deps.isMac) {
      tray.setTitle(trayTitle(status), { fontType: 'monospacedDigit' })
    }

    tray.setToolTip(trayTooltip(status))
  }

  function place(win: BrowserWindow, bounds: Rectangle | { height: number; width: number; x?: number; y?: number }) {
    if (!applyHudResetBounds(win, bounds)) {
      deps.log('[hud-layout] could not move the HUD window')
    }
  }

  /** Put the window where the current layout wants it. `reveal`: also show it (false while it is being born
   *  hidden — its own first paint shows it). */
  function apply(win: BrowserWindow, reveal: boolean) {
    clearLeave()
    expanded = false

    if (prefs.mode === 'menubar') {
      if (!ensureTray()) {
        prefs = { ...prefs, mode: 'bar' }
        savePrefs()
      } else {
        win.hide()
        publish()

        return
      }
    }

    destroyTray()

    const area = workArea(win)

    // A bar born as a bar is already where its saved bounds put it; one coming back from another layout is not.
    if (prefs.mode === 'edge' || reveal) {
      place(win, prefs.mode === 'edge' ? edgeWidgetBounds(area) : deps.barBounds(area))
    }

    if (reveal && !win.isVisible()) {
      win.showInactive()
    }

    publish()
  }

  function setMode(mode: HudLayoutMode) {
    prefs = { ...prefs, mode }
    savePrefs()
    const win = liveWindow()

    if (win) {
      apply(win, true)
    }
  }

  function setOption(key: 'edgeHoverOnly' | 'edgePopups') {
    prefs = { ...prefs, [key]: !prefs[key] }
    savePrefs()
    publish()
  }

  function expand() {
    const win = liveWindow()

    if (!win || prefs.mode !== 'edge') {
      return
    }

    clearLeave()
    const tab = win.getBounds()
    const area = workArea(win)

    if (!expanded) {
      expanded = true
      place(win, barBesideEdgeBounds(area, deps.barBounds(area), tab.y + tab.height / 2))
      publish()
    }

    win.show()
    win.focus()
  }

  function collapse() {
    const win = liveWindow()

    if (!win || prefs.mode !== 'edge' || !expanded) {
      return
    }

    const bar = win.getBounds()
    expanded = false
    place(win, edgeWidgetBounds(workArea(win), bar.y + bar.height / 2))
    publish()
  }

  function toggleFromTray(forceShow = false) {
    const win = liveWindow()

    if (!win || !tray) {
      return
    }

    clearLeave()

    if (!forceShow && win.isVisible() && win.isFocused()) {
      win.hide()

      return
    }

    const trayBounds = tray.getBounds()
    const area = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y }).workArea
    place(win, barUnderTrayBounds(trayBounds, deps.barBounds(area), area))
    win.show()
    win.focus()
  }

  /** The bar lost focus: an edge bar folds back into its tab, a menu-bar bar goes away. */
  function onBlur() {
    clearLeave()

    if (!((prefs.mode === 'edge' && expanded) || prefs.mode === 'menubar')) {
      return
    }

    leaveTimer = setTimeout(() => {
      leaveTimer = null
      const win = liveWindow()

      if (!win || win.isFocused()) {
        return
      }

      if (prefs.mode === 'edge') {
        collapse()
      } else {
        win.hide()
      }
    }, LEAVE_DELAY_MS)
  }

  const actions: HudLayoutActions = {
    setMode,
    toggleEdgeHoverOnly: () => setOption('edgeHoverOnly'),
    toggleEdgePopups: () => setOption('edgePopups'),
    resetLayout: () => void deps.resetLayout(),
    closeHud: deps.closeHud
  }

  const fromHud = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => {
    const win = liveWindow()

    return win && event.sender === win.webContents ? win : null
  }

  ipcMain.on('hermes:hud:layout:get', event => {
    event.returnValue = view()
  })

  ipcMain.on('hermes:hud:context-menu', event => {
    const win = fromHud(event)

    if (win) {
      Menu.buildFromTemplate(hudLayoutMenu(view(), actions, deps.isMac)).popup({ window: win })
    }
  })

  ipcMain.on('hermes:hud:expand', event => {
    if (fromHud(event)) {
      expand()
    }
  })

  ipcMain.on('hermes:hud:collapse', event => {
    if (fromHud(event)) {
      collapse()
    }
  })

  ipcMain.on('hermes:hud:status', (event, next) => {
    if (fromHud(event) && ['done', 'idle', 'waiting', 'working'].includes(next)) {
      status = next as HudAgentStatus
      applyStatus()
    }
  })

  return {
    /** A new HUD window: put it where its layout wants it before it is first shown. */
    attach(win: BrowserWindow) {
      if (!attached.has(win)) {
        attached.add(win)
        win.on('blur', onBlur)
        win.on('focus', clearLeave)
      }

      apply(win, false)
    },
    /** The HUD went away: the menu-bar icon goes with it. */
    detach() {
      clearLeave()
      expanded = false
      status = 'idle'
      destroyTray()
    },
    /** Only the floating bar remembers where it was parked; the other layouts place the window themselves. */
    persistsBounds: () => prefs.mode === 'bar',
    /** A menu-bar HUD is born hidden and waits for its icon. */
    startsHidden: () => prefs.mode === 'menubar' && Boolean(tray)
  }
}

/** A raw BGRA bitmap as a PNG buffer, via nativeImage (which encodes it). */
function toPng(bgra: Buffer, px: number): Buffer {
  return nativeImage.createFromBitmap(bgra, { width: px, height: px }).toPNG()
}
