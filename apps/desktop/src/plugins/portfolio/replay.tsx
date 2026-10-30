/**
 * Replay, as TradingView has it: press Replay, click the bar to start from (the chart shows the market as it
 * was then, indicators and all), then play it forward bar by bar or step one at a time, at a speed you pick.
 * Exit returns the chart to the present. State and timer here; the chart only gets fewer bars.
 */

import { cn, Codicon, Tip } from '@hermes/plugin-sdk'
import { type PointerEvent as ReactPointer, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'

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
   
  useEffect(() => {
    setMode('off')
    setPlaying(false)
  }, [total])

   
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

/** Where the player first appears: at the top of the chart, right after the legend's "BTC / USDT · 1h",
 *  over the figures that follow it (open, high, low, close), as far right as it needs. */
function useBarPlace(bar: RefObject<HTMLDivElement | null>, mode: string) {
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const element = bar.current
    const area = element?.offsetParent as HTMLElement | null

    if (!element || !area) {
      return
    }

    const title = area.querySelector('[data-portfolio-legend-title]')?.getBoundingClientRect()
    const box = area.getBoundingClientRect()
    const start = title ? title.right - box.left + 16 : 12
    const room = area.clientWidth - element.offsetWidth - 84

    setPlace(current => current ?? { left: Math.max(8, Math.min(start, room)), top: 6 })
    // the pick prompt and the full player are different widths: keep the place, only the first time sets it
  }, [bar, mode])

  return [place, setPlace] as const
}

/** The player over the chart: play, step, speed, where it is, and exit. It opens at the top, after the
 *  legend's title, and is moved by its grip to wherever the owner wants it. */
export function ReplayBar({ replay, time }: { replay: ReplayState; time: string }) {
  const copy = COPY.studio.replay
  const bar = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useBarPlace(bar, replay.mode)

  const drag = (event: ReactPointer<HTMLElement>) => {
    const element = bar.current
    const area = element?.offsetParent as HTMLElement | null

    if (!element || !area || !place) {
      return
    }

    event.preventDefault()
    const grip = event.currentTarget
    grip.setPointerCapture(event.pointerId)
    const from = { x: event.clientX, y: event.clientY, ...place }

    const move = (next: PointerEvent) => {
      setPlace({
        left: Math.max(0, Math.min(from.left + next.clientX - from.x, area.clientWidth - element.offsetWidth)),
        top: Math.max(0, Math.min(from.top + next.clientY - from.y, area.clientHeight - element.offsetHeight))
      })
    }

    const stop = () => {
      grip.removeEventListener('pointermove', move)
      grip.removeEventListener('pointerup', stop)
      grip.removeEventListener('pointercancel', stop)
    }

    grip.addEventListener('pointermove', move)
    grip.addEventListener('pointerup', stop)
    grip.addEventListener('pointercancel', stop)
  }

  return (
    <div
      className="absolute z-20 flex items-center gap-1 rounded-xl border border-(--card-well-stroke) bg-(--card-surface) p-1 shadow-(--card-shadow)"
      data-portfolio-replay-bar=""
      ref={bar}
      style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? 'visible' : 'hidden' }}
    >
      <Tip label={copy.move}>
        <span
          aria-label={copy.move}
          className="grid h-8 w-5 cursor-grab touch-none place-items-center text-(--ui-text-quaternary) hover:text-(--ui-text-secondary) active:cursor-grabbing"
          data-portfolio-replay-grip=""
          onPointerDown={drag}
          role="button"
          tabIndex={-1}
        >
          <Codicon name="gripper" size="0.9rem" />
        </span>
      </Tip>
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
