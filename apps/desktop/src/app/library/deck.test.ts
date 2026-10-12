import { describe, expect, it } from 'vitest'

import {
  changedSlides,
  insertSlide,
  isDeck,
  moveSlide,
  parseDeck,
  removeSlide,
  replaceLines,
  serializeDeck,
  slideLayout
} from './deck'

const text =
  '<!-- hermes:deck theme=ink -->\n\n# Launch\n\nQ4\n\n---\n\n## Goals\n\n- One\n- Two\n\n---\n\n## Code\n\n```md\n---\nnot a slide\n```\n'

describe('deck format', () => {
  it('knows a deck by its marker and reads its theme and slides, keeping fenced rules inside a slide', () => {
    const deck = parseDeck(text)

    expect(isDeck(text)).toBe(true)
    expect(isDeck('# Just a page')).toBe(false)
    expect(deck.theme).toBe('ink')
    expect(deck.slides).toHaveLength(3)
    expect(deck.slides[2]).toContain('not a slide')
  })

  it('writes back what it read', () => {
    expect(parseDeck(serializeDeck(parseDeck(text)))).toEqual(parseDeck(text))
  })

  it('falls back to the paper theme for one it does not know, and never loses the last slide', () => {
    expect(parseDeck('<!-- hermes:deck theme=neon -->\n\nHi').theme).toBe('paper')
    expect(removeSlide({ slides: ['only'], theme: 'paper' }, 0).slides).toEqual([''])
  })

  it('adds and moves slides', () => {
    const deck = { slides: ['a', 'b', 'c'], theme: 'paper' as const }

    expect(insertSlide(deck, 1, 'x').slides).toEqual(['a', 'x', 'b', 'c'])
    expect(moveSlide(deck, 0, 2).slides).toEqual(['b', 'c', 'a'])
  })

  it('calls a lone heading with a line beneath a title slide, anything with a list a content slide', () => {
    expect(slideLayout('# Launch\n\nQ4')).toBe('title')
    expect(slideLayout('## Goals\n\n- One')).toBe('content')
    expect(slideLayout('# Plan\n\n- One')).toBe('content')
  })

  it('swaps, adds and drops lines of a slide', () => {
    const slide = '## Goals\n\n- One\n- Two'

    expect(replaceLines(slide, 0, 0, ['## Aims'])).toBe('## Aims\n\n- One\n- Two')
    expect(replaceLines(slide, 2, 2, ['- One', '- 1.5'])).toBe('## Goals\n\n- One\n- 1.5\n- Two')
    expect(replaceLines(slide, 3, 3, [])).toBe('## Goals\n\n- One')
  })
})

describe('changedSlides', () => {
  it('names the slides that differ, including added ones', () => {
    const before = serializeDeck({ slides: ['a', 'b', 'c'], theme: 'paper' })
    const after = serializeDeck({ slides: ['a', 'B', 'c', 'd'], theme: 'paper' })

    expect(changedSlides(before, after)).toEqual([1, 3])
    expect(changedSlides(before, before)).toEqual([])
  })
})
