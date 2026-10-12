import { describe, expect, it } from 'vitest'

import { fileCategoryOf, ITEM_TYPE_ICON, ITEM_TYPE_TINT, itemTypeOf } from './file-types'

describe('library file types', () => {
  it('trusts the extension over a generic upload MIME, and falls back to the MIME without one', () => {
    expect(fileCategoryOf({ file_name: 'deck.pptx', mime: 'application/octet-stream' })).toBe('presentation')
    expect(fileCategoryOf({ file_name: 'clip', mime: 'video/mp4' })).toBe('video')
    expect(fileCategoryOf({ file_name: 'blob.unknownext', mime: null })).toBe('file')
  })

  it('gives every type a glyph and a tint', () => {
    for (const type of Object.keys(ITEM_TYPE_ICON) as (keyof typeof ITEM_TYPE_ICON)[]) {
      expect(ITEM_TYPE_TINT[type]).toBeTruthy()
    }

    expect(itemTypeOf({ file_name: null, kind: 'folder', mime: null })).toBe('folder')
  })
})
