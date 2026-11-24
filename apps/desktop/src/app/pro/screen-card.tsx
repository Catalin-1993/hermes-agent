/**
 * Brain (Pro Mode): "What Brain sees" — the main agent's own screen, like a Bot's screen. A live frame of the
 * display the pointer is on, refreshed every few seconds while the panel is open and the view is on (off until the
 * person turns it on), and "Share screenshot", which attaches one picture to the message being written. Nothing
 * here goes to the agent by itself: the view is for the person, the picture rides only the next message sent.
 */

import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  $brainScreen,
  brainScreenAvailable,
  brainScreenFrame,
  openBrainScreenPermission,
  refreshBrainScreen,
  setBrainScreenEnabled,
  type ShareOutcome,
  shareScreenWithBrain
} from '@/store/brain-screen'

import { Card } from './pro-ui'

export const FRAME_EVERY_MS = 4000

/** The latest frame while `on`, refreshed on a timer and only while the window is in front of the person. */
function useLiveFrame(on: boolean): null | string {
  const [frame, setFrame] = useState<null | string>(null)

  useEffect(() => {
    if (!on) {
      setFrame(null)

      return
    }

    let alive = true

    const tick = () => {
      if (document.visibilityState === 'visible') {
        void brainScreenFrame().then(next => alive && next && setFrame(next))
      }
    }

    tick()
    const timer = setInterval(tick, FRAME_EVERY_MS)

    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [on])

  return frame
}

export function ScreenCard() {
  const { t } = useI18n()
  const copy = t.pro.screen
  const status = useStore($brainScreen)
  const [sharing, setSharing] = useState(false)
  const [outcome, setOutcome] = useState<null | ShareOutcome>(null)
  const on = Boolean(status?.enabled)
  const blocked = status?.permission === 'needed'
  const frame = useLiveFrame(on && !blocked)

  useEffect(() => {
    void refreshBrainScreen()
  }, [])

  if (!brainScreenAvailable()) {
    return null
  }

  const share = async () => {
    setSharing(true)
    setOutcome(null)

    try {
      const result = await shareScreenWithBrain()
      setOutcome(result)

      if (result === 'shared') {
        triggerHaptic('crisp')
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <Card
      label={copy.title}
      trailing={
        <span className="flex items-center gap-2 normal-case">
          <span className={cn('flex items-center gap-1', on ? 'text-(--ui-green,#3fb950)' : undefined)}>
            <span
              className={cn('size-1.5 rounded-full', on ? 'animate-pulse bg-current' : 'bg-(--ui-text-tertiary)')}
            />
            {on ? copy.live : copy.off}
          </span>
          <Switch
            aria-label={copy.toggle}
            checked={on}
            onCheckedChange={value => void setBrainScreenEnabled(value)}
            size="xs"
          />
        </span>
      }
    >
      <div
        className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-(--ui-bg-elevated,var(--ui-bg-editor)) ring-1 ring-(--ui-stroke-tertiary)"
        data-slot="pro-screen-frame"
      >
        {frame ? (
          <img alt={copy.frameAlt} className="size-full object-cover" src={frame} />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center">
            <Codicon className="text-(--ui-text-tertiary)" name="device-desktop" size="1.25rem" />
            <p className="text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">
              {blocked ? copy.permission : on ? copy.loading : copy.offHint}
            </p>
            {blocked && (
              <Button
                className="mt-1 h-6 px-2 text-xs"
                onClick={() => void openBrainScreenPermission()}
                size="sm"
                variant="secondary"
              >
                {copy.openSettings}
              </Button>
            )}
          </div>
        )}
      </div>

      <Button
        className="h-8 w-full gap-1.5 rounded-lg"
        disabled={sharing}
        onClick={() => void share()}
        size="sm"
        variant="secondary"
      >
        {sharing ? <Loader2 className="size-3.5 animate-spin" /> : <Codicon name="device-camera" size="0.875rem" />}
        {copy.share}
      </Button>
      <p className="text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">
        {outcome ? copy.outcome[outcome] : copy.hint}
      </p>
    </Card>
  )
}
