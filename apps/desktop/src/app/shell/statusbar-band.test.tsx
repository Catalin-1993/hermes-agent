// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { type ReactNode, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubResizeObserver } from '@/test/jsdom'

import { bandImage, isPainted, opaque, useStatusbarBand } from './statusbar-band'

describe('isPainted', () => {
  it.each(['', 'transparent', 'rgba(0, 0, 0, 0)', 'color(srgb 0.2 0.2 0.2 / 0)'])('reads %j as nothing', color => {
    expect(isPainted(color)).toBe(false)
  })

  it.each(['rgb(245, 245, 245)', 'rgba(0, 0, 0, 0.5)', 'color(srgb 0.96 0.96 0.96)', 'oklab(0.3 0 0)'])(
    'reads %s as paint',
    color => {
      expect(isPainted(color)).toBe(true)
    }
  )
})

describe('opaque', () => {
  // Under glass the page's surfaces are part-transparent; the bar must not let the window through.
  it('wears a part-transparent surface colour at full strength, and leaves an opaque one as it is', () => {
    expect(opaque('rgba(249, 249, 247, 0.62)')).toBe('rgb(249, 249, 247)')
    expect(opaque('color(srgb 0.97 0.97 0.96 / 0.6)')).toBe('color(srgb 0.97 0.97 0.96)')
    expect(opaque('oklab(0.3 0.01 0.02 / 40%)')).toBe('oklab(0.3 0.01 0.02)')
    expect(opaque('rgb(17, 17, 17)')).toBe('rgb(17, 17, 17)')
  })
})

describe('bandImage', () => {
  it('paints nothing when no surface ends on the bar', () => {
    expect(bandImage([])).toBe('none')
  })

  it('keeps every fill on its own span, in order, whatever order the spans arrive in', () => {
    const image = bandImage([
      { fill: 'rgb(245, 245, 245)', from: 930, to: 1167 },
      { fill: 'rgb(253, 253, 253)', from: 237, to: 930 }
    ])

    const positions = [...image.matchAll(/(\d+(?:\.\d+)?)px/g)].map(match => Number(match[1]))

    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    expect(image.indexOf('rgb(253, 253, 253)')).toBeLessThan(image.indexOf('rgb(245, 245, 245)'))
  })
})

// Geometry the way a browser would report it, for a window of 1167 × 759 with the bar along the bottom
// (739–759): the sessions rail, the reading sheet, and a right column split into files above a terminal.
const RECTS = {
  bar: [0, 739, 1167, 759],
  files: [930, 0, 1167, 587],
  main: [237, 0, 930, 739],
  sessions: [0, 0, 237, 739],
  terminal: [930, 587, 1167, 739]
} as const

type Rect = readonly [number, number, number, number]

function Shell({ terminalPaint, extra }: { extra?: ReactNode; terminalPaint?: string }) {
  const footer = useRef<HTMLElement | null>(null)

  useStatusbarBand(footer)

  const rect = (r: Rect) => r.join(',')

  return (
    <div data-contrib-shell="">
      <div data-rect={rect(RECTS.sessions)} data-tree-group="grp-sessions" />
      <div data-rect={rect(RECTS.main)} data-tree-group="grp-main" style={{ backgroundColor: 'rgb(253, 253, 253)' }}>
        {/* The composer card floats above the bar: it ends well short of it. */}
        <div data-rect="300,690,880,730" style={{ backgroundColor: 'rgb(255, 255, 255)' }} />
      </div>
      <div data-rect={rect(RECTS.files)} data-tree-group="grp-files" />
      <div data-rect={rect(RECTS.terminal)} data-tree-group="grp-terminal" />
      {/* Keep-alive host: a layer over the terminal zone, painting the terminal's own surface. */}
      <div data-pane-host="" data-rect={rect(RECTS.terminal)} data-tree-group="grp-terminal">
        <div data-rect={rect(RECTS.terminal)} style={{ backgroundColor: terminalPaint }} />
      </div>
      {extra}
      <footer data-rect={rect(RECTS.bar)} ref={footer} />
    </div>
  )
}

const bandOf = (container: HTMLElement) => container.querySelector('footer')!.style.getPropertyValue('--statusbar-band')

describe('useStatusbarBand', () => {
  beforeEach(() => {
    stubResizeObserver()

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const [left, top, right, bottom] = (this.getAttribute('data-rect') ?? '0,0,0,0').split(',').map(Number)

      return { bottom, height: bottom - top, left, right, top, width: right - left, x: left, y: top } as DOMRect
    })

    // Topmost first, like the real thing: later in document order paints over earlier.
    window.document.elementsFromPoint = (x, y) =>
      [...window.document.querySelectorAll('[data-rect]')]
        .filter(el => {
          const [left, top, right, bottom] = (el.getAttribute('data-rect') as string).split(',').map(Number)

          return x >= left && x < right && y >= top && y < bottom
        })
        .reverse()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('carries the reading sheet to the bottom edge, and leaves the rails clear', () => {
    const { container } = render(<Shell />)
    const band = bandOf(container)

    expect(band).toContain('rgb(253, 253, 253)')
    // The composer card floats above the bar, so its white never reaches it.
    expect(band).not.toContain('rgb(255, 255, 255)')
  })

  // The bug: an opaque terminal sits at the bottom of the right column, and the bar beneath it showed
  // the window gradient's dark end instead of the terminal's own colour.
  it('wears the terminal surface under the right column, as an extension of it', () => {
    const { container } = render(<Shell terminalPaint="rgb(245, 245, 245)" />)

    const band = bandOf(container)

    expect(band).toContain('rgb(245, 245, 245) 930px')
    expect(band).toContain('rgb(245, 245, 245) 1167px')
    expect(band).toContain('rgb(253, 253, 253) 237px')
  })

  it('stays clear under a column that paints nothing, so the gradient continues', () => {
    const { container } = render(<Shell />)

    // Only the sheet is painted: its fill opens and closes the one span.
    expect(bandOf(container).match(/rgb\(/g)).toHaveLength(2)
    expect(bandOf(container)).not.toContain('930px, rgb')
  })

  it('ignores an overlay laid over the whole window', () => {
    const scrim = <div data-rect="0,0,1167,759" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} />
    const { container } = render(<Shell extra={scrim} terminalPaint="rgb(245, 245, 245)" />)

    expect(bandOf(container)).not.toContain('rgba(0, 0, 0, 0.5)')
    expect(bandOf(container)).toContain('rgb(245, 245, 245)')
  })
})
