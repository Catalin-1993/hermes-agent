import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import { askHermesBesideAbout } from '../chat-bridge'
import { bumpLibraryRevision, importLibraryFile, type LibraryItem, writeLibraryFile } from '../data'
import { extensionOf } from '../file-types'
import { fitRatio, fullRect, type Handle, moveRect, type Rect, resizeRect } from '../image-crop'

import { PreviewSurface } from './preview-surface'

const RATIOS = [
  { id: 'free', ratio: null },
  { id: 'original', ratio: -1 },
  { id: '1:1', ratio: 1 },
  { id: '4:3', ratio: 4 / 3 },
  { id: '3:2', ratio: 3 / 2 },
  { id: '16:9', ratio: 16 / 9 },
  { id: '3:4', ratio: 3 / 4 },
  { id: '9:16', ratio: 9 / 16 }
] as const

const HANDLES: { cursor: string; handle: Handle; style: string }[] = [
  { cursor: 'nwse-resize', handle: 'nw', style: 'left-0 top-0' },
  { cursor: 'ns-resize', handle: 'n', style: 'left-1/2 top-0' },
  { cursor: 'nesw-resize', handle: 'ne', style: 'left-full top-0' },
  { cursor: 'ew-resize', handle: 'e', style: 'left-full top-1/2' },
  { cursor: 'nwse-resize', handle: 'se', style: 'left-full top-full' },
  { cursor: 'ns-resize', handle: 's', style: 'left-1/2 top-full' },
  { cursor: 'nesw-resize', handle: 'sw', style: 'left-0 top-full' },
  { cursor: 'ew-resize', handle: 'w', style: 'left-0 top-1/2' }
]

/** What an editor can write back: the formats a canvas encodes. */
export const IMAGE_EDIT_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

interface Turn {
  flipX: boolean
  flipY: boolean
  /** Quarter turns clockwise. */
  quarters: number
}

interface ImageEditorProps {
  item: LibraryItem
  src: string
  onClose: (saved?: LibraryItem) => void
}

/** Crop, rotate and flip an image, then save it over the original (its earlier bytes stay a version)
 *  or beside it as a copy. Background removal goes to Hermes, which hands the result back to the Library. */
export function ImageEditor({ item, onClose, src }: ImageEditorProps) {
  const { t } = useI18n()
  const copy = t.library.image
  const mime = IMAGE_EDIT_MIME[extensionOf(item.file_name)] ?? 'image/png'
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const frame = useRef<HTMLDivElement | null>(null)
  const drag = useRef<null | { kind: 'move' | Handle; start: Rect; x: number; y: number }>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [turn, setTurn] = useState<Turn>({ flipX: false, flipY: false, quarters: 0 })
  const [ratioId, setRatioId] = useState<(typeof RATIOS)[number]['id']>('free')
  // The crop as fractions of the (turned) image, so it survives a resize of the window.
  const [crop, setCrop] = useState<Rect>({ h: 1, w: 1, x: 0, y: 0 })
  const [box, setBox] = useState({ h: 0, w: 0 })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const el = new Image()

    el.onload = () => setImage(el)
    el.src = src
  }, [src])

  useEffect(() => {
    const node = frame.current

    if (!node) {
      return
    }

    const observer = new ResizeObserver(([entry]) =>
      setBox({ h: entry.contentRect.height, w: entry.contentRect.width })
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  const [nw, nh] = image
    ? turn.quarters % 2
      ? [image.naturalHeight, image.naturalWidth]
      : [image.naturalWidth, image.naturalHeight]
    : [0, 0]

  const fit = nw && box.w ? Math.min((box.w - 96) / nw, (box.h - 96) / nh, 2) : 1
  const dw = Math.max(1, nw * fit)
  const dh = Math.max(1, nh * fit)
  const bounds = useMemo(() => ({ h: dh, w: dw }), [dh, dw])
  const px: Rect = { h: crop.h * dh, w: crop.w * dw, x: crop.x * dw, y: crop.y * dh }

  const ratio =
    RATIOS.find(entry => entry.id === ratioId)!.ratio === -1
      ? nw / nh
      : (RATIOS.find(entry => entry.id === ratioId)!.ratio ?? null)

  const outW = Math.round(crop.w * nw)
  const outH = Math.round(crop.h * nh)
  const changed = turn.quarters % 4 !== 0 || turn.flipX || turn.flipY || crop.w < 0.999 || crop.h < 0.999

  // The turned image, drawn at its own resolution; the crop is cut from this canvas.
  useEffect(() => {
    const el = canvas.current

    if (!el || !image) {
      return
    }

    el.width = nw
    el.height = nh

    const ctx = el.getContext('2d')!

    ctx.save()
    ctx.translate(nw / 2, nh / 2)
    ctx.rotate((turn.quarters * Math.PI) / 2)
    ctx.scale(turn.flipX ? -1 : 1, turn.flipY ? -1 : 1)
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
    ctx.restore()
  }, [image, nh, nw, turn])

  const reshape = (next: Turn) => {
    setTurn(next)
    setRatioId('free')
    setCrop({ h: 1, w: 1, x: 0, y: 0 })
  }

  const toFractions = (rect: Rect): Rect => ({ h: rect.h / dh, w: rect.w / dw, x: rect.x / dw, y: rect.y / dh })

  const chooseRatio = (id: (typeof RATIOS)[number]['id']) => {
    setRatioId(id)

    const entry = RATIOS.find(item => item.id === id)!
    const target = entry.ratio === -1 ? nw / nh : entry.ratio

    setCrop(target ? toFractions(fitRatio(bounds, target)) : toFractions(fullRect(bounds)))
  }

  const begin = (event: ReactPointerEvent, kind: 'move' | Handle) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { kind, start: px, x: event.clientX, y: event.clientY }
  }

  const move = (event: ReactPointerEvent) => {
    const active = drag.current

    if (!active) {
      return
    }

    const dx = event.clientX - active.x
    const dy = event.clientY - active.y

    setCrop(
      toFractions(
        active.kind === 'move'
          ? moveRect(active.start, dx, dy, bounds)
          : resizeRect(active.start, active.kind, dx, dy, bounds, ratio)
      )
    )
  }

  const encode = () =>
    new Promise<Blob>((resolve, reject) => {
      const source = canvas.current
      const out = document.createElement('canvas')

      if (!source) {
        reject(new Error('no image'))

        return
      }

      out.width = Math.max(1, outW)
      out.height = Math.max(1, outH)
      out.getContext('2d')!.drawImage(source, crop.x * nw, crop.y * nh, outW, outH, 0, 0, out.width, out.height)
      out.toBlob(blob => (blob ? resolve(blob) : reject(new Error('encode failed'))), mime, 0.92)
    })

  const save = async (asCopy: boolean) => {
    setBusy(true)

    try {
      const blob = await encode()

      if (asCopy) {
        const name = item.file_name ?? 'image.png'
        const dot = name.lastIndexOf('.')

        const file = new File(
          [blob],
          `${dot > 0 ? name.slice(0, dot) : name} ${copy.copySuffix}${dot > 0 ? name.slice(dot) : ''}`,
          { type: mime }
        )

        const made = await importLibraryFile(file, item.parent_id ?? undefined)

        bumpLibraryRevision()
        notify({
          action: {
            label: t.library.chat.open,
            onClick: () => {
              window.location.hash = `#/artifacts?item=${made.id}`
            }
          },
          durationMs: 6000,
          kind: 'info',
          message: copy.copyMade
        })
        onClose()
      } else {
        const saved = await writeLibraryFile(item.id, blob)

        bumpLibraryRevision()
        onClose(saved)
      }
    } catch (error) {
      notifyError(error, t.library.errors.save)
      setBusy(false)
    }
  }

  const saveRef = useRef(save)

  saveRef.current = save

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key.toLowerCase() === 's' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        void saveRef.current(false)
      }
    }

    document.addEventListener('keydown', onKey)

    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const quarter = (by: number) => reshape({ ...turn, quarters: (turn.quarters + by + 4) % 4 })

  const tools = (
    <>
      <Tip label={copy.rotateLeft}>
        <Button aria-label={copy.rotateLeft} onClick={() => quarter(-1)} size="icon-xs" variant="ghost">
          <Codicon className="-scale-x-100" name="debug-restart" size="0.8125rem" />
        </Button>
      </Tip>
      <Tip label={copy.rotateRight}>
        <Button aria-label={copy.rotateRight} onClick={() => quarter(1)} size="icon-xs" variant="ghost">
          <Codicon name="debug-restart" size="0.8125rem" />
        </Button>
      </Tip>
      <Tip label={copy.flipH}>
        <Button
          aria-label={copy.flipH}
          onClick={() => reshape({ ...turn, flipX: !turn.flipX })}
          size="icon-xs"
          variant="ghost"
        >
          <Codicon name="arrow-both" size="0.8125rem" />
        </Button>
      </Tip>
      <Tip label={copy.flipV}>
        <Button
          aria-label={copy.flipV}
          onClick={() => reshape({ ...turn, flipY: !turn.flipY })}
          size="icon-xs"
          variant="ghost"
        >
          <Codicon className="rotate-90" name="arrow-both" size="0.8125rem" />
        </Button>
      </Tip>
      <span className="mx-1 h-4 w-px bg-(--ui-stroke-tertiary)" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-7 gap-1.5 px-2 text-xs font-normal" variant="ghost">
            <Codicon name="screen-normal" size="0.75rem" />
            {ratioId === 'free' ? copy.free : ratioId === 'original' ? copy.original : ratioId}
            <Codicon className="opacity-60" name="chevron-down" size="0.625rem" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {RATIOS.map(entry => (
            <DropdownMenuItem key={entry.id} onSelect={() => chooseRatio(entry.id)}>
              <span className="flex-1">
                {entry.id === 'free' ? copy.free : entry.id === 'original' ? copy.original : entry.id}
              </span>
              {ratioId === entry.id && <Codicon className="text-(--ui-accent)" name="check" size="0.8125rem" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        className="h-7 gap-1.5 px-2.5 text-xs font-medium text-(--ui-accent) hover:bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] hover:text-(--ui-accent)"
        onClick={() => void askHermesBesideAbout(item, copy.removeBgPrompt(item.title || item.file_name || ''))}
        variant="ghost"
      >
        <Codicon name="sparkle" size="0.75rem" />
        {copy.removeBg}
      </Button>
      <span className="mx-1 h-4 w-px bg-(--ui-stroke-tertiary)" />
      <Button className="h-7 px-2.5 text-xs" onClick={() => onClose()} variant="ghost">
        {copy.cancel}
      </Button>
      <Button
        className="h-7 px-2.5 text-xs"
        disabled={!changed || busy}
        onClick={() => void save(true)}
        variant="ghost"
      >
        {copy.saveCopy}
      </Button>
      <Button className="h-7 px-3 text-xs" disabled={!changed || busy} onClick={() => void save(false)} size="sm">
        {busy ? <Codicon name="loading" size="0.75rem" spinning /> : copy.save}
      </Button>
    </>
  )

  return (
    <PreviewSurface status={image ? `${outW} × ${outH}` : undefined} tools={tools}>
      <div className="library-checker absolute inset-0 grid place-items-center overflow-hidden" ref={frame}>
        <div className="relative" style={{ height: dh, width: dw }}>
          <canvas className="block size-full select-none" ref={canvas} />
          {image && (
            <>
              {/* The dimmed outside: its own clipped layer, so the handles on the edge are never cut. */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div
                  className="absolute shadow-[0_0_0_9999px_rgb(0_0_0/0.52)]"
                  style={{ height: px.h, left: px.x, top: px.y, width: px.w }}
                />
              </div>
              <div
                className="absolute cursor-move border border-white/90"
                onPointerDown={event => begin(event, 'move')}
                onPointerMove={move}
                onPointerUp={() => (drag.current = null)}
                style={{ height: px.h, left: px.x, top: px.y, width: px.w }}
              >
                {[1, 2].map(i => (
                  <span
                    className="pointer-events-none absolute inset-y-0 w-px bg-white/35"
                    key={`v${i}`}
                    style={{ left: `${(i * 100) / 3}%` }}
                  />
                ))}
                {[1, 2].map(i => (
                  <span
                    className="pointer-events-none absolute inset-x-0 h-px bg-white/35"
                    key={`h${i}`}
                    style={{ top: `${(i * 100) / 3}%` }}
                  />
                ))}
                {HANDLES.filter(entry => ratio === null || entry.handle.length === 2).map(entry => (
                  <span
                    className={cn(
                      'absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-[0.1875rem] border border-black/25 bg-white shadow-sm',
                      entry.style
                    )}
                    key={entry.handle}
                    onPointerDown={event => begin(event, entry.handle)}
                    onPointerMove={move}
                    onPointerUp={() => (drag.current = null)}
                    style={{ cursor: entry.cursor }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PreviewSurface>
  )
}
