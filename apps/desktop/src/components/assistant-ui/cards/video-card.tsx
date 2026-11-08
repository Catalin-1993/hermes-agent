import { useStore } from '@nanostores/react'
import {
  type DragEvent,
  type FormEvent,
  lazy,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  Suspense,
  useRef,
  useState
} from 'react'

import { Button } from '@/components/ui/button'
import { CARD_BUTTON_CLASS, CARD_SURFACE_CLASS, HermesCard } from '@/components/ui/hermes-card'
import { Input } from '@/components/ui/input'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { openExternalLink } from '@/lib/external-link'
import { Play, Search } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $embedMode } from '@/store/embed-consent'

import { Actions, Meta, Photo } from './card-parts'
import { type CardSpec, type CardVideo, videoFrom } from './card-spec'

const YouTubePlayer = lazy(() => import('../embeds/youtube-embed'))

const DURATION_BADGE_CLASS =
  'absolute right-2 bottom-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[0.6875rem] font-medium text-white tabular-nums'

/** The picture of a video, or the player once it was asked for. Pressing play is the person's say-so for
 *  the player to reach YouTube; with embeds switched off, it opens the video in the browser instead. */
function VideoStage({ onPlay, playing, video }: { onPlay: () => void; playing: boolean; video: CardVideo }) {
  const { t } = useI18n()
  const mode = useStore($embedMode)
  const title = video.title || t.agentCards.videoUntitled
  const embedded = mode !== 'off'

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-(--card-well)">
      {playing && embedded ? (
        <Suspense fallback={null}>
          <YouTubePlayer autoplay embedUrl={video.embedUrl} key={video.id} title={video.title || undefined} />
        </Suspense>
      ) : (
        <button
          aria-label={t.agentCards.playVideo(title)}
          className="group/play absolute inset-0 grid cursor-pointer place-items-center"
          onClick={embedded ? onPlay : () => openExternalLink(video.sourceUrl)}
          type="button"
        >
          {embedded && (
            <Photo
              className="absolute inset-0 size-full transition-transform duration-300 group-hover/play:scale-[1.03]"
              src={video.thumbnail}
            />
          )}
          <span aria-hidden className="absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent" />
          <span
            aria-hidden
            className="relative grid size-12 place-items-center rounded-full bg-white/95 text-black shadow-[0_8px_24px_-6px_rgba(11,21,48,0.5)] transition-transform duration-200 group-hover/play:scale-110"
          >
            <Play className="size-4 translate-x-px fill-current" />
          </span>
          {video.duration && <span className={DURATION_BADGE_CLASS}>{video.duration}</span>}
        </button>
      )}
    </div>
  )
}

function VideoCaption({ video }: { video: CardVideo }) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-1 px-4 pt-3.5">
      <div aria-level={3} className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em]" role="heading">
        {video.title || t.agentCards.videoUntitled}
      </div>
      <Meta>{[video.channel, video.views && t.agentCards.views(video.views), video.published]}</Meta>
    </div>
  )
}

function OpenOnYouTube({ children, video }: { children?: ReactNode; video: CardVideo }) {
  const { t } = useI18n()

  return (
    <Actions>
      <Button
        className={CARD_BUTTON_CLASS}
        onClick={() => openExternalLink(video.sourceUrl)}
        size="sm"
        variant="secondary"
      >
        {t.agentCards.openOnYouTube}
      </Button>
      {children}
    </Actions>
  )
}

export function VideoCard({ video }: { video: CardVideo }) {
  const [playing, setPlaying] = useState(false)

  return (
    <HermesCard className="not-prose my-3 max-w-xl" data-card="video">
      <div className="mx-3 mt-3">
        <VideoStage onPlay={() => setPlaying(true)} playing={playing} video={video} />
      </div>
      <VideoCaption video={video} />
      <OpenOnYouTube video={video} />
    </HermesCard>
  )
}

/** A row the trackpad swipes sideways and a mouse drags: a click that moved is a drag, not a choice. */
function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ left: number; moved: boolean; x: number } | null>(null)

  return {
    onClickCapture: (event: MouseEvent) => {
      if (drag.current?.moved) {
        event.preventDefault()
        event.stopPropagation()
      }

      drag.current = null
    },
    onDragStart: (event: DragEvent) => event.preventDefault(),
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      drag.current =
        event.pointerType === 'mouse' && event.button === 0 && ref.current
          ? { left: ref.current.scrollLeft, moved: false, x: event.clientX }
          : null
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const state = drag.current
      const el = ref.current
      const dx = state ? event.clientX - state.x : 0

      if (!state || !el || (!state.moved && Math.abs(dx) < 5)) {
        return
      }

      state.moved = true
      el.scrollLeft = state.left - dx
    },
    ref
  }
}

/** Find a song yourself: a YouTube link plays here, anything else opens YouTube's search. */
function YouTubeSearch({ onClose, onVideo }: { onClose: () => void; onVideo: (video: CardVideo) => void }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const text = query.trim()

    if (!text) {
      return
    }

    const video = videoFrom({ url: text })

    if (video) {
      onVideo(video)
      setQuery('')
    } else {
      openExternalLink(`https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`)
    }
  }

  return (
    <form className="px-4 pb-3" onSubmit={submit} role="search">
      <Input
        aria-label={t.agentCards.searchYouTube}
        autoFocus
        className="h-8 rounded-full"
        onChange={event => setQuery(event.target.value)}
        onKeyDown={event => event.key === 'Escape' && onClose()}
        placeholder={t.agentCards.searchYouTubePlaceholder}
        value={query}
      />
    </form>
  )
}

function VideoPoster({
  active,
  item,
  mode,
  onChoose
}: {
  active: boolean
  item: CardVideo
  mode: string
  onChoose: () => void
}) {
  const { t } = useI18n()

  return (
    <button
      aria-current={active}
      aria-label={t.agentCards.playVideo(item.title || t.agentCards.videoUntitled)}
      className={cn(
        'flex w-[8.5rem] shrink-0 cursor-pointer flex-col gap-1.5 rounded-xl p-1.5 text-left transition-colors duration-150',
        active ? 'bg-[color-mix(in_srgb,var(--ui-accent)_9%,transparent)]' : 'hover:bg-(--card-well)'
      )}
      onClick={onChoose}
      type="button"
    >
      <span className="relative block aspect-video overflow-hidden rounded-lg bg-(--card-well)">
        {mode !== 'off' && <Photo className="size-full" src={item.thumbnail} />}
        {item.duration && <span className={DURATION_BADGE_CLASS}>{item.duration}</span>}
      </span>
      <span className="line-clamp-2 text-[0.75rem] leading-snug font-medium text-(--ui-text-primary)">
        {item.title || t.agentCards.videoUntitled}
      </span>
      {item.channel && <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">{item.channel}</span>}
    </button>
  )
}

/** Several videos: the chosen one is the stage, the rest a row of posters to swipe through. */
export function VideosCard({ spec }: { spec: Extract<CardSpec, { kind: 'videos' }> }) {
  const { t } = useI18n()
  const mode = useStore($embedMode)
  const [found, setFound] = useState<CardVideo[]>([])
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [searching, setSearching] = useState(false)
  const row = useDragScroll()
  const videos = [...found, ...spec.videos.filter(item => !found.some(own => own.id === item.id))]
  const video = videos[active] ?? videos[0]!

  const choose = (index: number) => {
    setActive(index)
    setPlaying(mode !== 'off')

    if (mode === 'off') {
      openExternalLink(videos[index]!.sourceUrl)
    }
  }

  const play = (next: CardVideo) => {
    setFound(current => [next, ...current.filter(item => item.id !== next.id)])
    setActive(0)
    setPlaying(mode !== 'off')
    row.ref.current?.scrollTo({ left: 0 })
  }

  return (
    <div className={cn(CARD_SURFACE_CLASS, 'not-prose my-3 max-w-2xl overflow-hidden')} data-card="videos">
      {(spec.title || spec.subtitle) && (
        <div className="px-5 pt-4">
          {spec.title && (
            <div aria-level={3} className="text-[0.9375rem] font-semibold tracking-[-0.01em]" role="heading">
              {spec.title}
            </div>
          )}
          {spec.subtitle && <div className="mt-0.5 text-[0.75rem] text-(--ui-text-tertiary)">{spec.subtitle}</div>}
        </div>
      )}
      <div className="mx-3 mt-3">
        <VideoStage onPlay={() => setPlaying(true)} playing={playing} video={video} />
      </div>
      <VideoCaption video={video} />
      <OpenOnYouTube video={video}>
        <Tip label={t.agentCards.searchYouTube}>
          <Button
            aria-expanded={searching}
            aria-label={t.agentCards.searchYouTube}
            className="ml-auto rounded-full text-(--ui-text-tertiary)"
            onClick={() => setSearching(open => !open)}
            size="icon-sm"
            variant="ghost"
          >
            <Search className="size-4" />
          </Button>
        </Tip>
      </OpenOnYouTube>
      {searching && <YouTubeSearch onClose={() => setSearching(false)} onVideo={play} />}
      <div
        className="flex gap-1 overflow-x-auto overscroll-x-contain border-t border-(--card-well-stroke) p-2.5 select-none [scrollbar-width:thin]"
        data-video-row=""
        {...row}
      >
        {videos.map((item, index) => (
          <VideoPoster active={index === active} item={item} key={item.id} mode={mode} onChoose={() => choose(index)} />
        ))}
      </div>
    </div>
  )
}
