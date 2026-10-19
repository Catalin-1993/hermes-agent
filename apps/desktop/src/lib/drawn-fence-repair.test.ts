import { describe, expect, it } from 'vitest'

import { parseLooseJson, repairDrawnFences } from './drawn-fence-repair'
import { preprocessMarkdown } from './markdown-preprocess'

const EVENT = '{"type": "event", "title": "Film", "start": "2026-10-24T20:00:00+02:00"}'

describe('repairDrawnFences', () => {
  // The bug: "…în calendarul tău:```card" drew the event card as text with its JSON spilled into it.
  it('moves an opener glued to a sentence onto its own line', () => {
    const out = preprocessMarkdown(`Îl adaug direct în calendarul tău:\`\`\`card\n${EVENT}\n\`\`\`\n\nGata.`)

    expect(out).toContain(`calendarul tău:\n\n\`\`\`card\n${EVENT}\n\`\`\``)
  })

  it('opens a whole block written on one line', () => {
    expect(repairDrawnFences(`Iată: \`\`\`card ${EVENT} \`\`\``)).toBe(`Iată: \n\n\`\`\`card\n${EVENT}\n\`\`\`\n\n`)
  })

  it('leaves ordinary code and prose alone', () => {
    const text = 'Rulează `npm test`.\n\n```ts\nconst a = 1\n```\n'

    expect(repairDrawnFences(text)).toBe(text)
  })
})

describe('parseLooseJson', () => {
  // A YouTube link wrapped onto its own line broke the video card.
  it('reads a value broken across lines and a trailing comma', () => {
    expect(
      parseLooseJson('{"type": "video", "url": "\nhttps://www.youtube.com/watch?v=abc123DEF45\n", "title": "x",}')
    ).toEqual({ title: 'x', type: 'video', url: ' https://www.youtube.com/watch?v=abc123DEF45 ' })
  })

  it('still refuses what is not JSON', () => {
    expect(() => parseLooseJson('not json')).toThrow()
  })
})
