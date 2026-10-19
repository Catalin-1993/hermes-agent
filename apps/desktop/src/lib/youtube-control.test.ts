import { describe, expect, it } from 'vitest'

import { youtubeInfoFrom } from './youtube-control'

describe('youtubeInfoFrom', () => {
  it('reads where the player is from its info messages', () => {
    const message = JSON.stringify({
      event: 'infoDelivery',
      info: { currentTime: 81.4, duration: 220, playerState: 1, videoData: { title: 'Psychic' } }
    })

    expect(youtubeInfoFrom(message)).toEqual({ currentTime: 81.4, duration: 220, playerState: 1, title: 'Psychic' })
  })

  it('ignores anything that is not a player report', () => {
    expect(youtubeInfoFrom('not json')).toBeNull()
    expect(youtubeInfoFrom({ event: 'onReady' })).toBeNull()
    expect(youtubeInfoFrom(null)).toBeNull()
  })
})
