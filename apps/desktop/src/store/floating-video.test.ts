import { beforeEach, describe, expect, it } from 'vitest'

import {
  $floatingMinimized,
  $floatingPlacement,
  $floatingPlayback,
  $floatingVideo,
  $returnedVideo,
  closeFloatingVideo,
  popOutVideo,
  returnFloatingVideo,
  setFloatingMinimized,
  setFloatingPlacement
} from './floating-video'

const VIDEO = {
  embedUrl: 'https://www.youtube-nocookie.com/embed/abc123DEF45',
  key: 'k1',
  startAt: 81,
  title: 'Psychic'
}

beforeEach(() => closeFloatingVideo())

describe('the floating video player', () => {
  it('pops a video out where it was, shown, and playing', () => {
    setFloatingMinimized(true)
    popOutVideo(VIDEO)

    expect($floatingVideo.get()).toEqual(VIDEO)
    expect($floatingMinimized.get()).toBe(false)
    expect($floatingPlayback.get()).toMatchObject({ currentTime: 81, playing: true })
  })

  it('sends it back to its chat player at the moment it reached', () => {
    popOutVideo(VIDEO)
    $floatingPlayback.set({ currentTime: 142, duration: 220, playing: true })
    returnFloatingVideo()

    expect($floatingVideo.get()).toBeNull()
    expect($returnedVideo.get()).toEqual({ key: 'k1', time: 142 })
  })

  it('remembers where it was pinned', () => {
    setFloatingPlacement({ corner: 'top-left', size: 'large', x: 0, y: 0 })

    expect($floatingPlacement.get()).toEqual({ corner: 'top-left', size: 'large', x: 0, y: 0 })
    expect(JSON.parse(localStorage.getItem('hermes-floating-video-placement-v1') || '{}')).toMatchObject({
      corner: 'top-left'
    })
  })
})
