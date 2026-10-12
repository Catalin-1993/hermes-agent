'use client'

import { useMemo } from 'react'

import { youtubePlayerSrc } from './providers/youtube'
import { useIsDark } from './use-is-dark'

const YOUTUBE_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen'

// Keep this as a plain iframe and let YouTube render its native player/error UI.
export default function YouTubeEmbedRenderer({ autoplay, embedUrl }: { autoplay?: boolean; embedUrl: string }) {
  const isDark = useIsDark()

  const src = useMemo(() => youtubePlayerSrc(embedUrl, { autoplay }), [autoplay, embedUrl])

  // Width is capped to the ratio by UrlEmbed, so aspect-video sizes height ≤ cap.
  return (
    <iframe
      allow={YOUTUBE_ALLOW}
      allowFullScreen
      className="block aspect-video w-full border-0 bg-transparent"
      loading="lazy"
      // The app's own address (the dev server, file://) must not reach YouTube: many videos — music above
      // all — refuse to play for a local embedder ("This video is unavailable"). With no Referer of its own,
      // the main process gives the player a real site's (electron/embed-referer.ts), and they play.
      referrerPolicy="no-referrer"
      scrolling="no"
      src={src}
      style={{ colorScheme: isDark ? 'dark' : 'light' }}
      title="YouTube embed"
    />
  )
}
