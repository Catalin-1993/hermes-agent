import { describe, expect, it } from 'vitest'

import { directiveFrameHeight } from './inline-preview-directive'

describe('directiveFrameHeight', () => {
  it('returns null (auto-size) when absent or garbage', () => {
    expect(directiveFrameHeight(undefined)).toBeNull()
    expect(directiveFrameHeight('')).toBeNull()
    expect(directiveFrameHeight('tall')).toBeNull()
    expect(directiveFrameHeight('12.5')).toBeNull()
  })

  it('clamps an explicit height to the sane band', () => {
    expect(directiveFrameHeight('50')).toBe(120)
    expect(directiveFrameHeight('480')).toBe(480)
    expect(directiveFrameHeight('99999')).toBe(1200)
  })
})
