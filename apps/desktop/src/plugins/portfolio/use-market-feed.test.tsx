import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BACKOFF_S, useMarketFeed } from './use-market-feed'

class FakeSocket {
  static all: FakeSocket[] = []
  onclose: (() => void) | null = null
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  constructor(readonly url: string) {
    FakeSocket.all.push(this)
  }
  close() {}
}

describe('useMarketFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeSocket.all = []
    globalThis.WebSocket = FakeSocket as never
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline'))) as never
  })

  afterEach(() => vi.useRealTimers())

  it('goes live when the socket opens, then retries with a growing wait and ends offline with a way back', () => {
    const { result } = renderHook(() => useMarketFeed(['BTC'], 'BTC', '1h'))
    expect(result.current.status).toBe('connecting')

    act(() => FakeSocket.all[0].onopen?.())
    expect(result.current.status).toBe('live')

    // The connection drops and never comes back: every wait in the ladder, then offline.
    let socket = FakeSocket.all[0]

    for (const [index, wait] of BACKOFF_S.entries()) {
      act(() => socket.onclose?.())
      expect(result.current.status).toBe('connecting')
      act(() => vi.advanceTimersByTime(wait * 1000))
      expect(FakeSocket.all).toHaveLength(index + 2)
      socket = FakeSocket.all[index + 1]
    }

    act(() => socket.onclose?.())
    expect(result.current.status).toBe('offline')

    act(() => result.current.retry())
    expect(FakeSocket.all).toHaveLength(BACKOFF_S.length + 2)
    expect(result.current.status).toBe('connecting')
  })
})
