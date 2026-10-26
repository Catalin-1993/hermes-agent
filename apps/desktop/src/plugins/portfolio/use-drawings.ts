/**
 * Making and editing drawings the way TradingView does: pick a tool, click where it starts, move the mouse
 * (the line follows) and click where it ends — or press, drag and release. A drawing is selected by a click
 * on it, then its handles stretch it, its body moves it whole, Delete removes it. The state is kept in a
 * ref, because the pointer events arrive faster than React re-renders; a counter repaints on change.
 */

import { type KeyboardEvent, useReducer, useRef } from 'react'

import { type DrawingType, isDrawingTool, makeDrawing, pointsNeeded, shifted, withPoint } from './drawing-model'
import type { PointerInfo } from './studio-canvas'
import type { ChartDoc, ChartPoint, Drawing } from './studio-model'
import type { Tool } from './studio-toolbar'
import { newId } from './use-chart-doc'

interface Drag {
  id: string
  index: number
  origin: ChartPoint
  original: Drawing
  part: 'body' | 'handle'
}

interface Work {
  drag: Drag | null
  draft: Drawing | null
  hoverId: null | string
  pending: { end: ChartPoint; start: ChartPoint; type: DrawingType } | null
  selectedId: null | string
}

const PREVIEW_ID = 'preview'

export function useDrawings({
  drawings,
  setTool,
  tool,
  update
}: {
  drawings: Drawing[]
  setTool: (tool: Tool) => void
  tool: Tool
  update: (change: (current: ChartDoc) => ChartDoc) => Promise<void>
}) {
  const [, repaint] = useReducer((count: number) => count + 1, 0)
  const work = useRef<Work>({ drag: null, draft: null, hoverId: null, pending: null, selectedId: null })
  const latest = useRef({ drawings, tool })
  latest.current = { drawings, tool }

  const w = work.current

  const set = (next: Partial<Work>) => {
    Object.assign(work.current, next)
    repaint()
  }

  const add = (drawing: Drawing) => {
    void update(current => ({ ...current, drawings: [...current.drawings, drawing] }))
    set({ hoverId: null, pending: null, selectedId: drawing.id })
    setTool('cursor')
  }

  const replace = (drawing: Drawing) =>
    void update(current => ({
      ...current,
      drawings: current.drawings.map(existing => (existing.id === drawing.id ? drawing : existing))
    }))

  const remove = (id: string) => {
    void update(current => ({ ...current, drawings: current.drawings.filter(drawing => drawing.id !== id) }))
    set({ hoverId: null, selectedId: work.current.selectedId === id ? null : work.current.selectedId })
  }

  const down = ({ hit, point }: PointerInfo): boolean => {
    const { drawings: all, tool: current } = latest.current

    if (isDrawingTool(current) && point) {
      const pending = work.current.pending

      if (pointsNeeded(current) === 1) {
        add(makeDrawing(current, newId(), point))
      } else if (pending) {
        add(makeDrawing(pending.type, newId(), pending.start, point))
      } else {
        set({ pending: { end: point, start: point, type: current }, selectedId: null })
      }

      return true
    }

    if (current !== 'cursor') {
      return false
    }

    if (!hit || !point) {
      set({ selectedId: null })

      return false
    }

    const original = all.find(drawing => drawing.id === hit.id)

    if (!original) {
      return false
    }

    set({
      drag: { id: hit.id, index: hit.part === 'handle' ? hit.index : 0, origin: point, original, part: hit.part },
      selectedId: hit.id
    })

    return true
  }

  const move = ({ hit, point }: PointerInfo) => {
    const { drag, pending } = work.current

    if (drag && point) {
      const draft =
        drag.part === 'handle'
          ? withPoint(drag.original, drag.index, point)
          : shifted(drag.original, drag.origin, point)

      set({ draft })
    } else if (pending && point) {
      set({ pending: { ...pending, end: point } })
    } else if (latest.current.tool === 'cursor' && work.current.hoverId !== (hit?.id ?? null)) {
      set({ hoverId: hit?.id ?? null })
    }
  }

  const up = ({ moved, point }: PointerInfo) => {
    const { drag, draft, pending } = work.current

    if (drag) {
      set({ drag: null, draft: null })

      if (draft && moved) {
        replace(draft)
      }
    } else if (pending && moved && point) {
      // Press, drag and release draws it in one go; a plain click leaves it waiting for the second click.
      add(makeDrawing(pending.type, newId(), pending.start, point))
    }
  }

  const onPointer = (event: PointerInfo): boolean => {
    if (event.type === 'down') {
      return down(event)
    }

    if (event.type === 'move') {
      move(event)
    } else {
      up(event)
    }

    return false
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement

    if (target.closest('input, textarea, [contenteditable="true"]')) {
      return
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && work.current.selectedId) {
      event.preventDefault()
      remove(work.current.selectedId)
    } else if (event.key === 'Escape') {
      set({ drag: null, draft: null, pending: null, selectedId: null })
      setTool('cursor')
    }
  }

  const shown = drawings.map(drawing => (w.draft && w.draft.id === drawing.id ? w.draft : drawing))

  const preview = w.pending
    ? { ...makeDrawing(w.pending.type, PREVIEW_ID, w.pending.start, w.pending.end), color: null }
    : null

  return {
    cancel: () => set({ drag: null, draft: null, pending: null }),
    hoverId: w.hoverId,
    onKeyDown,
    onPointer,
    pending: Boolean(w.pending),
    preview,
    recolor: (id: string, color: null | string) => {
      const drawing = latest.current.drawings.find(item => item.id === id)

      if (drawing) {
        replace({ ...drawing, color })
      }
    },
    remove,
    select: (id: null | string) => set({ selectedId: id }),
    selectedId: w.selectedId,
    shown
  }
}
