import { type RefObject, useEffect, useState } from 'react'

/** The composer reports its height while the page is still settling; after this the reading only ever shrinks. */
const SETTLE_MS = 1200

/**
 * The composer's height as the splash should see it: its resting height, steady while the composer grows.
 * Dictation and a voice conversation put a panel above the bar, and the splash sizes itself and centres
 * against that height — so the artwork swelled and jumped every time voice started. The probe (a hidden box
 * as tall as the live `--composer-measured-height`) is read through a ResizeObserver; the first moments
 * follow it, then only a smaller reading replaces the held one, and a resize of the window starts over.
 * Returns px, or null until the first reading.
 */
export function useSteadyComposerHeight(probe: RefObject<HTMLElement | null>): null | number {
  const [held, setHeld] = useState<null | number>(null)

  useEffect(() => {
    const element = probe.current

    if (!element) {
      return
    }

    let startedAt = performance.now()
    let value: null | number = null

    const read = () => {
      const live = element.getBoundingClientRect().height

      if (live <= 0) {
        return
      }

      if (value === null || performance.now() - startedAt < SETTLE_MS || live < value) {
        value = live
        setHeld(live)
      }
    }

    const observer = new ResizeObserver(read)

    const restart = () => {
      startedAt = performance.now()
      value = null
      read()
    }

    observer.observe(element)
    window.addEventListener('resize', restart)
    read()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', restart)
    }
  }, [probe])

  return held
}
