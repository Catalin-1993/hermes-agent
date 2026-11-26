/** Brain: the Pro panel shows what the person picked there, and never an empty ring. */
import { describe, expect, it } from 'vitest'

import { resolveProAvatar } from './pro-avatar'

describe('resolveProAvatar', () => {
  it('keeps an explicit pick, falling back to Brain when no panel pet was picked', () => {
    expect(resolveProAvatar('brain', true, true)).toBe('brain')
    expect(resolveProAvatar('photo', true, false)).toBe('photo')
    expect(resolveProAvatar('pet', true, false)).toBe('pet')
    expect(resolveProAvatar('pet', false, true)).toBe('brain')
  })

  it('without a pick shows the photo, else Brain — never the app pet', () => {
    expect(resolveProAvatar('', false, true)).toBe('photo')
    expect(resolveProAvatar('', false, false)).toBe('brain')
  })
})
