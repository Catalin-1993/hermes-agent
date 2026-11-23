/**
 * Brain: the HUD is PARKED when you leave HUD mode, not torn down.
 *
 * The HUD is a full app renderer with its own gateway connection. Closing it used to destroy that renderer, so
 * every toggle booted the whole app again — the loading screen, a fresh connection, the session resumed from
 * scratch — which read as "the agent restarts" and stuttered. Now leaving HUD mode hides the window (after asking
 * its composer to save a half-typed draft, as a real close would), and entering again shows the same, already
 * connected window. A parked HUD is only reused for the profile it booted against; any other profile still gets a
 * fresh window (a renderer adopts its backend once, at boot).
 *
 * Also here: the Linux cursor feed, which only ever runs for a visible HUD.
 */

import { type BrowserWindow, screen } from 'electron'

import { cursorPointInWindow } from './hud-cursor'

/** The renderer's cue to save what a close would have saved (use-composer-draft listens for it). */
export const HUD_PARK_CHANNEL = 'hermes:hud:park'

interface Parked {
  profile: null | string
  win: BrowserWindow
}

export interface HudParking {
  /** Hide `win` for reuse, after its composer saves its draft. */
  park(win: BrowserWindow, profile: null | string): void
  /** The parked window for `profile`, now taken out of the lot — or null when there is none to reuse. */
  take(profile: null | string): BrowserWindow | null
  /** Forget `win` (it closed for good); true when it was the parked one. */
  release(win: BrowserWindow): boolean
}

export function createHudParking(): HudParking {
  let parked: Parked | null = null

  const usable = (entry: Parked | null): entry is Parked => Boolean(entry && !entry.win.isDestroyed())

  return {
    park(win, profile) {
      if (usable(parked) && parked.win !== win) {
        parked.win.destroy()
      }

      parked = { profile, win }

      if (!win.isDestroyed()) {
        win.webContents.send(HUD_PARK_CHANNEL)
        win.hide()
      }
    },
    take(profile) {
      const entry = parked

      if (!usable(entry)) {
        parked = null

        return null
      }

      if (entry.profile !== profile) {
        return null
      }

      parked = null

      return entry.win
    },
    release(win) {
      if (parked?.win !== win) {
        return false
      }

      parked = null

      return true
    }
  }
}

/**
 * Tell a Linux HUD where the cursor is (its click-through hit test needs it, and Linux stops forwarding moves while
 * the window ignores the mouse). Only while the HUD is visible, and only when the answer changes.
 */
export function startHudCursorPoll(win: BrowserWindow, pollMs: number): void {
  let last: null | string = null

  const timer = setInterval(() => {
    if (win.isDestroyed() || !win.isVisible()) {
      return
    }

    const point = cursorPointInWindow(screen.getCursorScreenPoint(), win.getBounds(), win.webContents.getZoomFactor())

    // Off-window is a real answer (it is what hands the mouse back), so it is
    // sent — once. Only an unchanged answer is dropped, to keep an idle cursor
    // from waking the renderer 16 times a second.
    const key = point ? `${Math.round(point.x)},${Math.round(point.y)}` : 'out'

    if (key === last) {
      return
    }

    last = key
    win.webContents.send('hermes:hud:cursor', point)
  }, pollMs)

  win.on('closed', () => clearInterval(timer))
}
