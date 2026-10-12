import { describe, expect, it } from 'vitest'

import { libraryKeyAction } from './library-keys'

const key = (k: string, mods: Partial<Record<'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey', boolean>> = {}) =>
  libraryKeyAction({ altKey: false, ctrlKey: false, key: k, metaKey: false, shiftKey: false, ...mods })

describe('library keys', () => {
  it('reads ⌘ and Ctrl alike, and plain keys apart from them', () => {
    expect(key('c', { metaKey: true })).toBe(key('C', { ctrlKey: true }))
    expect(key('ArrowUp', { metaKey: true })).toBe('parent')
    expect(key('ArrowUp')).toBe('moveUp')
    expect(key(' ')).toBe('quickLook')
  })

  it('keeps Duplicate off ⌘D, which the app reserves for the default profile', () => {
    expect(key('d', { metaKey: true })).toBeNull()
    expect(key('d', { metaKey: true, shiftKey: true })).toBe('duplicate')
    expect(key('c', { metaKey: true, shiftKey: true })).toBeNull()
  })

  it('leaves typing and ⌥ chords to whoever owns them', () => {
    expect(key('c')).toBeNull()
    expect(key('d', { altKey: true, metaKey: true })).toBeNull()
  })
})
