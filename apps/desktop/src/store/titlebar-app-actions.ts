import { type Codec, persistentAtom } from '@/lib/persisted'
import { DEFAULT_INTERFACE_MODE, type InterfaceMode, shownInMode, type Tiered } from '@/store/interface-mode'

export type TitlebarAppActionsSide = 'left' | 'right'

const STORAGE_KEY = 'hermes.desktop.titlebarAppActions'

/** Right is the original titlebar: Layout / HUD stay off the tab strip. */
export const TITLEBAR_APP_ACTIONS_DEFAULT: TitlebarAppActionsSide = 'right'

const codec: Codec<TitlebarAppActionsSide> = {
  decode: raw => (raw === 'left' || raw === 'right' ? raw : TITLEBAR_APP_ACTIONS_DEFAULT),
  encode: value => value
}

export const $titlebarAppActionsSide = persistentAtom<TitlebarAppActionsSide>(
  STORAGE_KEY,
  TITLEBAR_APP_ACTIONS_DEFAULT,
  codec
)

export function setTitlebarAppActionsSide(side: TitlebarAppActionsSide) {
  $titlebarAppActionsSide.set(side)
}

/**
 * The fixed titlebar tools and which of them are instrumentation. ONE table:
 * the buttons spread their entry to render, the width reservation counts the
 * same entries, so a tool Simple hides also releases the space it held.
 * Layout never carries a tier — it is the way back. (Settings is not a titlebar tool: its door is
 * the sidebar's footer, and Swap sidebar sides is also a row in Settings → Appearance.)
 */
export const TITLEBAR_FIXED_TOOLS = {
  'flip-panes': { tier: 'advanced' },
  hud: { tier: 'advanced' },
  layout: {},
  notifications: {},
  'right-sidebar': { tier: 'advanced' },
  sidebar: {}
} satisfies Record<string, Tiered>

export type TitlebarFixedToolId = keyof typeof TITLEBAR_FIXED_TOOLS

/** The app actions that follow `side`; the sidebar toggle and back / forward are always left. */
const APP_ACTION_IDS: readonly TitlebarFixedToolId[] = ['layout', 'hud']
const RIGHT_EDGE_IDS: readonly TitlebarFixedToolId[] = ['layout', 'hud', 'flip-panes', 'notifications', 'right-sidebar']

/**
 * Whether a tool stands on the titlebar's right edge right now. The notifications bell and the
 * right-sidebar toggle are always there; everything else on that edge belongs to the open sidebar, so
 * a closed one leaves the bell and the button that opens it. App actions on the left (`side`) are not
 * the right edge's business.
 */
export function showsOnRightEdge(id: TitlebarFixedToolId, side: TitlebarAppActionsSide, rightSideOpen: boolean) {
  if (id === 'right-sidebar' || id === 'notifications') {
    return true
  }

  if (id === 'flip-panes') {
    return rightSideOpen
  }

  return APP_ACTION_IDS.includes(id) && side === 'right' && rightSideOpen
}

/** Button counts for the two titlebar clusters, for the mode that is rendering them. */
export function titlebarAppActionsClusterCounts(
  side: TitlebarAppActionsSide,
  leftExtras = 0,
  rightExtras = 0,
  mode: InterfaceMode = DEFAULT_INTERFACE_MODE,
  rightSideOpen = true
): { left: number; right: number } {
  const shown = shownInMode(mode)
  const edge = 3 // sidebar toggle + back + forward
  const appActions = side === 'left' ? APP_ACTION_IDS.filter(id => shown(TITLEBAR_FIXED_TOOLS[id])).length : 0

  const rightEdge = RIGHT_EDGE_IDS.filter(
    id => shown(TITLEBAR_FIXED_TOOLS[id]) && showsOnRightEdge(id, side, rightSideOpen)
  ).length

  return { left: edge + appActions + leftExtras, right: rightEdge + rightExtras }
}
