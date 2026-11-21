/** Brain: the HUD layout's shapes, shared by main (hud-layout.ts) and the renderer (no Electron imports). */

export type HudLayoutMode = 'bar' | 'edge' | 'menubar'
export type HudAgentStatus = 'done' | 'idle' | 'waiting' | 'working'

export interface HudLayoutPrefs {
  mode: HudLayoutMode
  /** Edge widget: tucked away until the pointer reaches the screen edge. */
  edgeHoverOnly: boolean
  /** Edge widget: a reply that lands while it is folded pops up beside it. */
  edgePopups: boolean
}

export interface HudLayoutView extends HudLayoutPrefs {
  /** Edge widget only: the bar is open beside the tab. */
  expanded: boolean
}
