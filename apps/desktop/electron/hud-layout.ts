/**
 * Brain: the HUD's layouts, its right-click menu and the Brain icon in the menu bar.
 *
 * - `bar`     — the floating Spotlight bar (the default; the only layout that remembers where you park it).
 * - `edge`    — a small tab docked to the right edge of the screen. A long press moves it up or down; it can stay
 *               tucked away until the pointer reaches the edge, and it can pop a reply up beside itself. Clicking it
 *               opens the bar (top right by default, then wherever you leave it); leaving the bar folds it back.
 * - `menubar` — no bar on screen: clicking the menu-bar icon drops it below the icon; leaving it hides it.
 * - `side`    — the bar pinned to the right side of the screen, full height; it can be made wider or narrower.
 *
 * The menu-bar icon is there for as long as the app runs, whatever the layout: a brain, with a small badge and a
 * word beside it while the agent works ("Working"), waits for you ("Needs you") or has just answered ("Done").
 *
 * One HUD window serves every layout, so the conversation, its stream and its composer never restart when the
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
  Tray,
  type WebContents
} from 'electron'

import { applyHudResetBounds } from './hud-geometry'
import type { HudAgentStatus, HudEdgeDragPhase, HudLayoutMode, HudLayoutView } from './hud-layout-types'
import { HUD_TRAY_ICONS, type HudTrayIcon } from './hud-tray-icons'

export interface HudLayoutPrefs {
  mode: HudLayoutMode
  edgeHoverOnly: boolean
  edgePopups: boolean
  /** Where the edge tab sits: its middle, as a fraction of the screen's height. */
  edgeAnchor: null | number
  /** Where the bar opened from the edge tab was last left (default: the top right corner). */
  edgeBar: null | Rectangle
  /** The pinned side panel's width. */
  sideWidth: number
}

export const DEFAULT_HUD_LAYOUT: HudLayoutPrefs = {
  mode: 'bar',
  edgeHoverOnly: true,
  edgePopups: true,
  edgeAnchor: null,
  edgeBar: null,
  sideWidth: 440
}

/** The edge widget's window: the tab on its right, room for a reply bubble on its left. At the HUD's minimum size. */
export const EDGE_WINDOW = { width: 380, height: 240 }
const SIDE_WIDTH = { min: 380, max: 760 }
const SCREEN_GAP = 12
const TRAY_GAP = 6

const MODES: readonly HudLayoutMode[] = ['bar', 'edge', 'menubar', 'side']

const isRect = (value: unknown): value is Rectangle =>
  Boolean(value) &&
  ['x', 'y', 'width', 'height'].every(key => Number.isFinite((value as Record<string, unknown>)[key])) &&
  (value as Rectangle).width >= 380 &&
  (value as Rectangle).height >= 160

export function sanitizeHudLayout(raw: unknown): HudLayoutPrefs {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof HudLayoutPrefs, unknown>>
  const anchor = Number(value.edgeAnchor)
  const sideWidth = Number(value.sideWidth)

  return {
    mode: MODES.includes(value.mode as HudLayoutMode) ? (value.mode as HudLayoutMode) : DEFAULT_HUD_LAYOUT.mode,
    edgeHoverOnly: typeof value.edgeHoverOnly === 'boolean' ? value.edgeHoverOnly : DEFAULT_HUD_LAYOUT.edgeHoverOnly,
    edgePopups: typeof value.edgePopups === 'boolean' ? value.edgePopups : DEFAULT_HUD_LAYOUT.edgePopups,
    edgeAnchor: value.edgeAnchor !== null && anchor >= 0 && anchor <= 1 ? anchor : null,
    edgeBar: isRect(value.edgeBar) ? value.edgeBar : null,
    sideWidth: Number.isFinite(sideWidth) ? clamp(Math.round(sideWidth), SIDE_WIDTH.min, SIDE_WIDTH.max) : 440
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/** The edge widget's window, flush with the right edge of `area`, its middle at `anchor` (a fraction of the screen's
 *  height; default a little below the middle, where a hand coming in from the side lands). */
export function edgeWidgetBounds(area: Rectangle, anchor: null | number = null): Rectangle {
  const { width, height } = EDGE_WINDOW
  const middle = area.y + area.height * (anchor ?? 0.55)

  return {
    x: area.x + area.width - width,
    y: Math.round(clamp(middle - height / 2, area.y, area.y + area.height - height)),
    width,
    height
  }
}

/** The tab's middle as a fraction of the screen's height, for the window at `y`. */
export function edgeAnchorFor(area: Rectangle, y: number): number {
  return clamp((y + EDGE_WINDOW.height / 2 - area.y) / area.height, 0, 1)
}

/** The bar opened from the edge tab: where it was last left if that is still on this screen, else the top right
 *  corner. A bar left near the right edge settles flush against it. */
export function edgeBarBounds(
  area: Rectangle,
  size: { height: number; width: number },
  saved: null | Rectangle
): Rectangle {
  const width = Math.min(saved?.width ?? size.width, area.width - 2 * SCREEN_GAP)
  const height = Math.min(saved?.height ?? size.height, area.height - 2 * SCREEN_GAP)
  const right = area.x + area.width - width - SCREEN_GAP
  const onScreen = saved && saved.x >= area.x - 40 && saved.x + 80 <= area.x + area.width && saved.y >= area.y - 40

  if (!onScreen) {
    return { x: right, y: area.y + SCREEN_GAP, width, height }
  }

  return {
    x: saved.x > right - 64 ? right : Math.round(clamp(saved.x, area.x + SCREEN_GAP, right)),
    y: Math.round(clamp(saved.y, area.y + SCREEN_GAP, area.y + area.height - height - SCREEN_GAP)),
    width,
    height
  }
}

/** The bar pinned to the right side: full height, `width` wide. */
export function sideBounds(area: Rectangle, width: number): Rectangle {
  const w = clamp(width, SIDE_WIDTH.min, Math.min(SIDE_WIDTH.max, area.width - 2 * SCREEN_GAP))

  return {
    x: area.x + area.width - w - SCREEN_GAP,
    y: area.y + SCREEN_GAP,
    width: w,
    height: area.height - 2 * SCREEN_GAP
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

/** The word beside the menu-bar icon: nothing while idle, so the icon stays as quiet as the system's own. */
export function trayTitle(status: HudAgentStatus): string {
  return { done: ' Done', idle: '', waiting: ' Needs you', working: ' Working' }[status]
}

export function trayTooltip(status: HudAgentStatus): string {
  return {
    done: 'Brain — reply ready',
    idle: 'Brain',
    waiting: 'Brain — waiting for you',
    working: 'Brain — working…'
  }[status]
}

/** The badge frames for a status: a dot that breathes while working, a dot while waiting, a tick when done. */
export function trayFrames(status: HudAgentStatus): HudTrayIcon[] {
  return {
    done: ['done'] as HudTrayIcon[],
    idle: ['idle'] as HudTrayIcon[],
    waiting: ['waiting'] as HudTrayIcon[],
    working: ['working1', 'working2', 'working3', 'working2'] as HudTrayIcon[]
  }[status]
}

const STATUS_WEIGHT: Record<HudAgentStatus, number> = { idle: 0, done: 1, working: 2, waiting: 3 }

/** What the icon shows when several windows report: whatever needs you most. */
export function strongestStatus(statuses: Iterable<HudAgentStatus>): HudAgentStatus {
  let strongest: HudAgentStatus = 'idle'

  for (const status of statuses) {
    if (STATUS_WEIGHT[status] > STATUS_WEIGHT[strongest]) {
      strongest = status
    }
  }

  return strongest
}

export interface HudLayoutActions {
  setMode: (mode: HudLayoutMode) => void
  toggleEdgeHoverOnly: () => void
  toggleEdgePopups: () => void
  resetLayout: () => void
  closeHud: () => void
}

const LAYOUTS: { label: (isMac: boolean) => string; mode: HudLayoutMode }[] = [
  { mode: 'bar', label: () => 'Floating bar' },
  { mode: 'side', label: () => 'Pinned to the right' },
  { mode: 'edge', label: () => 'Widget at the screen edge' },
  { mode: 'menubar', label: isMac => (isMac ? 'Only in the menu bar' : 'Only in the system tray') }
]

/** The HUD's right-click menu: layout first (the thing you came for), the edge widget's two options while it is
 *  the layout, then the window verbs. Native, so it is never clipped by the bar's small window. */
export function hudLayoutMenu(
  view: HudLayoutView,
  actions: HudLayoutActions,
  isMac: boolean
): MenuItemConstructorOptions[] {
  const edgeOptions: MenuItemConstructorOptions[] = [
    { type: 'separator' },
    { label: 'Show only on hover', type: 'checkbox', checked: view.edgeHoverOnly, click: actions.toggleEdgeHoverOnly },
    { label: 'Pop up replies', type: 'checkbox', checked: view.edgePopups, click: actions.toggleEdgePopups }
  ]

  return [
    { label: 'Cut', role: 'cut' },
    { label: 'Copy', role: 'copy' },
    { label: 'Paste', role: 'paste' },
    { type: 'separator' },
    ...LAYOUTS.map(({ label, mode }): MenuItemConstructorOptions => ({
      label: label(isMac),
      type: 'radio',
      checked: view.mode === mode,
      click: () => actions.setMode(mode)
    })),
    ...(view.mode === 'edge' ? edgeOptions : []),
    { type: 'separator' },
    { label: view.mode === 'edge' ? 'Reset widget position' : 'Reset position and size', click: actions.resetLayout },
    { label: 'Exit HUD', click: actions.closeHud }
  ]
}

export interface HudLayoutDeps {
  isMac: boolean
  prefsPath: string
  getHudWindow: () => BrowserWindow | null
  /** Where the bar lives in the `bar` layout (the saved bounds, or the default for the display). */
  barBounds: (area: Rectangle) => { height: number; width: number; x?: number; y?: number }
  openHud: () => void
  resetLayout: () => boolean
  closeHud: () => void
  log: (message: string) => void
}

/** How long the bar may be unfocused before the edge tab folds it back / the menu-bar bar hides. Long enough for a
 *  native menu or a file dialog to take focus and give it back. */
const LEAVE_DELAY_MS = 220
/** The working badge's breath. */
const FRAME_MS = 320
/** Settle after the pinned panel is resized or nudged, before it is put back against the right edge. */
const SIDE_SETTLE_MS = 260

export function createHudLayout(deps: HudLayoutDeps) {
  let prefs = readPrefs()
  let expanded = false
  let tray: null | Tray = null
  let leaveTimer: null | ReturnType<typeof setTimeout> = null
  let frameTimer: null | ReturnType<typeof setInterval> = null
  let sideTimer: null | ReturnType<typeof setTimeout> = null
  let shown: HudAgentStatus | null = null
  let drag: null | { cursorY: number; windowY: number } = null
  const statuses = new Map<number, HudAgentStatus>()
  const attached = new WeakSet<BrowserWindow>()
  const images = new Map<HudTrayIcon, Electron.NativeImage>()

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

  const update = (next: Partial<HudLayoutPrefs>) => {
    prefs = { ...prefs, ...next }
    savePrefs()
  }

  const view = (): HudLayoutView => ({
    edgeHoverOnly: prefs.edgeHoverOnly,
    edgePopups: prefs.edgePopups,
    expanded,
    mode: prefs.mode
  })

  const liveWindow = () => (win => (win && !win.isDestroyed() ? win : null))(deps.getHudWindow())
  const workArea = (win: BrowserWindow) => screen.getDisplayMatching(win.getBounds()).workArea
  const publish = () => liveWindow()?.webContents.send('hermes:hud:layout', view())

  const clearTimer = <T extends null | ReturnType<typeof setTimeout>>(timer: T) => {
    if (timer) {
      clearTimeout(timer)
    }

    return null
  }

  // ── the menu-bar icon ──────────────────────────────────────────────────────

  function image(icon: HudTrayIcon) {
    let cached = images.get(icon)

    if (!cached) {
      cached = nativeImage.createEmpty()

      for (const scaleFactor of [1, 2] as const) {
        cached.addRepresentation({
          scaleFactor,
          dataURL: `data:image/png;base64,${HUD_TRAY_ICONS[`${icon}@${scaleFactor}x`]}`
        })
      }

      cached.setTemplateImage(true)
      images.set(icon, cached)
    }

    return cached
  }

  function startTray() {
    if (tray && !tray.isDestroyed()) {
      return
    }

    try {
      tray = new Tray(image('idle'))
    } catch (error) {
      deps.log(`[hud-layout] no menu-bar icon on this desktop: ${(error as Error)?.message ?? error}`)
      tray = null

      return
    }

    tray.setIgnoreDoubleClickEvents(true)
    tray.on('click', () => onTrayClick())
    tray.on('right-click', () => tray?.popUpContextMenu(Menu.buildFromTemplate(trayMenu())))
    shown = null
    showStatus()
  }

  function trayMenu(): MenuItemConstructorOptions[] {
    const win = liveWindow()

    return [
      { label: win ? 'Show Brain bar' : 'Open Brain bar', click: () => onTrayClick(true) },
      { type: 'separator' },
      ...LAYOUTS.map(({ label, mode }): MenuItemConstructorOptions => ({
        label: label(deps.isMac),
        type: 'radio',
        checked: prefs.mode === mode,
        click: () => setMode(mode)
      })),
      ...(win ? ([{ type: 'separator' }, { label: 'Exit HUD', click: deps.closeHud }] as const) : [])
    ]
  }

  function showStatus() {
    const status = strongestStatus(statuses.values())

    if (!tray || tray.isDestroyed() || status === shown) {
      return
    }

    shown = status
    frameTimer = clearTimer(frameTimer)
    const frames = trayFrames(status)
    let frame = 0

    tray.setImage(image(frames[0]!))

    if (frames.length > 1) {
      frameTimer = setInterval(() => {
        frame = (frame + 1) % frames.length
        tray?.setImage(image(frames[frame]!))
      }, FRAME_MS)
    }

    if (deps.isMac) {
      tray.setTitle(trayTitle(status), { fontType: 'monospacedDigit' })
    }

    tray.setToolTip(trayTooltip(status))
  }

  function onTrayClick(forceShow = false) {
    const win = liveWindow()

    if (!win) {
      deps.openHud()

      return
    }

    if (prefs.mode === 'edge') {
      expand()
    } else if (prefs.mode === 'menubar') {
      dropFromTray(win, forceShow)
    } else {
      win.show()
      win.focus()
    }
  }

  function dropFromTray(win: BrowserWindow, forceShow: boolean) {
    leaveTimer = clearTimer(leaveTimer)

    if (!forceShow && win.isVisible() && win.isFocused()) {
      win.hide()

      return
    }

    const trayBounds = tray?.getBounds()

    if (trayBounds && trayBounds.width > 0) {
      const area = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y }).workArea
      place(win, barUnderTrayBounds(trayBounds, deps.barBounds(area), area))
    }

    win.show()
    win.focus()
  }

  // ── layouts ────────────────────────────────────────────────────────────────

  function place(win: BrowserWindow, bounds: Rectangle | { height: number; width: number; x?: number; y?: number }) {
    if (!applyHudResetBounds(win, bounds)) {
      deps.log('[hud-layout] could not move the HUD window')
    }
  }

  /** Put the window where the current layout wants it. `reveal`: also show it (false while it is being born
   *  hidden — its own first paint shows it). */
  function apply(win: BrowserWindow, reveal: boolean) {
    leaveTimer = clearTimer(leaveTimer)
    expanded = false

    if (prefs.mode === 'menubar' && tray) {
      win.hide()
      publish()

      return
    }

    if (prefs.mode === 'menubar') {
      update({ mode: 'bar' }) // no menu bar to live in on this desktop
    }

    const area = workArea(win)

    const bounds = {
      bar: () => (reveal ? deps.barBounds(area) : null), // a bar born as a bar is already in place
      edge: () => edgeWidgetBounds(area, prefs.edgeAnchor),
      menubar: () => null,
      side: () => sideBounds(area, prefs.sideWidth)
    }[prefs.mode]()

    if (bounds) {
      place(win, bounds)
    }

    if (reveal && !win.isVisible()) {
      win.showInactive()
    }

    publish()
  }

  function setMode(mode: HudLayoutMode) {
    rememberEdgeBar()
    update({ mode })
    const win = liveWindow()

    if (win) {
      apply(win, true)
    } else if (mode !== 'menubar') {
      deps.openHud()
    }
  }

  function setOption(key: 'edgeHoverOnly' | 'edgePopups') {
    update({ [key]: !prefs[key] })
    publish()
  }

  function expand() {
    const win = liveWindow()

    if (!win || prefs.mode !== 'edge') {
      return
    }

    leaveTimer = clearTimer(leaveTimer)

    if (!expanded) {
      const area = workArea(win)
      expanded = true
      place(win, edgeBarBounds(area, deps.barBounds(area), prefs.edgeBar))
      publish()
    }

    win.show()
    win.focus()
  }

  /** The bar opened from the tab was moved or resized: next time it opens there. */
  function rememberEdgeBar() {
    const win = liveWindow()

    if (win && prefs.mode === 'edge' && expanded) {
      update({ edgeBar: win.getBounds() })
    }
  }

  function collapse() {
    const win = liveWindow()

    if (!win || prefs.mode !== 'edge' || !expanded) {
      return
    }

    rememberEdgeBar()
    expanded = false
    place(win, edgeWidgetBounds(workArea(win), prefs.edgeAnchor))
    publish()
  }

  function resetLayout() {
    const win = liveWindow()

    if (prefs.mode === 'edge') {
      update({ edgeAnchor: null, edgeBar: null })

      if (win) {
        apply(win, true)
      }
    } else if (prefs.mode === 'side') {
      update({ sideWidth: DEFAULT_HUD_LAYOUT.sideWidth })

      if (win) {
        apply(win, true)
      }
    } else {
      deps.resetLayout()
    }
  }

  /** Moving the edge tab: main follows the cursor itself, so the renderer only says when. */
  function edgeDrag(phase: HudEdgeDragPhase) {
    const win = liveWindow()

    if (!win || prefs.mode !== 'edge' || expanded) {
      drag = null

      return
    }

    const cursorY = screen.getCursorScreenPoint().y
    const area = workArea(win)

    if (phase === 'begin') {
      drag = { cursorY, windowY: win.getBounds().y }

      return
    }

    if (!drag) {
      return
    }

    const y = clamp(drag.windowY + cursorY - drag.cursorY, area.y, area.y + area.height - EDGE_WINDOW.height)
    place(win, { ...edgeWidgetBounds(area), y: Math.round(y) })

    if (phase === 'end') {
      drag = null
      update({ edgeAnchor: edgeAnchorFor(area, y) })
    }
  }

  /** The pinned panel was resized or nudged: keep the new width, put it back against the right edge. */
  function settleSide() {
    sideTimer = clearTimer(sideTimer)

    if (prefs.mode !== 'side') {
      return
    }

    sideTimer = setTimeout(() => {
      sideTimer = null
      const win = liveWindow()

      if (!win || prefs.mode !== 'side') {
        return
      }

      const area = workArea(win)
      const target = sideBounds(area, win.getBounds().width)

      update({ sideWidth: target.width })

      const now = win.getBounds()

      if (now.x !== target.x || now.y !== target.y || now.width !== target.width || now.height !== target.height) {
        place(win, target)
      }
    }, SIDE_SETTLE_MS)
  }

  /** The bar lost focus: an edge bar folds back into its tab, a menu-bar bar goes away. */
  function onBlur() {
    leaveTimer = clearTimer(leaveTimer)

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
    resetLayout,
    closeHud: deps.closeHud
  }

  const fromHud = (sender: WebContents) => {
    const win = liveWindow()

    return win && sender === win.webContents ? win : null
  }

  ipcMain.on('hermes:hud:layout:get', event => {
    event.returnValue = view()
  })

  ipcMain.on('hermes:hud:context-menu', event => {
    const win = fromHud(event.sender)

    if (win) {
      Menu.buildFromTemplate(hudLayoutMenu(view(), actions, deps.isMac)).popup({ window: win })
    }
  })

  ipcMain.on('hermes:hud:expand', event => fromHud(event.sender) && expand())
  ipcMain.on('hermes:hud:collapse', event => fromHud(event.sender) && collapse())

  ipcMain.on('hermes:hud:edge-drag', (event, phase) => {
    if (fromHud(event.sender) && ['begin', 'move', 'end'].includes(phase)) {
      edgeDrag(phase as HudEdgeDragPhase)
    }
  })

  // Every window reports its own agent's state; the icon shows whatever needs you most.
  ipcMain.on('hermes:hud:status', (event, next) => {
    if (!['done', 'idle', 'waiting', 'working'].includes(next)) {
      return
    }

    const id = event.sender.id

    if (!statuses.has(id)) {
      event.sender.once('destroyed', () => {
        statuses.delete(id)
        showStatus()
      })
    }

    statuses.set(id, next as HudAgentStatus)
    showStatus()
  })

  return {
    /** The app is up: the Brain icon joins the menu bar for as long as it runs. */
    start: startTray,
    /** A new HUD window: put it where its layout wants it before it is first shown. */
    attach(win: BrowserWindow) {
      if (!attached.has(win)) {
        attached.add(win)
        win.on('blur', onBlur)
        win.on('focus', () => {
          leaveTimer = clearTimer(leaveTimer)
        })
        win.on('moved', settleSide)
        win.on('resized', () => {
          settleSide()
          rememberEdgeBar()
        })
      }

      apply(win, false)
    },
    /** The HUD went away. The icon stays; the edge bar's place is kept. */
    detach() {
      rememberEdgeBar()
      leaveTimer = clearTimer(leaveTimer)
      sideTimer = clearTimer(sideTimer)
      expanded = false
      drag = null
    },
    /** Only the floating bar remembers where it was parked; the other layouts place the window themselves. */
    persistsBounds: () => prefs.mode === 'bar',
    /** The HUD's first paint: show it — except a menu-bar HUD, which waits for its icon. */
    reveal(win: BrowserWindow) {
      if (!(prefs.mode === 'menubar' && tray)) {
        win.show()
        win.focus()
      }
    }
  }
}

/** The floating bar's saved bounds (`hud-state.json`), or null on a first run or an unreadable file. */
export function readSavedHudBounds(statePath: string): null | Rectangle {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'))

    return isRect(raw) ? raw : null
  } catch {
    return null // first run / unreadable — the caller falls back to the defaults
  }
}
