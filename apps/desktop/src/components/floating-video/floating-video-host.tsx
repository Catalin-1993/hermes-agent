import { useStore } from '@nanostores/react'
import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { setStatusbarItemGroup } from '@/app/contrib/panes'
import { youtubePlayerSrc } from '@/components/assistant-ui/embeds/providers/youtube'
import { YOUTUBE_ALLOW } from '@/components/assistant-ui/embeds/youtube-embed'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { ArrowBackUp, GripHorizontal, Maximize, Minimize, Minus, X } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { watchYoutube, YOUTUBE_PLAYING } from '@/lib/youtube-control'
import {
  $floatingMinimized,
  $floatingPlacement,
  $floatingPlayback,
  $floatingVideo,
  closeFloatingVideo,
  type FloatingCorner,
  type FloatingPlacement,
  returnFloatingVideo,
  setFloatingFrame,
  setFloatingMinimized,
  setFloatingPlacement
} from '@/store/floating-video'
import { isBrowserWindow, isHudWindow } from '@/store/windows'

import { FloatingVideoStatus } from './floating-video-status'

/** Player widths. Height follows 16:9 plus the bar. */
const WIDTH = { large: 480, small: 336 } as const
const BAR = 34
/** Space kept from the window edges: the title bar above, the status bar and composer below. */
const MARGIN = { bottom: 48, side: 16, top: 52 }
/** Dropped this close to a corner, the player pins to it. */
const SNAP = 96

const CORNER_STYLE: Record<FloatingCorner, { bottom?: number; left?: number; right?: number; top?: number }> = {
  'bottom-left': { bottom: MARGIN.bottom, left: MARGIN.side },
  'bottom-right': { bottom: MARGIN.bottom, right: MARGIN.side },
  'top-left': { left: MARGIN.side, top: MARGIN.top },
  'top-right': { right: MARGIN.side, top: MARGIN.top }
}

const TOOL_CLASS =
  'grid size-6 cursor-pointer place-items-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--card-well) hover:text-(--ui-text-primary)'

/** The corner a drop lands in, when it lands close enough to one. */
function cornerFor(x: number, y: number, width: number, height: number): FloatingCorner | null {
  const left = x < SNAP
  const right = x + width > window.innerWidth - SNAP
  const top = y < MARGIN.top + SNAP
  const bottom = y + height > window.innerHeight - MARGIN.bottom - SNAP

  if ((left || right) && (top || bottom)) {
    return `${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}` as FloatingCorner
  }

  return null
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high))

/**
 * The floating video player (store/floating-video.ts), mounted once for the whole window. It stays on screen
 * while the chat scrolls: drag it by its bar anywhere, drop it near a corner to pin it there, make it larger
 * or smaller, minimize it — it keeps playing off screen, with its controls in the status bar — or send it
 * back into the chat at the moment it reached.
 */
function FloatingVideoWindow() {
  const { t } = useI18n()
  const copy = t.floatingVideo
  const video = useStore($floatingVideo)
  const minimized = useStore($floatingMinimized)
  const placement = useStore($floatingPlacement)
  const frame = useRef<HTMLIFrameElement>(null)
  const [drag, setDrag] = useState<null | { x: number; y: number }>(null)
  const width = WIDTH[placement.size]
  const height = Math.round((width * 9) / 16) + BAR

  // The address is fixed for the life of one floating video: changing it would reload the player.
  const src = useMemo(
    () => (video ? youtubePlayerSrc(video.embedUrl, { autoplay: true, start: video.startAt }) : ''),
    [video]
  )

  useEffect(() => {
    const element = frame.current

    if (!element || !video) {
      return
    }

    setFloatingFrame(element)

    const stop = watchYoutube(element, info => {
      const current = $floatingPlayback.get()

      $floatingPlayback.set({
        currentTime: info.currentTime ?? current.currentTime,
        duration: info.duration ?? current.duration,
        playing: info.playerState === undefined ? current.playing : info.playerState === YOUTUBE_PLAYING
      })
    })

    return () => {
      stop()
      setFloatingFrame(null)
    }
  }, [video])

  // Minimized, the player's controls move into the status bar; on screen it has its own.
  useEffect(() => {
    if (!video || !minimized) {
      return
    }

    setStatusbarItemGroup('floating-video', [{ id: 'floating-video', render: () => <FloatingVideoStatus /> }], 'right')

    return () => setStatusbarItemGroup('floating-video', [], 'right')
  }, [minimized, video])

  if (!video) {
    return null
  }

  const box = drag
    ? { left: drag.x, top: drag.y }
    : placement.corner
      ? CORNER_STYLE[placement.corner]
      : {
          left: clamp(placement.x, MARGIN.side, window.innerWidth - width - MARGIN.side),
          top: clamp(placement.y, MARGIN.top, window.innerHeight - height - MARGIN.bottom)
        }

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) {
      return
    }

    const rect = event.currentTarget.parentElement!.getBoundingClientRect()
    const offset = { x: event.clientX - rect.left, y: event.clientY - rect.top }

    // Keeps the drag when the pointer outruns the bar; the window listeners below carry it either way.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // No capture for this pointer: the drag still follows the window listeners.
    }

    setDrag({ x: rect.left, y: rect.top })

    const move = (next: PointerEvent) =>
      setDrag({
        x: clamp(next.clientX - offset.x, 0, window.innerWidth - width),
        y: clamp(next.clientY - offset.y, 0, window.innerHeight - height)
      })

    const end = (last: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      const x = clamp(last.clientX - offset.x, 0, window.innerWidth - width)
      const y = clamp(last.clientY - offset.y, 0, window.innerHeight - height)
      const corner = cornerFor(x, y, width, height)
      const next: FloatingPlacement = { ...placement, corner, x, y }

      setFloatingPlacement(next)
      setDrag(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  const resize = () => setFloatingPlacement({ ...placement, size: placement.size === 'small' ? 'large' : 'small' })

  return createPortal(
    <div
      aria-hidden={minimized || undefined}
      aria-label={video.title}
      className={cn(
        'fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-(--card-stroke) bg-(--card-surface) shadow-[0_24px_60px_-20px_rgba(11,21,48,0.45)]',
        drag ? 'cursor-grabbing select-none' : 'transition-[left,top,right,bottom,width] duration-200',
        minimized && 'pointer-events-none opacity-0'
      )}
      data-floating-video={minimized ? 'minimized' : 'shown'}
      role="dialog"
      style={minimized ? { height, left: -10_000, top: 0, width } : { ...box, height, width }}
    >
      <div
        className="flex shrink-0 cursor-grab items-center gap-1.5 border-b border-(--card-stroke) px-2.5 active:cursor-grabbing"
        onPointerDown={startDrag}
        style={{ height: BAR }}
        title={copy.dragHint}
      >
        <GripHorizontal className="size-3.5 shrink-0 text-(--ui-text-tertiary)" />
        <span className="min-w-0 flex-1 truncate text-[0.75rem] font-medium text-(--ui-text-secondary)">
          {video.title}
        </span>
        <Tip label={placement.size === 'small' ? copy.larger : copy.smaller}>
          <button
            aria-label={placement.size === 'small' ? copy.larger : copy.smaller}
            className={TOOL_CLASS}
            onClick={resize}
            type="button"
          >
            {placement.size === 'small' ? <Maximize className="size-3.5" /> : <Minimize className="size-3.5" />}
          </button>
        </Tip>
        <Tip label={copy.minimize}>
          <button
            aria-label={copy.minimize}
            className={TOOL_CLASS}
            onClick={() => setFloatingMinimized(true)}
            type="button"
          >
            <Minus className="size-3.5" />
          </button>
        </Tip>
        <Tip label={copy.bringBack}>
          <button aria-label={copy.bringBack} className={TOOL_CLASS} onClick={returnFloatingVideo} type="button">
            <ArrowBackUp className="size-3.5" />
          </button>
        </Tip>
        <Tip label={copy.close}>
          <button aria-label={copy.close} className={TOOL_CLASS} onClick={closeFloatingVideo} type="button">
            <X className="size-3.5" />
          </button>
        </Tip>
      </div>
      <div className="relative min-h-0 flex-1 bg-black">
        <iframe
          allow={YOUTUBE_ALLOW}
          allowFullScreen
          className={cn('absolute inset-0 size-full border-0', drag && 'pointer-events-none')}
          ref={frame}
          referrerPolicy="no-referrer"
          src={src}
          title={video.title}
        />
      </div>
    </div>,
    document.body
  )
}

/** Mounted once in the main window; the HUD and browser windows have no chat to pop a video out of. */
export function FloatingVideoHost() {
  return isHudWindow() || isBrowserWindow() ? null : <FloatingVideoWindow />
}
