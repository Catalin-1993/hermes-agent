/**
 * Brain: the HUD window's layout as main reports it (floating bar, screen-edge widget, menu-bar icon), and the
 * agent's status the other way, for the menu-bar icon's title. Main owns the layout (it moves the window); this
 * window only mirrors it. Outside the HUD window everything here stays at the bar and does nothing.
 */

import { atom, computed } from 'nanostores'

import type { HudAgentStatus, HudLayoutView } from '../../electron/hud-layout-types'

const BAR: HudLayoutView = { edgeHoverOnly: true, edgePopups: true, expanded: false, mode: 'bar' }

const bridge = () => window.hermesDesktop?.hud?.layout

function initial(): HudLayoutView {
  try {
    return bridge()?.get() ?? BAR
  } catch {
    return BAR
  }
}

export const $hudLayout = atom<HudLayoutView>(initial())

/** The edge widget folded into its tab: the bar is out of sight and the tab stands in for it. */
export const $hudEdgeFolded = computed($hudLayout, view => view.mode === 'edge' && !view.expanded)

bridge()?.onChange(view => $hudLayout.set(view))

export const openHudLayoutMenu = () => bridge()?.openMenu()
export const expandHudEdge = () => bridge()?.expand()

let lastStatus: HudAgentStatus | null = null

export function reportHudStatus(status: HudAgentStatus) {
  if (status !== lastStatus) {
    lastStatus = status
    bridge()?.setStatus(status)
  }
}

/** Whether this window has a layout menu to open (only the HUD window does). */
export const hudLayoutMenuAvailable = () => Boolean(bridge())
