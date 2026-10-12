import { describe, expect, it } from 'vitest'

import { fitRatio, fullRect, moveRect, resizeRect } from './image-crop'

const bounds = { h: 300, w: 400 }

describe('image crop', () => {
  it('fits the largest centred rect of a shape', () => {
    expect(fitRatio(bounds, 1)).toEqual({ h: 300, w: 300, x: 50, y: 0 })
    expect(fitRatio(bounds, 16 / 9).w).toBe(400)
  })

  it('moves as a whole and stops at the image edge', () => {
    expect(moveRect({ h: 100, w: 100, x: 10, y: 10 }, 500, -50, bounds)).toEqual({ h: 100, w: 100, x: 300, y: 0 })
  })

  it('resizes free from an edge or a corner, never past the image or under the minimum', () => {
    const start = { h: 100, w: 100, x: 100, y: 100 }

    expect(resizeRect(start, 'e', 40, 999, bounds, null)).toEqual({ h: 100, w: 140, x: 100, y: 100 })
    expect(resizeRect(start, 'nw', -999, -999, bounds, null)).toEqual({ h: 200, w: 200, x: 0, y: 0 })
    expect(resizeRect(start, 'w', 999, 0, bounds, null).w).toBe(24)
  })

  it('keeps its shape from a corner when a ratio is set, within the image', () => {
    const start = { h: 100, w: 100, x: 100, y: 100 }
    const grown = resizeRect(start, 'se', 60, 0, bounds, 1)

    expect(grown).toEqual({ h: 160, w: 160, x: 100, y: 100 })
    // Far past the bottom: limited by the room below the anchor, still square.
    expect(resizeRect(start, 'se', 999, 0, bounds, 1)).toEqual({ h: 200, w: 200, x: 100, y: 100 })
    // From the top-left the opposite corner stays where it was.
    const up = resizeRect(start, 'nw', -50, 0, bounds, 1)

    expect([up.x + up.w, up.y + up.h]).toEqual([200, 200])
  })

  it('starts on the whole image', () => {
    expect(fullRect(bounds)).toEqual({ h: 300, w: 400, x: 0, y: 0 })
  })
})
