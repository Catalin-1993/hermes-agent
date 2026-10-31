/**
 * The Agents chart as a board you can arrange: every card stands where the automatic layout puts it (`org-layout`)
 * until you drag it somewhere else — then it stays there, remembered on this computer. Drop a card ON another card
 * (it lights up) to make it report there, or on "You" to put it at the top of the team. "Auto-arrange" puts every
 * card back. The chart fits the room it is given; − / + and Ctrl/⌘ + mouse wheel zoom, and it scrolls when bigger.
 *
 * The room is sized by the page, never by the chart, and card sizes do not change with the zoom — so fitting is
 * worked out once per change and the cards never pulse between sizes.
 */

import { cn, Codicon, useValue } from '@hermes/plugin-sdk'
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'

import { $boardView, $orgPlaced } from './api'
import { useInboxCount } from './inbox'
import { MemberCard } from './member-card'
import { ORG } from './org-copy'
import { autoLayout, bounds, cardAt, CEO, links, type Point, type Size, withPlaced } from './org-layout'
import { canReportTo, type OrgNode } from './org-model'
import { type ChartState, dropTarget } from './org-view'
import type { KanbanBoard } from './types'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2
export const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))

const CARD_WIDTH = { dense: 240, detailed: 320 } as const
/** A card's height before it is measured. */
const CARD_GUESS = { dense: 150, detailed: 270 } as const
const CEO_SIZE: Size = { height: 76, width: 288 }
const PAD = 28
/** What a press on these does stays theirs: menus open, fields type. Anything else on a card can start a drag. */
const NO_DRAG = 'input, textarea, select, [role="menuitem"], [aria-haspopup]'

type Look = keyof typeof CARD_WIDTH
type Area = ReturnType<typeof bounds>

interface Drag extends Point {
  /** The chart's area when the drag began: kept while dragging, so nothing else moves under the pointer. */
  area: Area
  name: string
  /** The manager it would report to if dropped now (CEO for the top), or null to just place it. */
  target: null | string
}

/** Each card's measured height, by name. Heights never depend on the zoom (the chart is scaled with a transform). */
function useHeights() {
  const [heights, setHeights] = useState(() => new Map<string, number>())
  const names = useRef(new Map<Element, string>())
  const observer = useRef<null | ResizeObserver>(null)

  if (!observer.current && typeof ResizeObserver !== 'undefined') {
    observer.current = new ResizeObserver(entries => {
      setHeights(previous => {
        let next = previous

        for (const entry of entries) {
          const name = names.current.get(entry.target)
          const height = (entry.target as HTMLElement).offsetHeight

          if (name && height && Math.abs((previous.get(name) ?? 0) - height) > 1) {
            next = next === previous ? new Map(previous) : next
            next.set(name, height)
          }
        }

        return next
      })
    })
  }

  useEffect(() => () => observer.current?.disconnect(), [])

  const measure = (name: string) => (element: HTMLElement | null) => {
    if (!element) {
      return
    }

    names.current.set(element, name)
    observer.current?.observe(element)

    return () => {
      observer.current?.unobserve(element)
      names.current.delete(element)
    }
  }

  return { heights, measure }
}

/** The room the chart is given, in px; updated only when it really changes. */
function useRoom() {
  const box = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState({ height: 0, width: 0 })

  useEffect(() => {
    const element = box.current

    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const read = () =>
      setRoom(previous =>
        Math.abs(previous.width - element.clientWidth) < 2 && Math.abs(previous.height - element.clientHeight) < 2
          ? previous
          : { height: element.clientHeight, width: element.clientWidth }
      )

    read()
    const observer = new ResizeObserver(read)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return { box, room }
}

function CeoCard({ board, highlight }: { board: KanbanBoard; highlight: boolean }) {
  const waiting = useInboxCount(board)

  return (
    <button
      className="flex w-72 cursor-pointer items-center gap-3 rounded-2xl border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) p-3.5 text-left transition-[box-shadow,border-color] hover:border-(--ui-text-tertiary)"
      data-org-ceo=""
      onClick={() => $boardView.set('inbox')}
      style={{ boxShadow: highlight ? '0 0 0 2px var(--ui-text-secondary)' : undefined }}
      type="button"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-(--ui-control-active-background) text-foreground">
        <Codicon name="account" size="1.25rem" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.625rem] font-semibold tracking-[0.1em] text-(--ui-text-tertiary) uppercase">
          {ORG.ceo.level}
        </span>
        <span className="block text-[1rem] font-semibold text-foreground">{ORG.ceo.name}</span>
        <span
          className={cn(
            'block text-[0.8125rem]',
            waiting ? 'text-(--ui-text-secondary)' : 'text-(--ui-text-quaternary)'
          )}
        >
          {ORG.ceo.waiting(waiting)}
        </span>
      </span>
    </button>
  )
}

/** Whether `name` may be dropped on `target` to report there (CEO = the top of the team). */
function canDropOn(chart: ChartState, name: string, target: string) {
  const profile = chart.profiles.find(item => item.name === name)

  if (!profile) {
    return false
  }

  if (target === CEO) {
    return Boolean(profile.reports_to)
  }

  return target !== profile.reports_to && canReportTo(chart.profiles, name, target)
}

export interface OrgCanvasProps {
  board: KanbanBoard
  chart: ChartState
  dense: boolean
  onScale: (scale: number) => void
  setZoom: (zoom: number) => void
  trees: OrgNode[]
  zoom: null | number
}

export function OrgCanvas({ board, chart, dense, onScale, setZoom, trees, zoom }: OrgCanvasProps) {
  const look: Look = dense ? 'dense' : 'detailed'
  const placedByLook = useValue($orgPlaced)
  const placed = placedByLook[look]
  const { heights, measure } = useHeights()
  const { box, room } = useRoom()
  const layer = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)

  const width = CARD_WIDTH[look]
  const tallest = heights.size ? Math.max(...[...heights].filter(([name]) => name !== CEO).map(([, h]) => h), 0) : 0
  const cardHeight = tallest || CARD_GUESS[look]

  const sizeOf = (name: string): Size =>
    name === CEO
      ? { height: heights.get(CEO) ?? CEO_SIZE.height, width: CEO_SIZE.width }
      : { height: heights.get(name) ?? cardHeight, width }

  const settled = withPlaced(autoLayout(trees, sizeOf), placed, trees)
  const area = drag?.area ?? bounds(settled, sizeOf)
  const places = drag ? new Map(settled).set(drag.name, { x: drag.x, y: drag.y }) : settled
  const full = { height: area.height + PAD * 2, width: area.width + PAD * 2 }

  const fit = Math.max(MIN_ZOOM, Math.min(1, (room.width - 16) / full.width, (room.height - 16) / full.height))
  const scale = zoom ?? (room.width && full.width ? fit : 1)

  useEffect(() => onScale(scale), [onScale, scale])

  useEffect(() => {
    const element = box.current

    if (!element) {
      return
    }

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        setZoom(clampZoom(scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12)))
      }
    }

    element.addEventListener('wheel', onWheel, { passive: false })

    return () => element.removeEventListener('wheel', onWheel)
  }, [box, scale, setZoom])

  const at = (point: Point) => ({ x: point.x - area.minX + PAD, y: point.y - area.minY + PAD })

  const startDrag = (name: string, event: ReactPointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(NO_DRAG)) {
      return
    }

    const origin = settled.get(name)!
    const frozen = area
    const sx = event.clientX
    const sy = event.clientY
    let moved = false
    let last: Drag | null = null

    const onMove = (move: PointerEvent) => {
      if (!moved && Math.hypot(move.clientX - sx, move.clientY - sy) < 5) {
        return
      }

      moved = true
      const rect = layer.current!.getBoundingClientRect()

      const pointer = {
        x: (move.clientX - rect.left) / scale + frozen.minX - PAD,
        y: (move.clientY - rect.top) / scale + frozen.minY - PAD
      }

      const under = cardAt(pointer, settled, sizeOf, name)
      const target = under && canDropOn(chart, name, under) ? under : null
      last = {
        area: frozen,
        name,
        target,
        x: origin.x + (move.clientX - sx) / scale,
        y: origin.y + (move.clientY - sy) / scale
      }
      setDrag(last)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDrag(null)

      if (!moved || !last) {
        return
      }

      dragged.current = true
      const { [name]: _gone, ...others } = placed ?? {}

      if (last.target) {
        // A new manager: the card goes back to the automatic layout, under it.
        $orgPlaced.set({ ...placedByLook, [look]: others })
        chart.move(name, last.target === CEO ? '' : last.target)
      } else {
        $orgPlaced.set({ ...placedByLook, [look]: { ...others, [name]: { x: last.x, y: last.y } } })
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // The click that ends a drag is not a click on the card.
  const swallowClick = (event: React.MouseEvent) => {
    if (dragged.current) {
      dragged.current = false
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const profiles = new Map(chart.profiles.map(profile => [profile.name, profile]))
  const ceo = at(places.get(CEO) ?? { x: 0, y: 0 })

  return (
    <div
      className={cn('flex h-full w-full overflow-auto', drag && 'cursor-grabbing select-none')}
      data-org-canvas=""
      ref={box}
    >
      <div className="m-auto shrink-0" style={{ height: full.height * scale, width: full.width * scale }}>
        <div
          className="relative origin-top-left"
          ref={layer}
          style={{ height: full.height, transform: `scale(${scale})`, width: full.width }}
        >
          <svg aria-hidden className="pointer-events-none absolute inset-0" height={full.height} width={full.width}>
            <g
              fill="none"
              stroke="var(--ui-stroke-secondary)"
              strokeLinejoin="round"
              strokeWidth={1.25}
              transform={`translate(${PAD - area.minX} ${PAD - area.minY})`}
            >
              {links(trees, places, sizeOf).map(line => (
                <path d={line.d} key={line.id} />
              ))}
            </g>
          </svg>
          <div className="absolute" ref={measure(CEO)} style={{ left: ceo.x, top: ceo.y }} {...dropTarget(chart, '')}>
            <CeoCard board={board} highlight={drag?.target === CEO || chart.over === ''} />
          </div>
          {[...places].map(([name, point]) => {
            const profile = profiles.get(name)

            if (name === CEO || !profile) {
              return null
            }

            const spot = at(point)
            const moving = drag?.name === name

            return (
              <div
                className={cn(
                  'absolute touch-none',
                  moving ? 'z-20 cursor-grabbing opacity-85 drop-shadow-2xl' : 'cursor-grab'
                )}
                data-org-place={name}
                key={name}
                onClickCapture={swallowClick}
                onPointerDown={event => startDrag(name, event)}
                ref={measure(name)}
                style={{ left: spot.x, top: spot.y, width }}
                // An agent dragged in from "Not placed yet" (or the card grid) lands here too.
                {...dropTarget(chart, name)}
              >
                <MemberCard {...chart.member(profile)} highlight={drag?.target === name || chart.over === name} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
