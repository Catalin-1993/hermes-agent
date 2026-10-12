import { type RefObject, useLayoutEffect, useState } from 'react'

import { figureArea } from './widget-frame-doc'

export interface FigureArea {
  /** The figure area: the column, widened when the pane has room. */
  area: number
  /** The text column the figure sits in. */
  column: number
}

/** The widths a figure is laid out against, kept current as the window, the pane or the sidebar
 *  change: the column it is written in (its parent) and the pane it scrolls in. */
export function useFigureArea(ref: RefObject<HTMLElement | null>): FigureArea | null {
  const [size, setSize] = useState<FigureArea | null>(null)

  useLayoutEffect(() => {
    const parent = ref.current?.parentElement

    if (!parent) {
      return
    }

    const pane = parent.closest<HTMLElement>('[data-slot="aui_thread-viewport"]')

    const measure = () => {
      const column = parent.clientWidth
      const next = { area: figureArea(column, pane?.clientWidth ?? column), column }

      setSize(prev => (prev?.area === next.area && prev.column === next.column ? prev : next))
    }

    measure()

    const observer = new ResizeObserver(measure)

    observer.observe(parent)

    if (pane) {
      observer.observe(pane)
    }

    return () => observer.disconnect()
  }, [ref])

  return size
}
