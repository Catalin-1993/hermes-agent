import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSteadyComposerHeight } from './use-steady-composer-height'

let height = 112

let notify: () => void = () => {}

class FakeObserver {
  constructor(callback: () => void) {
    notify = callback
  }
  disconnect() {}
  observe() {}
}

function Probe({ onHeight }: { onHeight: (value: null | number) => void }) {
  const ref = useRef<HTMLSpanElement>(null)

  onHeight(useSteadyComposerHeight(ref))

  return <span ref={ref} />
}

beforeEach(() => {
  vi.useFakeTimers()
  height = 112
  vi.stubGlobal('ResizeObserver', FakeObserver)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ height }) as DOMRect)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useSteadyComposerHeight', () => {
  // The bug: dictation grew the composer, and the splash artwork swelled and jumped with it.
  it('holds the resting height when the composer grows, and follows it when it shrinks', () => {
    let seen: null | number = null

    render(<Probe onHeight={value => (seen = value)} />)
    expect(seen).toBe(112)

    act(() => vi.advanceTimersByTime(2000))
    height = 230
    act(() => notify())
    expect(seen).toBe(112)

    height = 96
    act(() => notify())
    expect(seen).toBe(96)
  })

  it('starts over when the window is resized', () => {
    let seen: null | number = null

    render(<Probe onHeight={value => (seen = value)} />)
    act(() => vi.advanceTimersByTime(2000))
    height = 140
    act(() => window.dispatchEvent(new Event('resize')))

    expect(seen).toBe(140)
  })
})
