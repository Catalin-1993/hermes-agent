import { describe, expect, it } from 'vitest'

import { blocksGuestFrameNavigation } from './guest-frame-navigation'

const sealed = 'data:text/html;charset=utf-8,%3Cp%3Eblock%3C%2Fp%3E'

describe('blocksGuestFrameNavigation', () => {
  it('keeps a sealed frame from sending itself to the web', () => {
    for (const toUrl of [
      'https://evil.example/?d=secret',
      'http://127.0.0.1:9119/',
      'file:///etc/passwd',
      ' HTTPS://a.b'
    ]) {
      expect(blocksGuestFrameNavigation({ fromUrl: sealed, isMainFrame: false, toUrl })).toBe(true)
    }
  })

  it('seals a chat widget (srcdoc) the same way', () => {
    expect(
      blocksGuestFrameNavigation({ fromUrl: 'about:srcdoc', isMainFrame: false, toUrl: 'https://evil.example/?d=x' })
    ).toBe(true)
    expect(blocksGuestFrameNavigation({ fromUrl: 'about:srcdoc', isMainFrame: false, toUrl: 'about:blank' })).toBe(
      false
    )
  })

  it('lets it stay sealed, and leaves every other frame alone', () => {
    expect(blocksGuestFrameNavigation({ fromUrl: sealed, isMainFrame: false, toUrl: 'data:text/html,next' })).toBe(
      false
    )
    expect(blocksGuestFrameNavigation({ fromUrl: sealed, isMainFrame: false, toUrl: 'about:blank' })).toBe(false)
    expect(
      blocksGuestFrameNavigation({
        fromUrl: 'https://plugin.example/app',
        isMainFrame: false,
        toUrl: 'https://plugin.example/next'
      })
    ).toBe(false)
    expect(blocksGuestFrameNavigation({ fromUrl: sealed, isMainFrame: true, toUrl: 'https://a.example' })).toBe(false)
    expect(blocksGuestFrameNavigation({ fromUrl: '', isMainFrame: false, toUrl: 'https://a.example' })).toBe(false)
  })
})
