import { useEffect, useRef, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { resolveMediaDisplaySrc, resolveMediaPlaybackSrc } from '@/lib/media'
import { cn } from '@/lib/utils'

import type { LibraryItem } from './data'
import { DECK_THEMES } from './deck'
import { Slide } from './deck-slide'
import { FileGlyph } from './file-glyph'
import { extensionOf, fileCategoryOf, ITEM_TYPE_ICON, ITEM_TYPE_TINT, itemTypeOf } from './file-types'

// One resolution per file for the window's life: a list re-render never re-reads the image.
const sources = new Map<string, Promise<string>>()

function sourceFor(path: string, video: boolean): Promise<string> {
  const key = `${video ? 'v' : 'i'}:${path}`
  let pending = sources.get(key)

  if (!pending) {
    pending = video ? resolveMediaPlaybackSrc(path) : resolveMediaDisplaySrc(path)
    pending.catch(() => sources.delete(key))
    sources.set(key, pending)
  }

  return pending
}

/** Resolve an image/video source once the thumbnail scrolls near the viewport. */
function useVisibleSource(path: null | string | undefined, video: boolean) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [src, setSrc] = useState<null | string>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const node = ref.current

    if (!path || !node) {
      return
    }

    let live = true

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect()
          sourceFor(path, video).then(
            next => live && setSrc(next),
            () => live && setFailed(true)
          )
        }
      },
      { rootMargin: '240px' }
    )

    observer.observe(node)

    return () => {
      live = false
      observer.disconnect()
    }
  }, [path, video])

  return { failed, ref, src }
}

function TypeGlyph({ item, large }: { item: LibraryItem; large: boolean }) {
  // A file wears its own sheet — the format on its tab — rather than a generic icon.
  if (item.kind === 'file') {
    return (
      <FileGlyph
        category={fileCategoryOf(item)}
        className={large ? 'h-16 w-[3.25rem] drop-shadow-sm' : 'h-6 w-5'}
        ext={extensionOf(item.file_name)}
      />
    )
  }

  const type = itemTypeOf(item)
  const tint = ITEM_TYPE_TINT[type]
  const ext = ''

  return (
    <span className="flex flex-col items-center gap-1.5" style={{ color: tint }}>
      {item.icon ? (
        <span className={large ? 'text-3xl leading-none' : 'text-base leading-none'}>{item.icon}</span>
      ) : (
        <Codicon name={ITEM_TYPE_ICON[type]} size={large ? '1.5rem' : '0.9375rem'} />
      )}
      {large && ext && (
        <span
          className="rounded px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-wide"
          style={{ background: `color-mix(in srgb, ${tint} 12%, transparent)` }}
        >
          {ext}
        </span>
      )}
    </span>
  )
}

/**
 * What an item looks like at a glance. Images and videos show themselves; a page shows its first
 * lines on a sheet; everything else wears its type's glyph and extension on a quiet tint.
 */
export function LibraryThumb({
  className,
  item,
  size
}: {
  className?: string
  item: LibraryItem
  size: 'card' | 'row'
}) {
  const type = itemTypeOf(item)
  // Processing's JPEG when there is one (small, and covers PDFs, documents, HEIC and video); the
  // original image or video otherwise.
  const thumb = item.thumb
  const media = type === 'image' || type === 'video'
  const { failed, ref, src } = useVisibleSource(thumb ?? (media ? item.path : null), !thumb && type === 'video')
  const pictured = Boolean(src && !failed)
  const large = size === 'card'
  const tint = ITEM_TYPE_TINT[type]

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden',
        large ? 'h-24 w-full' : 'size-8 rounded-lg',
        className
      )}
      ref={ref}
      style={{ background: `color-mix(in srgb, ${tint} ${large ? 7 : 10}%, var(--ui-bg-editor))` }}
    >
      {pictured && (thumb || type === 'image') ? (
        <>
          <img
            alt=""
            className={cn('size-full', media ? 'object-cover' : 'bg-white object-cover object-top')}
            draggable={false}
            loading="lazy"
            src={src!}
          />
          {type === 'video' && (
            <span className="absolute grid size-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
              <Codicon name="play" size={large ? '0.875rem' : '0.625rem'} />
            </span>
          )}
        </>
      ) : pictured && type === 'video' ? (
        <>
          <video className="size-full object-cover" muted playsInline preload="metadata" src={`${src}#t=0.5`} />
          <span className="absolute grid size-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <Codicon name="play" size={large ? '0.875rem' : '0.625rem'} />
          </span>
        </>
      ) : item.deck ? (
        // A presentation shows its first slide: a card crops it from the top, a row letterboxes the whole.
        <span className={cn('absolute inset-0 overflow-hidden', !large && 'grid place-items-center')}>
          <span className="pointer-events-none block aspect-video w-full">
            <Slide slide={item.deck.slide} theme={DECK_THEMES.find(theme => theme === item.deck?.theme) ?? 'paper'} />
          </span>
        </span>
      ) : type === 'page' && large ? (
        <span className="absolute inset-x-3 top-3 bottom-0 rounded-t-md bg-(--ui-bg-editor) px-2.5 pt-2 shadow-[0_0_0_0.0625rem_var(--ui-stroke-tertiary)]">
          {item.icon && <span className="mb-1 block text-base leading-none">{item.icon}</span>}
          <span className="line-clamp-4 text-[0.5625rem] leading-relaxed text-(--ui-text-tertiary)">
            {item.excerpt || ' '}
          </span>
        </span>
      ) : (
        <TypeGlyph item={item} large={large} />
      )}
    </span>
  )
}
