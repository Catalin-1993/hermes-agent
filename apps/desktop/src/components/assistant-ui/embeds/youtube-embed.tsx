'use client'

import { useStore } from '@nanostores/react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { ArrowBackUp, PictureInPicture } from '@/lib/icons'
import { watchYoutube } from '@/lib/youtube-control'
import { $floatingVideo, $returnedVideo, popOutVideo, returnFloatingVideo } from '@/store/floating-video'

import { youtubePlayerSrc } from './providers/youtube'
import { useIsDark } from './use-is-dark'

export const YOUTUBE_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen'

const CORNER_BUTTON_CLASS =
  'grid size-7 cursor-pointer place-items-center rounded-lg border border-white/15 bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/75'

interface YouTubeEmbedProps {
  autoplay?: boolean
  embedUrl: string
  title?: string
}

// A plain iframe with YouTube's own player and error UI, plus one tool on hover: pop the video out into the
// floating player, which carries on from the same moment while the chat scrolls.
export default function YouTubeEmbedRenderer({ autoplay, embedUrl, title = 'YouTube' }: YouTubeEmbedProps) {
  const { t } = useI18n()
  const copy = t.floatingVideo
  const isDark = useIsDark()
  const key = `${useId()}|${embedUrl}`
  const floating = useStore($floatingVideo)
  const returned = useStore($returnedVideo)
  const frame = useRef<HTMLIFrameElement>(null)
  // Where this player has reached: written by the player's own reports, read when it is popped out.
  const [position] = useState(() => ({ time: 0 }))
  const [label, setLabel] = useState(title)
  const isFloatingHere = floating?.key === key
  const resumeAt = returned?.key === key ? returned.time : 0

  const src = useMemo(
    () => youtubePlayerSrc(embedUrl, { autoplay: autoplay || resumeAt > 0, start: resumeAt }),
    [autoplay, embedUrl, resumeAt]
  )

  useEffect(() => {
    const element = frame.current

    if (!element || isFloatingHere) {
      return
    }

    return watchYoutube(element, info => {
      if (info.currentTime !== undefined) {
        position.time = info.currentTime
      }

      if (info.title) {
        setLabel(info.title)
      }
    })
  }, [isFloatingHere, position, src])

  if (isFloatingHere) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-[inherit] bg-(--card-well)">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <PictureInPicture className="size-6 text-(--ui-text-tertiary)" />
          <span className="text-[0.8125rem] text-(--ui-text-secondary)">{copy.playingFloating}</span>
          <button
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-(--card-stroke) bg-(--card-surface) px-3.5 text-[0.8125rem] text-(--ui-text-primary) transition-colors hover:bg-(--card-well)"
            onClick={returnFloatingVideo}
            type="button"
          >
            <ArrowBackUp className="size-3.5" />
            {copy.bringBack}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group/yt relative">
      <iframe
        allow={YOUTUBE_ALLOW}
        allowFullScreen
        className="block aspect-video w-full border-0 bg-transparent"
        loading="lazy"
        // The app's own address (the dev server, file://) must not reach YouTube: many videos — music above
        // all — refuse to play for a local embedder ("This video is unavailable"). With no Referer of its own,
        // the main process gives the player a real site's (electron/embed-referer.ts), and they play.
        ref={frame}
        referrerPolicy="no-referrer"
        scrolling="no"
        src={src}
        style={{ colorScheme: isDark ? 'dark' : 'light' }}
        title={label}
      />
      <span className="pointer-events-none absolute top-2 left-2 opacity-0 transition-opacity group-hover/yt:pointer-events-auto group-hover/yt:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
        <Tip label={copy.popOut}>
          <button
            aria-label={copy.popOut}
            className={CORNER_BUTTON_CLASS}
            onClick={() => popOutVideo({ embedUrl, key, startAt: position.time, title: label })}
            type="button"
          >
            <PictureInPicture className="size-4" />
          </button>
        </Tip>
      </span>
    </div>
  )
}
