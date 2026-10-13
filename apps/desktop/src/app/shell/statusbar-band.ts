import { type RefObject, useLayoutEffect } from 'react'

import { $collapsedTreeSides, $hiddenTreePanes, $layoutTree } from '@/components/pane-shell/tree/store'

// Every zone of the layout (keep-alive hosts are layers over a zone, not zones).
const ZONES = '[data-contrib-shell] [data-tree-group]:not([data-pane-host])'

// How close to the bar's top edge a surface must end to count as sitting on it, and how far into a
// zone to look — clear of the sashes between zones.
const EDGE_TOLERANCE = 2
const ZONE_INSET = 12

export interface BandSegment {
  fill: string
  from: number
  to: number
}

/** Does this computed colour paint anything? (Computed transparent is `rgba(0, 0, 0, 0)`.) */
export function isPainted(color: string): boolean {
  return color !== '' && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)' && !/\/\s*0(\.0+)?\s*\)$/.test(color)
}

/**
 * The colour at full strength. Under translucency (glass) the page's surfaces are part-transparent and stack,
 * so the page still reads solid; one such layer on the bar alone lets the window's material through and
 * the bar comes out a dark strip below a light page. The bar wears the surface's colour opaque instead.
 */
export function opaque(color: string): string {
  const rgba = /^rgba\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*[^)]+\)$/.exec(color)

  if (rgba) {
    return `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`
  }

  return color.replace(/\s*\/\s*[\d.]+%?\s*\)$/, ')')
}

/** The bar's background: clear everywhere except the given spans, which wear their fill. */
export function bandImage(segments: readonly BandSegment[]): string {
  if (segments.length === 0) {
    return 'none'
  }

  const stops = [...segments]
    .sort((a, b) => a.from - b.from)
    .flatMap(({ fill, from, to }) => [
      `transparent ${from}px`,
      `${fill} ${from}px`,
      `${fill} ${to}px`,
      `transparent ${to}px`
    ])

  return `linear-gradient(to right, ${stops.join(', ')})`
}

/**
 * The colour of the surface that ends exactly on the bar's top edge at `x`, if it paints one. Looking
 * for the surface that ENDS there (rather than the topmost painted element) keeps overlays, scrims and
 * the page's own backgrounds out of it.
 */
function surfaceEndingOn(bar: DOMRect, x: number): null | string {
  for (const el of document.elementsFromPoint(x, bar.top - 1)) {
    if (Math.abs(el.getBoundingClientRect().bottom - bar.top) >= EDGE_TOLERANCE) {
      continue
    }

    const color = getComputedStyle(el).backgroundColor

    if (isPainted(color)) {
      return opaque(color)
    }
  }

  return null
}

function measure(bar: HTMLElement): BandSegment[] {
  const edge = bar.getBoundingClientRect()
  const segments: BandSegment[] = []

  for (const zone of document.querySelectorAll(ZONES)) {
    const rect = zone.getBoundingClientRect()

    if (rect.width <= 0 || Math.abs(rect.bottom - edge.top) >= EDGE_TOLERANCE) {
      continue
    }

    const fill = surfaceEndingOn(edge, Math.min(rect.left + ZONE_INSET, rect.right - 1))

    if (fill) {
      segments.push({ fill, from: rect.left - edge.left, to: rect.right - edge.left })
    }
  }

  return segments
}

/**
 * The status bar runs under every column. Where a surface — the reading sheet, the terminal, a review
 * or browser pane — ends on it, the bar wears that surface's colour so the surface reaches the window's
 * bottom edge; under the rails it stays clear and the window gradient shows through. Writes the result
 * as `--statusbar-band` on the footer (shell-surfaces.css paints it).
 */
export function useStatusbarBand(footer: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const bar = footer.current

    if (!bar) {
      return
    }

    const observed = new Set<Element>()
    const observer = new ResizeObserver(() => read())

    function read() {
      const zones = new Set(document.querySelectorAll(ZONES))

      for (const zone of observed) {
        if (!zones.has(zone)) {
          observer.unobserve(zone)
          observed.delete(zone)
        }
      }

      for (const zone of zones) {
        if (!observed.has(zone)) {
          observer.observe(zone)
          observed.add(zone)
        }
      }

      bar!.style.setProperty('--statusbar-band', bandImage(measure(bar!)))
    }

    // Zones come and go (a sidebar opens, the terminal toggles), routes swap the surface, themes
    // recolour it — none of which resizes a zone already observed. Measure once it has laid out.
    let frame = 0

    const readSoon = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => (frame = requestAnimationFrame(read)))
    }

    // A theme switch settles over more than two frames: under translucency the window's native material
    // follows the new scheme a beat later, and a bar measured mid-switch kept the old theme's colour (a
    // black strip on a light page) until the next resize. Measure again once it has settled.
    const settleTimers: number[] = []

    const readSettled = () => {
      readSoon()
      settleTimers.splice(0).forEach(timer => window.clearTimeout(timer))
      settleTimers.push(window.setTimeout(read, 350), window.setTimeout(read, 1000))
    }

    const themeObserver = new MutationObserver(readSettled)
    themeObserver.observe(document.documentElement, {
      attributeFilter: [
        'class',
        'style',
        'data-hermes-clear',
        'data-hermes-glass',
        'data-hermes-glass-on',
        'data-hermes-glass-scope'
      ],
      attributes: true
    })

    const unlisten = [$layoutTree, $collapsedTreeSides, $hiddenTreePanes].map(store => store.listen(readSoon))

    observer.observe(bar)
    observer.observe(document.body)
    read()
    window.addEventListener('resize', read)
    window.addEventListener('hashchange', readSoon)

    return () => {
      cancelAnimationFrame(frame)
      settleTimers.forEach(timer => window.clearTimeout(timer))
      observer.disconnect()
      themeObserver.disconnect()
      unlisten.forEach(off => off())
      window.removeEventListener('resize', read)
      window.removeEventListener('hashchange', readSoon)
    }
  }, [footer])
}
