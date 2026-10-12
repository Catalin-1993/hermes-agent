import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { buildDocx } from './deck-docx'

const deck = {
  slides: [
    '# Launch\n\nA **bold** start & more',
    '## Plan\n\n- one\n  - nested\n1. first\n\n> said\n\n```\ncode <x>\n```\n\n![pic](library://img1)'
  ],
  theme: 'paper' as const
}

describe('a deck as a Word document', () => {
  it('writes well-formed parts with the text of every slide and a break between slides', async () => {
    const png = new Uint8Array([137, 80, 78, 71])

    const files = unzipSync(
      await buildDocx(deck, 'My <deck>', async () => ({ bytes: png, ext: 'png', h: 100, w: 200 }))
    )

    for (const name of Object.keys(files).filter(n => n.endsWith('.xml') || n.endsWith('.rels'))) {
      expect(
        new DOMParser().parseFromString(strFromU8(files[name]), 'application/xml').getElementsByTagName('parsererror')
      ).toHaveLength(0)
    }

    const doc = strFromU8(files['word/document.xml'])

    for (const text of [
      'My &lt;deck&gt;',
      'Launch',
      'bold',
      'start &amp; more',
      'Plan',
      'nested',
      'said',
      'code &lt;x&gt;'
    ]) {
      expect(doc).toContain(text)
    }

    expect(doc.match(/w:type="page"/g)).toHaveLength(1)
    expect(doc).toContain('<w:pStyle w:val="Heading1"/>')
    expect(doc).toContain('r:embed="rImg1"')
    expect([...files['word/media/image1.png']]).toEqual([...png])
    expect(strFromU8(files['word/_rels/document.xml.rels'])).toContain('media/image1.png')
  })

  it('leaves out a picture it cannot load rather than failing the export', async () => {
    const files = unzipSync(await buildDocx(deck, 'x', async () => null))

    expect(Object.keys(files).some(name => name.startsWith('word/media/'))).toBe(false)
    expect(strFromU8(files['word/document.xml'])).toContain('[pic]')
  })
})
