/**
 * Brain: where a floating piece of chrome should sit, re-read as the layout under it moves.
 *
 * Some Brain chrome lives in a portal over the shell (the folder chip under the composer, the project name in the
 * top row) so it can sit where its own column would clip it. Its place is read from live elements: on every
 * resize of what `watch` names, on window resize, and on a slow interval for moves that resize nothing (a
 * neighbouring column coming or going). A read that lands on the same place keeps the old object, so nothing
 * re-renders while the layout is still.
 */

import { useEffect, useState } from 'react'

const SETTLE_MS = 400

/** `undefined` until the first read, then the place, or `null` where there is none. */
export function useTrackedSpot<T>(
  read: () => null | T,
  watch: () => readonly (Element | null)[]
): null | T | undefined {
  const [spot, setSpot] = useState<null | T | undefined>(undefined)

  // A passive effect: an ancestor's ref is attached only after a child's layout effects, and `watch` often
  // names an ancestor.
  useEffect(() => {
    let frame = 0
    let last = ''

    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const next = read()
        const key = JSON.stringify(next)

        if (key !== last) {
          last = key
          setSpot(next)
        }
      })
    }

    const observer = new ResizeObserver(update)

    for (const box of watch()) {
      if (box) {
        observer.observe(box)
      }
    }

    observer.observe(document.body)
    window.addEventListener('resize', update)
    const settle = window.setInterval(update, SETTLE_MS)
    update()

    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(settle)
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
    // `read` and `watch` are re-created each render; the effect reads the DOM, not their identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return spot
}
