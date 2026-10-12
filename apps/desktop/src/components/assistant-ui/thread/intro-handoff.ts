import { useLayoutEffect, useRef, useState } from 'react'

/** How long the transcript's settle-in runs after the splash leaves. Matches
 *  `thread-handoff` in intro.css; the flag outlives it so the animation is
 *  never cut short by the flag dropping mid-flight. */
export const INTRO_HANDOFF_MS = 600

/**
 * True for a moment after the empty-chat splash gives way to a conversation,
 * so the transcript can settle in where the avatar stood instead of popping.
 *
 * A layout effect on purpose: the flag must land in the same frame the splash
 * leaves, or the first message paints at full opacity for a frame and then
 * blinks back to transparent when the fade starts.
 */
export function useIntroHandoff(introShown: boolean): boolean {
  const wasShown = useRef(introShown)
  const [handoff, setHandoff] = useState(false)

  useLayoutEffect(() => {
    const left = wasShown.current && !introShown
    wasShown.current = introShown

    if (!left) {
      setHandoff(false)

      return
    }

    setHandoff(true)
    const timer = window.setTimeout(() => setHandoff(false), INTRO_HANDOFF_MS)

    return () => window.clearTimeout(timer)
  }, [introShown])

  return handoff
}
