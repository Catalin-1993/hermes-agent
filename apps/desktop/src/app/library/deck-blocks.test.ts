import { describe, expect, it } from 'vitest'

import {
  blockStyleOf,
  insertBlock,
  moveBlock,
  parseBlocks,
  removeBlock,
  setBlockAlign,
  setBlockStyle
} from './deck-blocks'

const SLIDE = '## Title\n\n- one\n- two\n\n> said'

describe('blocks on a slide', () => {
  it('inserts a new block after another and says where it begins', () => {
    const { line, slide } = insertBlock(SLIDE, 0, 'bullets')
    const blocks = parseBlocks(slide)

    expect(blocks.map(block => block.kind)).toEqual(['heading', 'list', 'list', 'quote'])
    expect(slide.split('\n')[line]).toBe('- ')
  })

  it('starts a slide with a block, and holds an empty paragraph open', () => {
    const { line, slide } = insertBlock(SLIDE, -1, 'paragraph')

    expect(line).toBe(0)
    expect(parseBlocks(slide)[0]).toMatchObject({ kind: 'paragraph' })
  })

  it('reads a heading that has no words yet', () => {
    expect(parseBlocks(insertBlock('', -1, 'heading').slide)).toMatchObject([{ kind: 'heading', level: 2, text: '' }])
  })

  it('replaces a block in place', () => {
    const { slide } = insertBlock(SLIDE, 2, 'code', undefined, true)

    expect(parseBlocks(slide).map(block => block.kind)).toEqual(['heading', 'list', 'code'])
  })

  it('inserts an image by its link', () => {
    const { slide } = insertBlock(SLIDE, 1, 'image', { alt: 'a [b]', src: 'library://abc' })

    expect(parseBlocks(slide)[2]).toMatchObject({ alt: 'a b', kind: 'image', src: 'library://abc' })
  })

  it('moves a block up or down and leaves the ends alone', () => {
    expect(parseBlocks(moveBlock(SLIDE, 2, -1)).map(block => block.kind)).toEqual(['heading', 'quote', 'list'])
    expect(parseBlocks(moveBlock(SLIDE, 0, 1)).map(block => block.kind)).toEqual(['list', 'heading', 'quote'])
    expect(moveBlock(SLIDE, 0, -1)).toBe(SLIDE)
    expect(moveBlock(SLIDE, 2, 1)).toBe(SLIDE)
  })

  it('removes a block and keeps code fences whole', () => {
    expect(parseBlocks(removeBlock(SLIDE, 1)).map(block => block.kind)).toEqual(['heading', 'quote'])

    const fenced = '```\na\n\nb\n```\n\ntext'

    expect(removeBlock(fenced, 1)).toBe('```\na\n\nb\n```')
  })
})

describe('block look: alignment and paragraph style', () => {
  it('reads an alignment comment as the next block’s own and keeps it with the block', () => {
    const slide = '## Title\n\n<!-- align=center -->\nHello\nthere\n\n- one'
    const blocks = parseBlocks(slide)

    expect(blocks.map(block => block.kind)).toEqual(['heading', 'paragraph', 'list'])
    expect(blocks[1]).toMatchObject({ align: 'center', attr: 2, text: 'Hello there' })
    expect(blocks[0].align).toBeUndefined()
    expect(moveBlock(slide, 1, -1)).toBe('<!-- align=center -->\nHello\nthere\n\n## Title\n\n- one')
    expect(removeBlock(slide, 1)).toBe('## Title\n\n- one')
  })

  it('sets, changes and clears the alignment', () => {
    const slide = '## Title\n\nBody'
    const right = setBlockAlign(slide, 1, 'right')

    expect(right).toBe('## Title\n\n<!-- align=right -->\nBody')
    expect(setBlockAlign(right, 1, 'center')).toBe('## Title\n\n<!-- align=center -->\nBody')
    expect(setBlockAlign(right, 1, 'left')).toBe(slide)
  })

  it('turns a block into another paragraph style with its words', () => {
    expect(setBlockStyle('Plain **words**', 0, 'h2')).toBe('## Plain **words**')
    expect(setBlockStyle('## Head', 0, 'quote')).toBe('> Head')
    expect(setBlockStyle('Body', 0, 'bullets')).toBe('- Body')
    expect(setBlockStyle('- a\n- b', 0, 'numbered')).toBe('1. a\n2. b')
    expect(setBlockStyle('- a\n- b', 0, 'paragraph')).toBe('a\n\nb')
    expect(setBlockStyle('<!-- align=center -->\nBody', 0, 'h1')).toBe('<!-- align=center -->\n# Body')
    expect(setBlockStyle('```\ncode\n```', 0, 'h1')).toBe('```\ncode\n```')
    expect(blockStyleOf(parseBlocks('1. x')[0])).toBe('numbered')
  })
})
