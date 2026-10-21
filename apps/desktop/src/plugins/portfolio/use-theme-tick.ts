/** Bumps when the app's theme changes, so a canvas chart can redraw in the new colours. */

import { useEffect, useState } from 'react'

export function useThemeTick(): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const observer = new MutationObserver(() => setTick(value => value + 1))
    observer.observe(document.documentElement, { attributeFilter: ['class', 'style', 'data-theme'], attributes: true })

    return () => observer.disconnect()
  }, [])

  return tick
}
