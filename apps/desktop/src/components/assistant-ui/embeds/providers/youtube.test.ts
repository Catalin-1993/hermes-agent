import { describe, expect, it } from 'vitest'

import { youtubePlayerSrc } from './youtube'

const EMBED = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?modestbranding=1&rel=0'

describe('youtubePlayerSrc', () => {
  it('starts playing only when asked to', () => {
    expect(new URL(youtubePlayerSrc(EMBED)).searchParams.has('autoplay')).toBe(false)
    expect(new URL(youtubePlayerSrc(EMBED, { autoplay: true })).searchParams.get('autoplay')).toBe('1')
  })

  it('never names the app as the embedder', () => {
    expect(new URL(youtubePlayerSrc(EMBED, { autoplay: true })).searchParams.has('origin')).toBe(false)
  })

  it('keeps the video and the options the matcher chose', () => {
    const url = new URL(youtubePlayerSrc(EMBED, { autoplay: true }))

    expect(url.pathname).toBe('/embed/dQw4w9WgXcQ')
    expect(url.searchParams.get('rel')).toBe('0')
  })
})
