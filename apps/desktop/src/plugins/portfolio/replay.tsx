/**
 * Replay, as TradingView has it: press Replay, click the bar to start from (the chart shows the market as it
 * was then, indicators and all), then play it forward bar by bar or step one at a time, at a speed you pick.
 * Exit returns the chart to the present. State and timer here; the chart only gets fewer bars.
 */

import { cn, Codicon, Tip } from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'

import { COPY } from './copy'
import { TOP_BTN } from './studio-toolbar'

export type ReplayMode = 'off' | 'on' | 'pick'

/** Milliseconds between bars, for each speed. */
export const SPEEDS = [
  { id: '0.5x', ms: 2000 },
  { id: '1x', ms: 1000 },
  { id: '3x', ms: 330 },
  { id: '10x', ms: 100 }
] as const

export type SpeedId = (typeof SPEEDS)[number]['id']

export function useReplay(total: number) {
  const [mode, setMode] = useState<ReplayMode>('off')
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<SpeedId>('1x')
  const last = total - 1
  const ms = SPEEDS.find(item => item.id === speed)?.ms ?? 1000

  // A new symbol or interval is a different set of bars: back to the present.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    setMode('off')
    setPlaying(false)
  }, [total])

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (mode !== 'on' || !playing) {
      return
    }

    const timer = setInterval(() => {
      setIndex(current => {
        if (current >= last) {
          setPlaying(false)

          return current
        }

        return current + 1
      })
    }, ms)

    return () => clearInterval(timer)
  }, [last, mode, ms, playing])

  return {
    exit: () => {
      setMode('off')
      setPlaying(false)
    },
    index: mode === 'on' ? Math.min(index, last) : last,
    mode,
    playing,
    /** Starts the replay at a bar; paused, so the first step is the owner's. */
    pickAt: (at: number) => {
      setIndex(Math.max(0, Math.min(at, last)))
      setPlaying(false)
      setMode('on')
    },
    setSpeed,
    speed,
    start: () => {
      setPlaying(false)
      setMode('pick')
    },
    step: () => setIndex(current => Math.min(current + 1, last)),
    toggle: () => {
      if (index >= last) {
        setIndex(Math.max(last - 1, 0))
      }

      setPlaying(value => !value)
    }
  }
}

export type ReplayState = ReturnType<typeof useReplay>

/** The player over the bottom of the chart: play, step, speed, where it is, and exit. */
export function ReplayBar({ replay, time }: { replay: ReplayState; time: string }) {
  const copy = COPY.studio.replay
  return (
    <div
      className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-(--card-well-stroke) bg-(--card-surface) p-1 shadow-(--card-shadow)"
      data-portfolio-replay-bar=""
    >
      {replay.mode === 'pick' ? (
        <span className="px-3 text-[0.8125rem] text-(--ui-text-secondary)">{copy.pick}</span>
      ) : (
        <>
          <Tip label={replay.playing ? copy.pause : copy.play}>
            <button
              aria-label={replay.playing ? copy.pause : copy.play}
              className={cn(TOP_BTN, 'w-9 px-0')}
              onClick={replay.toggle}
              type="button"
            >
              <Codicon name={replay.playing ? 'debug-pause' : 'play'} size="1.0625rem" />
            </button>
          </Tip>
          <Tip label={copy.step}>
            <button aria-label={copy.step} className={cn(TOP_BTN, 'w-9 px-0')} onClick={replay.step} type="button">
              <Codicon name="debug-step-over" size="1.0625rem" />
            </button>
          </Tip>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-(--card-well-stroke)" />
          <div aria-label={copy.speed} className="flex" role="radiogroup">
            {SPEEDS.map(item => (
              <button
                aria-checked={replay.speed === item.id}
                className={cn(
                  'h-8 cursor-pointer rounded-md px-2 text-[0.75rem] font-medium tabular-nums',
                  replay.speed === item.id
                    ? 'bg-(--card-well) text-(--ui-text-primary)'
                    : 'text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
                )}
                key={item.id}
                onClick={() => replay.setSpeed(item.id)}
                role="radio"
                type="button"
              >
                {item.id}
              </button>
            ))}
          </div>
          <span className="px-2 text-[0.75rem] whitespace-nowrap text-(--ui-text-tertiary) tabular-nums">{time}</span>
        </>
      )}
      <span aria-hidden className="mx-0.5 h-5 w-px bg-(--card-well-stroke)" />
      <button className={cn(TOP_BTN, 'h-8 whitespace-nowrap')} onClick={replay.exit} type="button">
        {copy.exit}
      </button>
    </div>
  )
}
