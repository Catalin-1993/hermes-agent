import { type PointerEvent as ReactPointerEvent, useState } from 'react'

interface Box {
  h: number
  w: number
  x: number
  y: number
}

const ITEM = '[data-library-row],[data-library-card]'
// A press on these is theirs (open, drag, menus, fields), not the start of a rubber band.
const OWN_PRESS = `${ITEM},button,input,textarea,a,[role="menu"],[role="dialog"]`
const MIN_DRAG_PX = 4
const EDGE_PX = 32
const SCROLL_STEP_PX = 16

/** A point in the scroller's content space (what an absolutely placed child inside it uses). */
function contentPoint(scroller: HTMLElement, clientX: number, clientY: number) {
  const bounds = scroller.getBoundingClientRect()

  return { x: clientX - bounds.left + scroller.scrollLeft, y: clientY - bounds.top + scroller.scrollTop }
}

function itemsUnder(scroller: HTMLElement, box: Box): string[] {
  const bounds = scroller.getBoundingClientRect()

  return Array.from(scroller.querySelectorAll<HTMLElement>(ITEM)).flatMap(element => {
    const r = element.getBoundingClientRect()
    const left = r.left - bounds.left + scroller.scrollLeft
    const top = r.top - bounds.top + scroller.scrollTop
    const hit = left < box.x + box.w && left + r.width > box.x && top < box.y + box.h && top + r.height > box.y
    const id = element.dataset.libraryRow ?? element.dataset.libraryCard

    return hit && id ? [id] : []
  })
}

/**
 * Finder's rubber band: drag on empty space in the listing to select what the box touches (⌘ / ⇧ add
 * to the selection); a plain click on empty space clears it. The scroller must be `relative`; the
 * listing scrolls on its own near its top and bottom edges while dragging.
 */
export function useMarquee({
  onSelect,
  selected
}: {
  onSelect: (ids: Set<string>) => void
  selected: ReadonlySet<string>
}) {
  const [box, setBox] = useState<Box | null>(null)

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(OWN_PRESS)) {
      return
    }

    const scroller = event.currentTarget
    const base = event.metaKey || event.ctrlKey || event.shiftKey ? new Set(selected) : new Set<string>()
    const origin = contentPoint(scroller, event.clientX, event.clientY)
    let dragging = false

    const move = (e: PointerEvent) => {
      const bounds = scroller.getBoundingClientRect()

      if (e.clientY > bounds.bottom - EDGE_PX) {
        scroller.scrollTop += SCROLL_STEP_PX
      } else if (e.clientY < bounds.top + EDGE_PX) {
        scroller.scrollTop -= SCROLL_STEP_PX
      }

      const point = contentPoint(scroller, e.clientX, e.clientY)

      if (!dragging && Math.hypot(point.x - origin.x, point.y - origin.y) < MIN_DRAG_PX) {
        return
      }

      dragging = true

      const next = {
        h: Math.abs(point.y - origin.y),
        w: Math.abs(point.x - origin.x),
        x: Math.min(point.x, origin.x),
        y: Math.min(point.y, origin.y)
      }

      setBox(next)
      onSelect(new Set([...base, ...itemsUnder(scroller, next)]))
    }

    const up = () => {
      window.removeEventListener('pointermove', move)
      setBox(null)

      if (!dragging) {
        onSelect(base)
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  const overlay = box ? (
    <div
      aria-hidden
      className="pointer-events-none absolute z-30 rounded-[0.1875rem] border border-(--ui-accent) bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)]"
      style={{ height: box.h, left: box.x, top: box.y, width: box.w }}
    />
  ) : null

  return { onPointerDown, overlay }
}
