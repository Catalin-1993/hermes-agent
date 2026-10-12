export interface Rect {
  h: number
  w: number
  x: number
  y: number
}

export type Handle = 'e' | 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'w'

export interface Bounds {
  h: number
  w: number
}

/** Smallest a crop may get, in the same units as the rect. */
export const MIN_CROP = 24

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/** The largest rect of width:height `ratio`, centred in `bounds`. */
export function fitRatio(bounds: Bounds, ratio: number): Rect {
  const w = Math.min(bounds.w, bounds.h * ratio)
  const h = w / ratio

  return { h, w, x: (bounds.w - w) / 2, y: (bounds.h - h) / 2 }
}

export const fullRect = (bounds: Bounds): Rect => ({ h: bounds.h, w: bounds.w, x: 0, y: 0 })

/** Dragging the crop as a whole: it follows the pointer and stops at the image's edge. */
export function moveRect(start: Rect, dx: number, dy: number, bounds: Bounds): Rect {
  return { ...start, x: clamp(start.x + dx, 0, bounds.w - start.w), y: clamp(start.y + dy, 0, bounds.h - start.h) }
}

/**
 * Dragging one handle. Free: that edge (or both of a corner's) follows the pointer. With a `ratio`
 * (width ÷ height) only corners resize, from the opposite corner, keeping the shape.
 */
export function resizeRect(
  start: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  bounds: Bounds,
  ratio: null | number
): Rect {
  const right = start.x + start.w
  const bottom = start.y + start.h

  if (ratio === null) {
    let [x, y, x2, y2] = [start.x, start.y, right, bottom]

    if (handle.includes('w')) {
      x = clamp(start.x + dx, 0, right - MIN_CROP)
    }

    if (handle.includes('e')) {
      x2 = clamp(right + dx, start.x + MIN_CROP, bounds.w)
    }

    if (handle.includes('n')) {
      y = clamp(start.y + dy, 0, bottom - MIN_CROP)
    }

    if (handle.includes('s')) {
      y2 = clamp(bottom + dy, start.y + MIN_CROP, bounds.h)
    }

    return { h: y2 - y, w: x2 - x, x, y }
  }

  const west = handle.includes('w')
  const north = handle.includes('n')
  // The corner opposite the handle stays put.
  const anchorX = west ? right : start.x
  const anchorY = north ? bottom : start.y

  const room = {
    h: north ? anchorY : bounds.h - anchorY,
    w: west ? anchorX : bounds.w - anchorX
  }

  const wanted = start.w + (west ? -dx : dx)
  const w = clamp(wanted, MIN_CROP, Math.min(room.w, room.h * ratio))
  const h = w / ratio

  return { h, w, x: west ? anchorX - w : anchorX, y: north ? anchorY - h : anchorY }
}
