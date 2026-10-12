import { useEffect, useRef, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { resolveMediaDisplaySrc, resolveMediaPlaybackSrc } from '@/lib/media'
import { cn } from '@/lib/utils'

import { type LibraryItem, readLibraryBlob } from '../data'

import { Centered, LoadFailed, Loading, PreviewSurface } from './preview-surface'

/** Resolve a file path to something this window can load (`null` while pending): the small display
 *  sources (a thumbnail as a poster) and media playback, which streams. */
export function useResolvedSrc(path: null | string | undefined, how: 'display' | 'playback') {
  const [state, setState] = useState<{ error: boolean; src: null | string }>({ error: false, src: null })

  useEffect(() => {
    if (!path) {
      return
    }

    let live = true

    ;(how === 'playback' ? resolveMediaPlaybackSrc(path) : resolveMediaDisplaySrc(path)).then(
      src => live && setState({ error: false, src }),
      () => live && setState({ error: true, src: null })
    )

    return () => {
      live = false
    }
  }, [how, path])

  return state
}

interface LibraryFileState {
  error: boolean
  progress?: number
  retry: () => void
  url: null | string
}

/** A Library file (or its rendition) as a local object URL, read in slices with progress — no size
 *  ceiling, local or remote. Re-reads when the file changes (`revision`). */
export function useLibraryFile(
  item: Pick<LibraryItem, 'id' | 'updated_at'>,
  { rendition = false, type }: { rendition?: boolean; type?: string } = {}
): LibraryFileState {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<Omit<LibraryFileState, 'retry'>>({ error: false, url: null })

  useEffect(() => {
    let live = true
    let url: null | string = null

    setState({ error: false, url: null })
    readLibraryBlob(item.id, { onProgress: progress => live && setState(s => ({ ...s, progress })), rendition }).then(
      blob => {
        if (!live) {
          return
        }

        // Chromium's PDF viewer goes by the blob's type, which a rendition read may not carry.
        url = URL.createObjectURL(type ? new Blob([blob], { type }) : blob)
        setState({ error: false, url })
      },
      () => live && setState({ error: true, url: null })
    )

    return () => {
      live = false

      if (url) {
        URL.revokeObjectURL(url)
      }
    }
  }, [attempt, item.id, item.updated_at, rendition, type])

  return { ...state, retry: () => setAttempt(n => n + 1) }
}

/** PDFs (and office documents rendered to PDF) in Chromium's viewer: page thumbnails, zoom, search. */
export function PdfViewer({ item, rendition, status }: { item: LibraryItem; rendition?: boolean; status?: string }) {
  const file = useLibraryFile(item, { rendition, type: 'application/pdf' })

  return (
    <PreviewSurface status={status}>
      {file.error ? (
        <LoadFailed onRetry={file.retry} />
      ) : file.url ? (
        <iframe className="absolute inset-0 size-full border-0 bg-white" src={file.url} title={item.title} />
      ) : (
        <Loading progress={file.progress} />
      )}
    </PreviewSurface>
  )
}

/** A video, or (`path`) the MP4 rendition of one the window cannot play itself. */
export function VideoViewer({ item, path }: { item: LibraryItem; path?: string }) {
  const { src } = useResolvedSrc(path ?? item.path, 'playback')
  const poster = useResolvedSrc(item.thumb, 'display').src
  const [failed, setFailed] = useState(false)

  return (
    <PreviewSurface bodyClassName="bg-black">
      {failed ? (
        <LoadFailed onRetry={() => setFailed(false)} />
      ) : src ? (
        <video
          className="absolute inset-0 size-full object-contain"
          controls
          onError={() => setFailed(true)}
          poster={poster ?? undefined}
          preload="metadata"
          src={src}
        />
      ) : (
        <Loading />
      )}
    </PreviewSurface>
  )
}

const BARS = 96
// Waveforms decode the whole file in the window; past this, the player stands alone.
const WAVEFORM_MAX_BYTES = 32 * 1024 * 1024

async function peaksOf(id: string): Promise<number[]> {
  const context = new AudioContext()

  try {
    const audio = await context.decodeAudioData(await (await readLibraryBlob(id)).arrayBuffer())
    const data = audio.getChannelData(0)
    const step = Math.max(1, Math.floor(data.length / BARS))
    const peaks: number[] = []

    for (let bar = 0; bar < BARS; bar += 1) {
      let peak = 0

      for (let i = bar * step; i < Math.min(data.length, (bar + 1) * step); i += 64) {
        peak = Math.max(peak, Math.abs(data[i]))
      }

      peaks.push(peak)
    }

    const top = Math.max(...peaks, 0.01)

    return peaks.map(peak => peak / top)
  } finally {
    void context.close()
  }
}

const clock = (seconds: number) =>
  Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00'

/** Audio as a card: play / pause, the waveform as the seek bar, elapsed and total time. */
export function AudioViewer({ item }: { item: LibraryItem }) {
  const { t } = useI18n()
  const copy = t.library.preview
  const { src } = useResolvedSrc(item.path, 'playback')
  const audio = useRef<HTMLAudioElement | null>(null)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const [time, setTime] = useState({ at: 0, total: 0 })

  useEffect(() => {
    if ((item.size ?? 0) > WAVEFORM_MAX_BYTES) {
      return
    }

    let live = true

    peaksOf(item.id).then(
      next => live && setPeaks(next),
      () => undefined
    )

    return () => {
      live = false
    }
  }, [item.id, item.size, item.updated_at])

  const progress = time.total ? time.at / time.total : 0
  const bars = peaks ?? Array.from({ length: BARS }, () => 0.18)

  if (failed) {
    return (
      <PreviewSurface>
        <LoadFailed onRetry={() => setFailed(false)} />
      </PreviewSurface>
    )
  }

  return (
    <PreviewSurface status={time.total ? clock(time.total) : undefined}>
      <Centered>
        <div className="flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) p-6 shadow-(--composer-float-shadow)">
          <div className="flex items-center gap-4">
            <button
              aria-label={playing ? copy.pause : copy.play}
              className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-full bg-(--ui-text-primary) text-(--ui-bg-editor) transition-transform hover:scale-105"
              disabled={!src}
              onClick={() => (playing ? audio.current?.pause() : void audio.current?.play())}
              type="button"
            >
              <Codicon name={playing ? 'debug-pause' : 'play'} size="1.125rem" />
            </button>
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-medium text-(--ui-text-primary)">{item.title}</p>
              <p className="m-0 text-xs tabular-nums text-(--ui-text-tertiary)">
                {clock(time.at)} / {clock(time.total)}
              </p>
            </div>
          </div>
          <div
            aria-label={item.title}
            aria-valuemax={Math.round(time.total)}
            aria-valuemin={0}
            aria-valuenow={Math.round(time.at)}
            className="flex h-16 cursor-pointer items-center gap-[2px]"
            onClick={event => {
              const rect = event.currentTarget.getBoundingClientRect()

              if (audio.current && time.total) {
                audio.current.currentTime = ((event.clientX - rect.left) / rect.width) * time.total
              }
            }}
            role="slider"
            tabIndex={0}
          >
            {bars.map((peak, index) => (
              <span
                className={cn(
                  'min-h-1 flex-1 rounded-full transition-colors',
                  index / bars.length < progress ? 'bg-(--ui-accent)' : 'bg-(--ui-stroke-secondary)'
                )}
                key={index}
                style={{ height: `${Math.max(6, peak * 100)}%` }}
              />
            ))}
          </div>
          {src && (
            <audio
              onDurationChange={event => {
                // Read now: React clears currentTarget before a state updater runs.
                const total = event.currentTarget.duration

                setTime(t => ({ ...t, total }))
              }}
              onEnded={() => setPlaying(false)}
              onError={() => setFailed(true)}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              onTimeUpdate={event => {
                const at = event.currentTarget.currentTime

                setTime(t => ({ ...t, at }))
              }}
              preload="metadata"
              ref={audio}
              src={src}
            />
          )}
        </div>
      </Centered>
    </PreviewSurface>
  )
}

/** Word documents laid out as pages in the window (docx-preview, loaded only when one opens). */
export function DocxViewer({ item }: { item: LibraryItem }) {
  const body = useRef<HTMLDivElement | null>(null)
  const styles = useRef<HTMLDivElement | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [state, setState] = useState<{ phase: 'failed' | 'loading' | 'ready'; progress?: number }>({
    phase: 'loading'
  })

  useEffect(() => {
    let live = true

    setState({ phase: 'loading' })
    Promise.all([
      readLibraryBlob(item.id, { onProgress: progress => live && setState({ phase: 'loading', progress }) }),
      import('docx-preview')
    ])
      .then(async ([blob, docx]) => {
        if (!live || !body.current || !styles.current) {
          return
        }

        body.current.replaceChildren()
        styles.current.replaceChildren()
        await docx.renderAsync(await blob.arrayBuffer(), body.current, styles.current, {
          breakPages: true,
          className: 'docx',
          ignoreLastRenderedPageBreak: true,
          inWrapper: true
        })

        if (live) {
          setState({ phase: 'ready' })
        }
      })
      .catch(() => live && setState({ phase: 'failed' }))

    return () => {
      live = false
    }
  }, [attempt, item.id, item.updated_at])

  return (
    <PreviewSurface bodyClassName="library-docx bg-(--ui-bg-quinary)">
      {state.phase === 'loading' && <Loading progress={state.progress} />}
      {state.phase === 'failed' && <LoadFailed onRetry={() => setAttempt(n => n + 1)} />}
      <div ref={styles} />
      <div ref={body} />
    </PreviewSurface>
  )
}
