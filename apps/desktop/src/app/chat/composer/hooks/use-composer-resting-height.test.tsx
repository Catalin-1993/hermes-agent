import { cleanup, render } from '@testing-library/react'
import { type RefObject, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { COMPOSER_HEIGHT_VAR, COMPOSER_RESTING_HEIGHT_VAR } from '@/app/chat/surface-vars'

import { useComposerMetrics } from './use-composer-metrics'

vi.mock('@assistant-ui/react', () => ({
  useAuiState: (selector: (state: { composer: { text: string } }) => unknown) => selector({ composer: { text: '' } })
}))

// The shared ResizeObserver delivers once per observed element after
// observe(); replay that by hand so the hook's initial measurement runs where
// it would in Chromium.
const observers: FakeResizeObserver[] = []

class FakeResizeObserver implements ResizeObserver {
  readonly targets = new Set<Element>()

  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this)
  }

  disconnect() {
    this.targets.clear()
  }

  observe(target: Element) {
    this.targets.add(target)
  }

  unobserve(target: Element) {
    this.targets.delete(target)
  }
}

const deliverResize = () => {
  for (const observer of observers) {
    const entries = [...observer.targets].map(target => ({ target }) as ResizeObserverEntry)

    if (entries.length > 0) {
      observer.callback(entries, observer)
    }
  }
}

const sized =
  (ref: RefObject<HTMLDivElement | null>, height: number) =>
  (node: HTMLDivElement | null): void => {
    if (node) {
      node.getBoundingClientRect = () =>
        ({ bottom: height, height, left: 0, right: 640, top: 0, width: 640, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    }

    ref.current = node
  }

function Harness({ dockHeight, surfaceHeight }: { dockHeight: number; surfaceHeight: number }) {
  const composerDockRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLFormElement | null>(null)
  const composerSurfaceRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<HTMLDivElement | null>(null)

  useComposerMetrics({ composerDockRef, composerRef, composerSurfaceRef, editorRef, poppedOut: false })

  return (
    <div data-chat-surface="">
      <div ref={sized(composerDockRef, dockHeight)}>
        <form ref={composerRef}>
          <div ref={sized(composerSurfaceRef, surfaceHeight)}>
            <div ref={editorRef} />
          </div>
        </form>
      </div>
    </div>
  )
}

const surfaceOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-chat-surface]')!

/**
 * The composer grows OVER the conversation: dictation, a voice conversation or a multi-line draft grow
 * the composer surface, and the thread's clearance (the resting height) must not follow, or every message
 * and the splash jump up. What grows outside the surface — the status stack while a reply streams — still
 * moves the clearance, so the streaming tail is never hidden under it.
 */
describe('useComposerMetrics — resting height', () => {
  beforeEach(() => {
    observers.length = 0
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('holds when the surface grows and follows when the dock grows outside it', () => {
    const { container, rerender } = render(<Harness dockHeight={120} surfaceHeight={56} />)
    deliverResize()
    const surface = surfaceOf(container)
    const resting = () => surface.style.getPropertyValue(COMPOSER_RESTING_HEIGHT_VAR)

    expect(resting()).toBe('120px')

    // Voice starts: a 48px row appears inside the surface.
    rerender(<Harness dockHeight={168} surfaceHeight={104} />)
    deliverResize()
    expect(surface.style.getPropertyValue(COMPOSER_HEIGHT_VAR)).toBe('168px')
    expect(resting()).toBe('120px')

    // Voice ends; a reply starts and the status stack (outside the surface) adds 40px.
    rerender(<Harness dockHeight={160} surfaceHeight={56} />)
    deliverResize()
    expect(resting()).toBe('160px')
  })
})
