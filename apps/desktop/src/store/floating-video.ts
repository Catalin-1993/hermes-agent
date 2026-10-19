import { atom } from 'nanostores'

/**
 * The floating video player: one video lifted out of the chat into a window that stays on screen while the
 * conversation scrolls. It can be dragged anywhere, pinned to a corner, or minimized — then it keeps
 * playing and its controls sit in the status bar. Only one video floats at a time.
 */
export interface FloatingVideo {
  /** The player's embed address (see `embeds/providers/youtube.ts`). */
  embedUrl: string
  /** Which inline player it came from, so that player shows "playing in the floating window". */
  key: string
  /** Seconds to resume from. */
  startAt: number
  title: string
}

export type FloatingCorner = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
export type FloatingSize = 'large' | 'small'

export interface FloatingPlacement {
  /** Pinned to a corner (it follows the corner when the window resizes), or null for a free position. */
  corner: FloatingCorner | null
  size: FloatingSize
  /** Free position, px from the window's top-left. */
  x: number
  y: number
}

export interface FloatingPlayback {
  currentTime: number
  duration: number
  playing: boolean
}

const PLACEMENT_KEY = 'hermes-floating-video-placement-v1'
const DEFAULT_PLACEMENT: FloatingPlacement = { corner: 'bottom-right', size: 'small', x: 0, y: 0 }

function readPlacement(): FloatingPlacement {
  try {
    const raw = JSON.parse(localStorage.getItem(PLACEMENT_KEY) || 'null') as Partial<FloatingPlacement> | null

    if (!raw || typeof raw !== 'object') {
      return DEFAULT_PLACEMENT
    }

    const corners: FloatingCorner[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right']

    return {
      corner:
        raw.corner === null ? null : corners.includes(raw.corner as FloatingCorner) ? raw.corner! : 'bottom-right',
      size: raw.size === 'large' ? 'large' : 'small',
      x: Number.isFinite(raw.x) ? Number(raw.x) : 0,
      y: Number.isFinite(raw.y) ? Number(raw.y) : 0
    }
  } catch {
    return DEFAULT_PLACEMENT
  }
}

export const $floatingVideo = atom<FloatingVideo | null>(null)
export const $floatingMinimized = atom(false)
export const $floatingPlacement = atom<FloatingPlacement>(readPlacement())
export const $floatingPlayback = atom<FloatingPlayback>({ currentTime: 0, duration: 0, playing: false })

/** Where an inline player should pick up after the floating one was sent back to it: key → seconds. */
export const $returnedVideo = atom<null | { key: string; time: number }>(null)

export function setFloatingPlacement(next: FloatingPlacement): void {
  $floatingPlacement.set(next)

  try {
    localStorage.setItem(PLACEMENT_KEY, JSON.stringify(next))
  } catch {
    // A blocked storage only loses the remembered position.
  }
}

export function popOutVideo(video: FloatingVideo): void {
  $returnedVideo.set(null)
  $floatingPlayback.set({ currentTime: video.startAt, duration: 0, playing: true })
  $floatingMinimized.set(false)
  $floatingVideo.set(video)
}

export function setFloatingMinimized(minimized: boolean): void {
  $floatingMinimized.set(minimized)
}

export function closeFloatingVideo(): void {
  $floatingVideo.set(null)
  $floatingMinimized.set(false)
}

/** Back into the chat, at the moment it had reached. */
export function returnFloatingVideo(): void {
  const video = $floatingVideo.get()

  if (video) {
    $returnedVideo.set({ key: video.key, time: $floatingPlayback.get().currentTime })
  }

  closeFloatingVideo()
}

/** The live player frame, so the status bar controls can drive it. Set by the floating host. */
let floatingFrame: HTMLIFrameElement | null = null

export function setFloatingFrame(frame: HTMLIFrameElement | null): void {
  floatingFrame = frame
}

export function getFloatingFrame(): HTMLIFrameElement | null {
  return floatingFrame
}
