import { describe, expect, it } from 'vitest'

import { markBlockLinks } from './page-editor'

// How a page Hermes wrote finds its blocks again: only a library link alone on its line is one.

describe('markBlockLinks', () => {
  it('swaps a lone library link for a marker the parser keeps, remembering its title', () => {
    const { marked, titles } = markBlockLinks('Intro\n\n[Budget split](library://fl_1)\n\nOutro')

    expect(marked).toBe('Intro\n\nhermes-block:fl_1\n\nOutro')
    expect(titles.get('fl_1')).toBe('Budget split')
  })

  it('leaves links inside a sentence, and every other kind of link, alone', () => {
    const text = 'See [the plan](library://pg_2) first.\n\n[site](https://example.com)\n\n- [item](library://fl_3) x'

    expect(markBlockLinks(text)).toEqual({ marked: text, titles: new Map() })
  })
})
