/**
 * Brain: the folder chip sits UNDER the composer, at its left edge, without moving the composer.
 *
 * Under the composer there is only its bottom padding inside the chat column, then the window's status
 * bar, which runs under every column and shows its items only on hover. The chip therefore lives in a
 * portal pinned to the composer dock (see lib/tracked-spot.ts), centred in the strip between the composer
 * and the window's bottom edge, above the status bar. It is always shown; its backing covers the status
 * items behind it, so the bar is "interrupted" there when it comes up on hover, and pointing at the chip
 * does not bring the bar up.
 */

import type { RefObject } from 'react'
import { createPortal } from 'react-dom'

import { useTrackedSpot } from '@/lib/tracked-spot'

import { WorkspaceChip } from './workspace-chip'

/** The composer surface's bottom padding inside the dock (`--composer-shell-pad-block-end`). */
const COMPOSER_PAD_PX = 10
/** The chip's height (Button size `xs`). */
const CHIP_PX = 24
/** The dock's own side inset, so the chip lines up with the composer's edge as it did above it. */
const INSET_PX = 5

function spotUnder(dock: HTMLElement | null) {
  const rect = dock?.getBoundingClientRect()

  if (!rect?.width) {
    return null
  }

  const bandTop = rect.bottom - COMPOSER_PAD_PX
  const band = Math.max(CHIP_PX, window.innerHeight - bandTop)

  return { left: Math.round(rect.left + INSET_PX), top: Math.round(bandTop + (band - CHIP_PX) / 2) }
}

export function WorkspaceChipUnder({ cwd, dock }: { cwd: string; dock: RefObject<HTMLElement | null> }) {
  const spot = useTrackedSpot(
    () => spotUnder(dock.current),
    () => [
      dock.current,
      dock.current?.offsetParent ?? null,
      dock.current?.closest('[data-slot="composer-bounds"]') ?? null
    ]
  )

  if (!spot) {
    return null
  }

  return createPortal(
    <div
      className="fixed z-40 flex h-6 items-center rounded-md bg-(--ui-chat-surface-background) [-webkit-app-region:no-drag]"
      data-slot="workspace-chip-under"
      style={spot}
    >
      <WorkspaceChip cwd={cwd} />
    </div>,
    document.body
  )
}
