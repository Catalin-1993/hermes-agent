import { type PointerEvent, useEffect, useRef, useState, type WheelEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

import { PreviewSurface } from './preview-surface'

const MIN_SCALE = 0.05
const MAX_SCALE = 8
const STEP = 1.25

const clamp = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

/** An image at full quality: fits by default, zooms around the pointer (pinch / ⌘-wheel / buttons),
 *  pans by dragging, double-click toggles fit ↔ actual size, and goes full screen. */
export function ImageViewer({ alt, onEdit, src }: { alt: string; onEdit?: () => void; src: string }) {
  const { t } = useI18n()
  const copy = t.library.preview
  const frame = useRef<HTMLDivElement | null>(null)
  const drag = useRef<null | { x: number; y: number; ox: number; oy: number }>(null)
  const [natural, setNatural] = useState<null | { h: number; w: number }>(null)
  const [box, setBox] = useState({ h: 0, w: 0 })
  const [scale, setScale] = useState<null | number>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

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

  const fit = natural && box.w ? Math.min((box.w - 48) / natural.w, (box.h - 48) / natural.h, 1) : 1
  const current = scale ?? fit

  /** Zoom to `next`, keeping the point `at` (relative to the frame's center) where it is. */
  const zoomTo = (next: number, at = { x: 0, y: 0 }) => {
    const target = clamp(next)
    const ratio = target / current

    setOffset(o => ({ x: at.x - (at.x - o.x) * ratio, y: at.y - (at.y - o.y) * ratio }))
    setScale(target)
  }

  const reset = () => {
    setScale(null)
    setOffset({ x: 0, y: 0 })
  }

  const pointFrom = (clientX: number, clientY: number) => {
    const rect = frame.current?.getBoundingClientRect()

    return rect ? { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 } : { x: 0, y: 0 }
  }

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      zoomTo(current * Math.exp(-event.deltaY * 0.01), pointFrom(event.clientX, event.clientY))
    } else if (scale !== null) {
      setOffset(o => ({ x: o.x - event.deltaX, y: o.y - event.deltaY }))
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { ox: offset.x, oy: offset.y, x: event.clientX, y: event.clientY }
    setDragging(true)
  }

  const onPointerMove = (event: PointerEvent) => {
    const start = drag.current

    if (start) {
      setOffset({ x: start.ox + event.clientX - start.x, y: start.oy + event.clientY - start.y })
    }
  }

  const tools = (
    <>
      <Tip label={copy.zoomOut}>
        <Button aria-label={copy.zoomOut} onClick={() => zoomTo(current / STEP)} size="icon-xs" variant="ghost">
          <Codicon name="zoom-out" size="0.8125rem" />
        </Button>
      </Tip>
      {/* The zoom level is also the fit ⇄ actual size toggle, as in Preview. */}
      <Tip label={scale === null ? copy.actualSize : copy.fit}>
        <button
          className="h-6 min-w-12 cursor-pointer rounded-md px-1.5 text-[0.6875rem] tabular-nums text-(--ui-text-secondary) hover:bg-(--ui-control-hover-background)"
          onClick={() => (scale === null ? zoomTo(1) : reset())}
          type="button"
        >
          {Math.round(current * 100)}%
        </button>
      </Tip>
      <Tip label={copy.zoomIn}>
        <Button aria-label={copy.zoomIn} onClick={() => zoomTo(current * STEP)} size="icon-xs" variant="ghost">
          <Codicon name="zoom-in" size="0.8125rem" />
        </Button>
      </Tip>
      <span className="mx-1 h-4 w-px bg-(--ui-stroke-tertiary)" />
      {onEdit && (
        <>
          <Button className="h-7 gap-1.5 px-2.5 text-xs" onClick={onEdit} variant="ghost">
            <Codicon name="edit" size="0.75rem" />
            {t.library.image.edit}
          </Button>
          <span className="mx-1 h-4 w-px bg-(--ui-stroke-tertiary)" />
        </>
      )}
    </>
  )

  return (
    <PreviewSurface status={natural ? `${natural.w} × ${natural.h}` : undefined} tools={tools}>
      <div
        className="library-checker absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
        onDoubleClick={event => (scale === null ? zoomTo(1, pointFrom(event.clientX, event.clientY)) : reset())}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          drag.current = null
          setDragging(false)
        }}
        onWheel={onWheel}
        ref={frame}
      >
        <img
          alt={alt}
          className="absolute left-1/2 top-1/2 max-w-none select-none shadow-[0_0.5rem_2rem_-0.75rem_color-mix(in_srgb,#000_35%,transparent)]"
          draggable={false}
          onLoad={event => setNatural({ h: event.currentTarget.naturalHeight, w: event.currentTarget.naturalWidth })}
          src={src}
          style={{
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${current})`,
            transition: dragging ? 'none' : 'transform 120ms ease-out'
          }}
        />
      </div>
    </PreviewSurface>
  )
}
