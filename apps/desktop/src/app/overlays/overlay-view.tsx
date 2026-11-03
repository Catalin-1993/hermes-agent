import { type CSSProperties, type ReactNode, useEffect } from 'react'

import { useRailRight } from '@/app/overlays/use-rail-right'
import { TITLEBAR_HEIGHT } from '@/app/shell/titlebar'
import { TitlebarIcon } from '@/app/shell/titlebar-icon'
import { Button } from '@/components/ui/button'
import { translateNow } from '@/i18n'
import { ESCAPE_PRIORITY, isTopEscapeLayer, pushEscapeLayer } from '@/lib/escape-layers'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { $sidebarOpen, setSidebarOpen } from '@/store/layout'

/** Below this width the sidebar would cover the page, so the page takes the whole window there. */
const DOCK_MIN_WIDTH = 768

// Shared top clearance for overlay content that sits *beside* the floating
// close button (which is absolute at `0.1875rem + titlebar/2`, -translate-y-1/2,
// so it costs no layout space): a Panel's header and the split layout's left
// sidebar links. They ride up next to the X on the same line across every
// overlay (settings, system, agents, cron, …) — change it here, not per-surface.
// Main content sits *under* the X (top-right) and keeps its own taller pad.
export const OVERLAY_TOP_CLEARANCE = 'pt-[calc(var(--titlebar-height)/2-0.4375rem)]'

interface OverlayViewProps {
  children: ReactNode
  onClose: () => void
  closeLabel?: string
  contentClassName?: string
  /** Chrome pinned to the card's top edge, horizontally centered and riding
   *  the border half-in half-out (e.g. the Settings search pill). Rendered
   *  beside the card, not inside it — the card clips its own overflow. */
  edgeBadge?: ReactNode
  headerContent?: ReactNode
  rootClassName?: string
  /** Controls rendered on the close button's row, to its left. They ride the
   *  titlebar strip, so keep them titlebar-sized and quiet. */
  titlebarActions?: ReactNode
  /** False: the page takes the whole window and the app's sidebar steps aside (Settings, which brings its own
   *  menu in the sidebar's colours). True (default): it opens beside the sidebar. */
  besideSidebar?: boolean
}

export function OverlayView({
  children,
  onClose,
  closeLabel = translateNow('common.close'),
  contentClassName,
  edgeBadge,
  headerContent,
  rootClassName,
  titlebarActions,
  besideSidebar = true
}: OverlayViewProps) {
  const closeOverlay = () => {
    triggerHaptic('close')
    onClose()
  }

  // Esc dismisses every OverlayView-based overlay. Nested Radix dialogs
  // stop propagation themselves, so opening (e.g.) the model picker inside
  // Settings still closes the picker first instead of the underlying overlay.
  useEffect(() => {
    const releaseLayer = pushEscapeLayer(ESCAPE_PRIORITY.overlay)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !isTopEscapeLayer(ESCAPE_PRIORITY.overlay)) {
        return
      }

      event.preventDefault()
      triggerHaptic('close')
      onClose()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      releaseLayer()
    }
  }, [onClose])

  const rail = useRailRight()
  const railRight = besideSidebar ? rail : 0

  // These pages open beside the left sidebar, as a page of the app: the sidebar comes out if it was folded away
  // (on a window wide enough to hold both). Block body: an effect's return value is its cleanup.
  useEffect(() => {
    if (besideSidebar && !$sidebarOpen.get() && window.innerWidth >= DOCK_MIN_WIDTH) {
      setSidebarOpen(true)
    }
  }, [besideSidebar])

  return (
    <div
      className="fixed inset-y-0 right-0 z-50"
      // A whole-window page: its menu clears the window controls and wears the sidebar's gradient (shell-surfaces.css).
      data-overlay-fullbleed={besideSidebar ? undefined : ''}
      // Every OverlayView-based page (settings, command-center, agents, cron,
      // profiles, star map, …) covers the chat while the composer stays mounted
      // beneath it. This marker tells `composerFocusBlockedBySurface` to stand
      // the global type-to-focus / soft `/` / Enter down, so keystrokes don't
      // leak into the hidden composer (and the page's own bare-key shortcuts,
      // e.g. star map's Space, keep working).
      data-overlay-surface=""
      role="presentation"
      // Window-level chrome: these pages always clear the real titlebar. The
      // contrib shell zeroes --titlebar-height for CONTENT areas (panes sit
      // below its in-flow title bar), and CSS vars inherit through the DOM —
      // so a fixed page mounted inside a zone would read 0. Re-pin the real
      // height at the root. `left` follows the sidebar's edge as it resizes.
      style={
        {
          '--titlebar-height': `${TITLEBAR_HEIGHT}px`,
          // A whole-window page keeps its menu as wide as the sidebar it covers (however wide that is dragged).
          ...(besideSidebar || rail === 0 ? {} : { '--overlay-rail-width': `${rail}px` }),
          left: railRight
        } as CSSProperties
      }
    >
      <div className="relative h-full min-h-0">
        <div
          className={cn(
            'relative flex h-full min-h-0 flex-col overflow-hidden bg-(--ui-chat-surface-background)',
            railRight > 0 && 'border-l border-(--ui-stroke-tertiary)',
            rootClassName
          )}
          // Marks the card as a RAISED surface for window glass: while the field
          // behind it thins to show the desktop, this card stays near-opaque
          // (see the [data-glass-raised] rules in styles.css). Inert otherwise.
          data-glass-raised=""
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[calc(var(--titlebar-height)+0.1875rem)] [-webkit-app-region:drag]">
            {headerContent && (
              <div className="pointer-events-auto absolute left-1/2 top-[calc(0.5rem+var(--titlebar-height)/2)] -translate-x-1/2 -translate-y-1/2 [-webkit-app-region:no-drag]">
                {headerContent}
              </div>
            )}

            <div className="pointer-events-auto absolute right-[var(--titlebar-tools-right,0.75rem)] top-[calc(0.1875rem+var(--titlebar-height)/2)] flex -translate-y-1/2 items-center gap-1.5 [-webkit-app-region:no-drag]">
              {titlebarActions}

              <Button
                aria-label={closeLabel}
                className="text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground"
                onClick={closeOverlay}
                size="icon-titlebar"
                variant="ghost"
              >
                <TitlebarIcon name="close" />
              </Button>
            </div>
          </div>

          {/* No top padding here: the split-layout columns own their own
              titlebar clearance so their backgrounds run flush to the card top
              (otherwise the card surface shows as a gap above the sidebar). */}
          <div className={cn('min-h-0 flex flex-1 flex-col', contentClassName)}>{children}</div>
        </div>

        {/* Sibling of the card, not a child: the card clips its own overflow.
            The badge sits centred on the titlebar strip, level with the close button. */}
        {edgeBadge && (
          <div className="absolute left-1/2 top-[calc(0.1875rem+var(--titlebar-height)/2)] z-20 -translate-x-1/2 -translate-y-1/2">
            {edgeBadge}
          </div>
        )}
      </div>
    </div>
  )
}
