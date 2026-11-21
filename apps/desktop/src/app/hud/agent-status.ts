/**
 * Brain: the agent's state, told to main for the HUD's menu-bar icon (its title reads "🧠 Working…",
 * "✋ Needs you" or, for a moment after a reply, "✅ Done"). See electron/hud-layout.ts.
 */

import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { reportHudStatus } from '@/store/hud-layout'
import { $activeSessionAwaitingInput } from '@/store/prompts'
import { $busy } from '@/store/session'

/** How long "Done" stays beside the icon after a reply lands. */
const DONE_MS = 6000

export function useReportHudAgentStatus() {
  const busy = useStore($busy)
  const waiting = useStore($activeSessionAwaitingInput)
  const [done, setDone] = useState(false)

  // A turn that just ended: busy going from true to false.
  useEffect(() => {
    let previous = $busy.get()

    return $busy.listen(next => {
      if (previous && !next) {
        setDone(true)
      }

      previous = next
    })
  }, [])

  useEffect(() => {
    if (!done) {
      return
    }

    const timer = window.setTimeout(() => setDone(false), DONE_MS)

    return () => window.clearTimeout(timer)
  }, [done])

  useEffect(() => {
    reportHudStatus(waiting ? 'waiting' : busy ? 'working' : done ? 'done' : 'idle')
  }, [busy, done, waiting])
}
