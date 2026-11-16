import { $narrowOverlayPaneIds } from '@/components/pane-shell/narrow-overlay-state'
import { findGroupOfPane } from '@/components/pane-shell/tree/model'
import { $layoutTree, $narrowViewport } from '@/components/pane-shell/tree/store'
import { $leftSideOpen, CHAT_SIDEBAR_PANE_ID, revealNarrowSidebar, toggleLeftSide } from '@/store/layout'

/** Opening the sessions sidebar by pointing at it. Pointing at the show-sidebar button opens it at once, and resting on
 *  the window's left edge for a moment does too: either opens THE sidebar — exactly what pressing the button does — and moving away closes it
 *  again. Nothing is drawn differently: a peek is the docked sidebar, for as long as the pointer stays near it.
 *  Pressing the button while it is open this way keeps it open.
 *
 *  A narrow window has no docked column: its sidebar is an overlay that the layout reveals on request. The button
 *  hover asks for that overlay the same way (and takes it back the same way), so a small window behaves like a wide one. */

/** How close to the window's left edge counts as "on" it. */
const EDGE_PX = 2
/** How long the pointer must rest on that edge. */
const EDGE_DWELL_MS = 800
/** How long after the pointer leaves before a peek closes, so it can travel from the button into the sidebar. */
const CLOSE_GRACE_MS = 260

let peeking = false
let dwellTimer: null | number = null
let closeTimer: null | number = null
/** Set by a press on the toggle: the pointer is still resting on it, and resting must not undo a
 *  deliberate close. Cleared the moment the pointer leaves the button, so hovering re-arms the peek. */
let suppressed = false
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

/** Is the sidebar currently shown as the narrow window's overlay (rather than docked)? */
const overlayShown = () => $narrowOverlayPaneIds.get().has(CHAT_SIDEBAR_PANE_ID)

/** Is the pointer within the sidebar: its column — or, on a narrow window, its overlay — from the window's top (the
 *  titlebar strip above it, where the show-sidebar button sits once it opens) down to its foot, or on something the
 *  sidebar opened over the page. */
const pointerInSidebar = () => {
  const rect = (rail() ?? document.querySelector<HTMLElement>('[data-narrow-overlay]'))?.getBoundingClientRect()

  if (rect && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= 0 && pointer.y <= rect.bottom) {
    return true
  }

  return Boolean(document.elementFromPoint(pointer.x, pointer.y)?.closest(FLOATING))
}

export const isSidebarPeeking = () => peeking

/** The flex track holding the docked rail. It is what carries the column's width, so floating the
 *  peek means taking THIS out of the row — the column alone would leave an empty 237px behind. */
function railTrack(): HTMLElement | null {
  return rail()?.parentElement ?? null
}

let peekTrack: HTMLElement | null = null
let trackWatch: MutationObserver | null = null

/** Move the peeked rail over the sheet: the track leaves the flex row, so the chat underneath keeps
 *  its full width and the sidebar paints on top of it — no squeeze, no reflow of the transcript. */
function floatPeekTrack() {
  const track = railTrack()

  if (!track) {
    return false
  }

  // Measure the docked width FIRST: once the track is out of the row, `width:auto` would stretch it
  // across the window. The rail publishes its own width as --panel-titlebar-left (it is what the pane
  // chrome aligns to), and that is live even before the column finishes mounting — the fallbacks only
  // cover the frame where nothing is laid out yet.
  const group = rail()
  const fromPanel = parseFloat(group ? getComputedStyle(group).getPropertyValue('--panel-titlebar-left') : '') || 0
  const laidOut = parseFloat(track.style.minWidth) || 0
  const measured = track.getBoundingClientRect().width
  const width = Math.round(fromPanel || laidOut || (measured > 40 ? measured : 240))

  peekTrack = track
  track.style.setProperty('--peek-width', `${width}px`)
  track.setAttribute('data-sidebar-peek', '')

  return true
}

/** Put it back the way the tree laid it out (the attribute and the width are all this ever added). */
function settlePeekTrack() {
  trackWatch?.disconnect()
  trackWatch = null

  const track = peekTrack

  peekTrack = null

  if (track) {
    track.removeAttribute('data-sidebar-peek')
    track.style.removeProperty('--peek-width')
  }
}

/** Root the rail as soon as the tree mounts it — a MutationObserver callback runs before the frame
 *  paints, so the column is never seen docked-and-squeezing first. */
function watchForPeekTrack() {
  trackWatch?.disconnect()

  if (floatPeekTrack()) {
    return
  }

  trackWatch = new MutationObserver(() => {
    if (peeking && floatPeekTrack()) {
      trackWatch?.disconnect()
      trackWatch = null
    }
  })
  trackWatch.observe(document.body, { childList: true, subtree: true })
}

/** Open the sidebar as a peek, when it is closed on a window wide enough to dock it. */
export function startSidebarPeek() {
  closeTimer = clear(closeTimer)
  dwellTimer = clear(dwellTimer)

  if (suppressed || peeking) {
    return
  }

  // A narrow window: ask for the overlay, the way the button's own press does. Nothing to float or measure.
  if ($narrowViewport.get()) {
    if (!overlayShown() && revealNarrowSidebar('open')) {
      peeking = true
    }

    return
  }

  if ($leftSideOpen.get()) {
    return
  }

  // The tree still mounts and opens the rail exactly as the button does — only the track it mounts
  // into is floated, so a peek never moves what is beside it. A press decides whether it docks.
  peeking = true
  watchForPeekTrack()
  toggleLeftSide()
}

function endSidebarPeek() {
  closeTimer = null

  if (peeking && !pointerInSidebar()) {
    peeking = false

    if ($narrowViewport.get()) {
      revealNarrowSidebar('close')

      return
    }

    if ($leftSideOpen.get()) {
      toggleLeftSide()
    }

    // After the tree has folded the column away, so it is never seen docked for a frame.
    queueMicrotask(settlePeekTrack)
  }
}

/** The pointer is on the show-sidebar button: the sidebar opens as a peek right away. */
export const restOnSidebarButton = startSidebarPeek

/** The pointer left the button (or the window): close the peek shortly, unless it has reached the sidebar. */
export function leaveSidebarPeek() {
  // Leaving the button is what re-arms hovering; a press only silences the gesture it ended.
  suppressed = false

  if (peeking && closeTimer === null) {
    closeTimer = window.setTimeout(endSidebarPeek, CLOSE_GRACE_MS)
  }
}

/** A press on the toggle just happened: keep the pointer resting on it from re-opening what the press
 *  closed. The re-arm happens when the pointer leaves (see leaveSidebarPeek). */
export function holdSidebarPeekOff() {
  suppressed = true
  dwellTimer = clear(dwellTimer)
  closeTimer = clear(closeTimer)
}

/** The button was pressed: a peek becomes the ordinary open sidebar. True when there was a peek to keep. */
export function pinSidebarPeek(): boolean {
  const was = peeking

  peeking = false
  closeTimer = clear(closeTimer)

  // Pressing is the one gesture that docks the rail for real, so the track rejoins the row and the
  // sheet makes room — the behaviour the button has always had.
  settlePeekTrack()

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
      settlePeekTrack()
    }
  })

  // The narrow overlay went away some other way (Escape, the button, leaving it): the peek is over too.
  // The overlay's effect empties the set and refills it in one flush when it opens, so judge the settled state.
  const stopOnOverlayClose = $narrowOverlayPaneIds.listen(() => {
    queueMicrotask(() => {
      if (peeking && $narrowViewport.get() && !overlayShown()) {
        peeking = false
        closeTimer = clear(closeTimer)
      }
    })
  })

  window.addEventListener('pointermove', onMove, { passive: true })
  document.documentElement.addEventListener('mouseleave', onWindowLeave)

  return () => {
    window.removeEventListener('pointermove', onMove)
    document.documentElement.removeEventListener('mouseleave', onWindowLeave)
    stopOnClose()
    stopOnOverlayClose()
    dwellTimer = clear(dwellTimer)
    closeTimer = clear(closeTimer)
    peeking = false
    settlePeekTrack()
  }
}
