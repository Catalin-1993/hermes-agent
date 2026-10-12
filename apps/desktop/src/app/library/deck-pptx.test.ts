import { readFileSync, writeFileSync } from 'node:fs'

import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { parseDeck } from './deck'
import { buildPptx, type PptxImage } from './deck-pptx'

const REAL = process.env.HERMES_PPTX_IMG ? readFileSync(process.env.HERMES_PPTX_IMG) : null

const PNG: PptxImage = {
  bytes: REAL ? new Uint8Array(REAL) : Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]),
  ext: 'png',
  h: 300,
  w: 400
}

const deck = parseDeck(
  `<!-- hermes:deck theme=ink -->\n\n${[
    '# Lansare **Brain**\n\nPlan pentru Q4 — pe scurt',
    '## Obiective & ținte\n\n- Creștem cu **30%**\n  - Android *mai întâi*\n- Reducem `costul`\n\n1. Unu\n2. Doi\n\n> O citare scurtă',
    '## Imagine\n\n- Un punct\n\n![grafic](library://img_1)'
  ].join('\n\n---\n\n')}`
)

describe('buildPptx', () => {
  it('writes every part of a PowerPoint package, well-formed, with the slides’ words and picture', async () => {
    const bytes = await buildPptx(deck, 'Lansare & plan', async src => (src === 'library://img_1' ? PNG : null))
    const files = unzipSync(bytes)
    const parts = Object.keys(files)

    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'ppt/presentation.xml',
      'ppt/_rels/presentation.xml.rels',
      'ppt/slideMasters/slideMaster1.xml',
      'ppt/slideLayouts/slideLayout1.xml',
      'ppt/theme/theme1.xml',
      'ppt/slides/slide1.xml',
      'ppt/slides/slide3.xml',
      'ppt/media/image1.png'
    ]) {
      expect(parts, part).toContain(part)
    }

    for (const part of parts.filter(name => /\.(xml|rels)$/.test(name))) {
      const doc = new DOMParser().parseFromString(strFromU8(files[part]), 'application/xml')

      expect(doc.getElementsByTagName('parsererror'), part).toHaveLength(0)
    }

    const first = strFromU8(files['ppt/slides/slide1.xml'])
    const second = strFromU8(files['ppt/slides/slide2.xml'])

    expect(first).toContain('Lansare')
    expect(first).toContain('b="1"')
    expect(first).toContain('<a:srgbClr val="101114"/>')
    expect(second).toContain('Obiective &amp; ținte')
    expect(second).toContain('<a:buAutoNum type="arabicPeriod"/>')
    expect(second).toContain('i="1"')
    expect(second).toContain('Courier New')
    expect(strFromU8(files['ppt/slides/_rels/slide3.xml.rels'])).toContain('../media/image1.png')
    expect(strFromU8(files['ppt/slides/slide3.xml'])).toContain('r:embed="rId2"')
    expect(strFromU8(files['[Content_Types].xml'])).toContain('Extension="png"')
    expect(strFromU8(files['ppt/presentation.xml']).match(/<p:sldId /g)).toHaveLength(3)

    if (process.env.HERMES_PPTX_OUT) {
      writeFileSync(process.env.HERMES_PPTX_OUT, bytes)
    }
  })

  it('leaves out a picture it cannot load instead of failing', async () => {
    const files = unzipSync(await buildPptx(deck, 'Deck', async () => null))

    expect(Object.keys(files).some(name => name.startsWith('ppt/media/'))).toBe(false)
    expect(strFromU8(files['ppt/slides/slide3.xml'])).not.toContain('<p:pic>')
  })
})
