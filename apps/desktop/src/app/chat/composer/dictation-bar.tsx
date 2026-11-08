/**
 * The recording bar: while a dictation records it takes the controls' place on the right of the composer row —
 * × (drop the take), a live waveform with the elapsed time, ✓ (stop and put the words in the draft) and the send
 * arrow (stop, then send). The waveform is the take's recent loudness, newest on the right of the drawn bars, with
 * dots for the time still to fill, so it moves with the voice.
 */

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import { GHOST_ICON_BTN, PRIMARY_ICON_BTN } from './control-classes'
import type { DictationControls } from './hooks/use-voice-recorder'

export interface DictationBarControls extends DictationControls {
  /** Stop, put the words in the draft, then send it. */
  send: () => void
}

/** Whether a take is recording or transcribing, so the bar stands in for the controls. */
export const dictationShowing = (dictation?: DictationBarControls): dictation is DictationBarControls =>
  Boolean(dictation && dictation.state.status !== 'idle')

/** How many samples the waveform holds; the rest of the strip is dots until they fill. */
export const WAVE_SAMPLES = 20
const SAMPLE_MS = 90

function elapsedLabel(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))

  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, '0')}`
}

/** The take's recent loudness, sampled from the meter while recording. */
function useLevelHistory(level: number, recording: boolean) {
  const [history, setHistory] = useState<number[]>([])
  const levelRef = useRef(level)
  levelRef.current = level

  useEffect(() => {
    if (!recording) {
      return
    }

    setHistory([])

    const timer = window.setInterval(
      () => setHistory(current => [...current, levelRef.current].slice(-WAVE_SAMPLES)),
      SAMPLE_MS
    )

    return () => window.clearInterval(timer)
  }, [recording])

  return history
}

function Waveform({ history }: { history: number[] }) {
  const dots = Math.max(0, WAVE_SAMPLES - history.length)

  return (
    <div aria-hidden="true" className="flex h-6 items-center gap-[3px]" data-dictation-wave="">
      {history.map((value, index) => (
        <span
          className="w-[3px] rounded-full bg-foreground transition-[height] duration-75 ease-out"
          key={index}
          style={{ height: `${Math.round(18 + Math.min(1, Math.max(0, value)) * 82)}%` }}
        />
      ))}
      {Array.from({ length: dots }, (_, index) => (
        <span className="size-[3px] rounded-full bg-(--ui-text-quaternary)" key={`dot-${index}`} />
      ))}
    </div>
  )
}

export function DictationBar({ dictation }: { dictation: DictationBarControls }) {
  const { t } = useI18n()
  const c = t.composer
  const { state } = dictation
  const recording = state.status === 'recording'
  const history = useLevelHistory(state.level, recording)

  return (
    <div
      aria-live="polite"
      className="flex min-w-0 items-center gap-(--composer-control-gap)"
      data-dictation-bar={state.status}
      role="status"
    >
      <Tip label={t.common.cancel} placement="control">
        <Button
          aria-label={t.common.cancel}
          className={cn(GHOST_ICON_BTN, 'rounded-full')}
          disabled={!recording}
          onClick={dictation.cancel}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Codicon name="close" size="0.875rem" />
        </Button>
      </Tip>
      <div className="flex min-w-0 items-center gap-2 px-1">
        <Waveform history={history} />
        <span className="font-mono text-[0.75rem] text-(--ui-text-tertiary) tabular-nums">
          {recording ? elapsedLabel(state.elapsedSeconds) : c.transcribing}
        </span>
      </div>
      <Tip label={c.stopDictation} placement="control">
        <Button
          aria-label={c.stopDictation}
          className={cn(GHOST_ICON_BTN, 'rounded-full bg-(--ui-bg-quaternary)')}
          disabled={!recording}
          onClick={() => dictation.finish()}
          size="icon"
          type="button"
          variant="ghost"
        >
          {recording ? (
            <Codicon name="check" size="0.875rem" />
          ) : (
            <Codicon className="animate-spin" name="loading" size="0.875rem" />
          )}
        </Button>
      </Tip>
      <Tip label={c.send} placement="control">
        <Button
          aria-label={c.send}
          className={PRIMARY_ICON_BTN}
          disabled={!recording}
          onClick={dictation.send}
          type="button"
        >
          <Codicon name="arrow-up" size="0.875rem" />
        </Button>
      </Tip>
    </div>
  )
}
