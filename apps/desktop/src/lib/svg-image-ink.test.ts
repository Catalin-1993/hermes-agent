import { describe, expect, it } from 'vitest'

import { inkedSvg } from './svg-image'

describe('inkedSvg', () => {
  // The bug: a ```svg drawn with currentColor and unfilled text showed black on the dark theme, in Times.
  it('gives a bare drawing the theme ink, as its fill, and the system font', () => {
    const svg = inkedSvg('<svg viewBox="0 0 10 10"><text>Pas</text></svg>', 'rgb(240, 240, 240)')

    expect(svg).toMatch(/^<svg color="rgb\(240, 240, 240\)" fill="currentColor" font-family="[^"]*system-ui/)
    expect(svg).toContain('<text>Pas</text>')
  })

  it('keeps the colour, fill and font a drawing chose', () => {
    const own = '<svg fill="#123456" color="red" font-family="Georgia" viewBox="0 0 10 10"/>'

    expect(inkedSvg(own, 'white')).toBe(own)
  })
})
