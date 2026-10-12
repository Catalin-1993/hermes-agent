import { findGroupOfPane } from '@/components/pane-shell/tree/model'
import { $layoutTree, $narrowViewport } from '@/components/pane-shell/tree/store'
import { $leftSideOpen, toggleLeftSide } from '@/store/layout'

/** Opening the sessions sidebar by pointing at it. Resting on the show-sidebar button for a second and a half, or on the window's
 *  left edge for a moment, opens THE sidebar — exactly what pressing the button does — and moving away closes it
 *  again. Nothing is drawn differently: a peek is the docked sidebar, for as long as the pointer stays near it.
 *  Pressing the button while it is open this way keeps it open. */

/** How close to the window's left edge counts as "on" it. */
const EDGE_PX = 2
/** How long the pointer must rest on that edge. */
const EDGE_DWELL_MS = 800
/** How long after the pointer leaves before a peek closes, so it can travel from the button into the sidebar. */
const CLOSE_GRACE_MS = 260
/** How long the pointer must rest on the show-sidebar button before it opens. A shorter pass opens nothing. */
const BUTTON_DWELL_MS = 1500

let peeking = false
let dwellTimer: null | number = null
let buttonTimer: null | number = null
let closeTimer: null | number = null
const pointer = { x: -1, y: -1 }

const clear = (timer: null | number) => {
  if (timer !== null) {
    window.clearTimeout(timer)
  }

  return null
}

/** The sessions sidebar's column, when it is docked. */
function rail(): HTMLElement | null {
  const tree = $layoutTree.get()
  const id = tree ? findGroupOfPane(tree, 'sessions')?.id : undefined

  return id ? document.querySelector<HTMLElement>(`[data-tree-group="${CSS.escape(id)}"]:not([data-pane-host])`) : null
}

/** Whatever floats above the page from the sidebar — its menus, popovers, dialogs — counts as the sidebar. */
const FLOATING = '[data-radix-popper-content-wrapper], [role="menu"], [role="dialog"], [role="listbox"]'

/** Is the pointer within the sidebar: its column from the window's top (the titlebar strip above it, where the
 *  show-sidebar button sits once it opens) down to its foot, or on something the sidebar opened over the page. */
const pointerInSidebar = () => {
  const rect = rail()?.getBoundingClientRect()

  if (rect && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= 0 && pointer.y <= rect.bottom) {
    return true
  }

  return Boolean(document.elementFromPoint(pointer.x, pointer.y)?.closest(FLOATING))
}

export const isSidebarPeeking = () => peeking

/** Open the sidebar as a peek, when it is closed on a window wide enough to dock it. */
export function startSidebarPeek() {
  closeTimer = clear(closeTimer)
  dwellTimer = clear(dwellTimer)

  if (peeking || $leftSideOpen.get() || $narrowViewport.get()) {
    return
  }

  // The same call the button makes, so a peek opens exactly what a press would (the left column folds and
  // unfolds through the tree, not through the sidebar's own open flag).
  peeking = true
  toggleLeftSide()
}

function endSidebarPeek() {
  closeTimer = null

  if (peeking && !pointerInSidebar()) {
    peeking = false

    if ($leftSideOpen.get()) {
      toggleLeftSide()
    }
  }
}

/** The pointer rests on the show-sidebar button: only after a moment there does the sidebar open as a peek. */
export function restOnSidebarButton() {
  buttonTimer ??= window.setTimeout(() => {
    buttonTimer = null
    startSidebarPeek()
  }, BUTTON_DWELL_MS)
}

/** The pointer left the button (or the window): close the peek shortly, unless it has reached the sidebar. */
export function leaveSidebarPeek() {
  buttonTimer = clear(buttonTimer)

  if (peeking && closeTimer === null) {
    closeTimer = window.setTimeout(endSidebarPeek, CLOSE_GRACE_MS)
  }
}

/** The button was pressed: a peek becomes the ordinary open sidebar. True when there was a peek to keep. */
export function pinSidebarPeek(): boolean {
  const was = peeking

  peeking = false
  buttonTimer = clear(buttonTimer)
  closeTimer = clear(closeTimer)

  return was
}

/** Watch the pointer for the left-edge rest and for leaving a peek. Returns the way to stop. */
export function installSidebarPeek(): () => void {
  const onMove = (event: PointerEvent) => {
    pointer.x = event.clientX
    pointer.y = event.clientY

    if (peeking) {
      if (pointerInSidebar()) {
        closeTimer = clear(closeTimer)
      } else {
        leaveSidebarPeek()
      }

      return
    }

    if (event.clientX <= EDGE_PX && event.buttons === 0 && !$leftSideOpen.get() && !$narrowViewport.get()) {
      dwellTimer ??= window.setTimeout(startSidebarPeek, EDGE_DWELL_MS)
    } else {
      dwellTimer = clear(dwellTimer)
    }
  }

  const onWindowLeave = (event: MouseEvent) => {
    if (!event.relatedTarget) {
      dwellTimer = clear(dwellTimer)
      leaveSidebarPeek()
    }
  }

  // The sidebar closed some other way (⌘B, its own button): whatever was peeking is over.
  const stopOnClose = $leftSideOpen.listen(open => {
    if (!open) {
      peeking = false
      closeTimer = clear(closeTimer)
    }
  })

  window.addEventListener('pointermove', onMove, { passive: true })
  document.documentElement.addEventListener('mouseleave', onWindowLeave)

  return () => {
    window.removeEventListener('pointermove', onMove)
    document.documentElement.removeEventListener('mouseleave', onWindowLeave)
    stopOnClose()
    dwellTimer = clear(dwellTimer)
    buttonTimer = clear(buttonTimer)
    closeTimer = clear(closeTimer)
    peeking = false
  }
}
