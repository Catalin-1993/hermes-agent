/**
 * Brain: the HUD window's layout as main reports it (floating bar, pinned to the right, screen-edge widget, menu
 * bar only), and the agent's status the other way, for the Brain icon in the menu bar. Main owns the layout (it
 * moves the window); this window only mirrors it. Every window reports its agent's status.
 */

import { atom, computed } from 'nanostores'

import type { HudAgentStatus, HudEdgeDragPhase, HudLayoutView } from '../../electron/hud-layout-types'

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
export const dragHudEdge = (phase: HudEdgeDragPhase) => bridge()?.edgeDrag(phase)

let lastStatus: HudAgentStatus | null = null

export function reportHudStatus(status: HudAgentStatus) {
  if (status !== lastStatus) {
    lastStatus = status
    bridge()?.setStatus(status)
  }
}
