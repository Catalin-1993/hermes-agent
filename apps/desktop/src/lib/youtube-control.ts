/**
 * The YouTube player's postMessage API, for a frame loaded with `enablejsapi=1`: read where it is
 * (`infoDelivery`) and drive it (`playVideo`, `pauseVideo`, `seekTo`). Only messages from the watched
 * frame's own window are read, so another frame cannot speak for it.
 */
export interface YoutubeInfo {
  currentTime?: number
  duration?: number
  /** 1 playing, 2 paused, 0 ended, 3 buffering, -1 unstarted, 5 cued. */
  playerState?: number
  title?: string
}

export const YOUTUBE_PLAYING = 1

export function postYoutubeCommand(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []): void {
  frame?.contentWindow?.postMessage(JSON.stringify({ args, event: 'command', func, id: 1 }), '*')
}

/** Reads an `infoDelivery` / `initialDelivery` frame into the fields the app uses; null for anything else. */
export function youtubeInfoFrom(data: unknown): null | YoutubeInfo {
  let message: unknown = data

  if (typeof data === 'string') {
    try {
      message = JSON.parse(data)
    } catch {
      return null
    }
  }

  const record = message as { event?: unknown; info?: unknown } | null

  if (!record || (record.event !== 'infoDelivery' && record.event !== 'initialDelivery')) {
    return null
  }

  const info = (record.info ?? {}) as Record<string, unknown>
  const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
  const videoData = info.videoData as { title?: unknown } | undefined

  return {
    currentTime: number(info.currentTime),
    duration: number(info.duration),
    playerState: number(info.playerState),
    title: typeof videoData?.title === 'string' ? videoData.title : undefined
  }
}

/** Starts listening to a player frame; returns the cleanup. The player only reports after a `listening`
 *  hello, repeated until it answers. */
export function watchYoutube(frame: HTMLIFrameElement, onInfo: (info: YoutubeInfo) => void): () => void {
  let answered = false

  const hello = () =>
    frame.contentWindow?.postMessage(JSON.stringify({ channel: 'widget', event: 'listening', id: 1 }), '*')

  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow) {
      return
    }

    const info = youtubeInfoFrom(event.data)

    if (info) {
      answered = true
      onInfo(info)
    }
  }

  window.addEventListener('message', onMessage)
  frame.addEventListener('load', hello)
  hello()

  const timer = window.setInterval(() => {
    if (answered) {
      window.clearInterval(timer)
    } else {
      hello()
    }
  }, 1000)

  return () => {
    window.clearInterval(timer)
    window.removeEventListener('message', onMessage)
    frame.removeEventListener('load', hello)
  }
}
