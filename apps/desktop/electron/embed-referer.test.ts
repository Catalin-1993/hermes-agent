import { describe, expect, it, vi } from 'vitest'

import { stampEmbedReferer } from './embed-referer'
import { attachRemoteRequestHeaderListener } from './remote-ws-headers'

describe('stampEmbedReferer', () => {
  it('gives the YouTube player a Referer when the page sent none', () => {
    for (const url of [
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/youtubei/v1/player',
      'https://rr1---sn-x.googlevideo.com/videoplayback',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    ]) {
      expect(stampEmbedReferer(url, { Accept: '*/*' })).toEqual({
        Accept: '*/*',
        Referer: 'https://hermes-agent.nousresearch.com/'
      })
    }
  })

  it('keeps a Referer the page already sent, whatever its casing', () => {
    const headers = { referer: 'http://localhost:5173/' }

    expect(stampEmbedReferer('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', headers)).toBe(headers)
  })

  it('leaves every other host alone', () => {
    const headers = { Accept: '*/*' }

    expect(stampEmbedReferer('https://example.com/video', headers)).toBe(headers)
    expect(stampEmbedReferer('https://notyoutube.com/', headers)).toBe(headers)
    expect(stampEmbedReferer('not a url', headers)).toBe(headers)
  })

  it('shares the session listener with the remote headers rather than replacing them', () => {
    const listeners: Array<(details: any, callback: (result: any) => void) => void> = []
    const session = { webRequest: { onBeforeSendHeaders: (listener: any) => void listeners.push(listener) } }

    attachRemoteRequestHeaderListener(
      session,
      url => (url.startsWith('https://gateway.example') ? { 'X-Access': 'token' } : {}),
      stampEmbedReferer
    )

    const stamped = vi.fn()
    const gateway = vi.fn()
    const other = vi.fn()

    listeners[0]!({ requestHeaders: {}, url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }, stamped)
    listeners[0]!({ requestHeaders: { Origin: 'app://hermes' }, url: 'https://gateway.example/api' }, gateway)
    listeners[0]!({ requestHeaders: {}, url: 'https://example.com/' }, other)

    expect(listeners).toHaveLength(1)
    expect(stamped).toHaveBeenCalledWith({ requestHeaders: { Referer: 'https://hermes-agent.nousresearch.com/' } })
    expect(gateway).toHaveBeenCalledWith({ requestHeaders: { Origin: 'app://hermes', 'X-Access': 'token' } })
    expect(other).toHaveBeenCalledWith({})
  })
})
