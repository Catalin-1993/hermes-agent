import { describe, expect, it } from 'vitest'

import { promoteJsonDirectives } from './json-directive'

describe('promoteJsonDirectives', () => {
  it('turns a card or chart written as a directive line into the fence the chat draws', () => {
    const video = '::card{"type":"video","url":"https://www.youtube.com/watch?v=pfxyk1glEq4","title":"Song"}'

    expect(promoteJsonDirectives(`Here it is:\n\n${video}\n\nEnjoy.`)).toBe(
      'Here it is:\n\n```card\n{"type":"video","url":"https://www.youtube.com/watch?v=pfxyk1glEq4","title":"Song"}\n```\n\nEnjoy.'
    )
    expect(promoteJsonDirectives('::chart {"type":"donut","slices":[{"name":"A","value":1}]}')).toContain('```chart\n')
  })

  it('leaves text, broken JSON, other directives and code fences as written', () => {
    const untouched = [
      'Talk about ::card in a sentence.',
      '::card{"type": "video", "url": }',
      '::preview{file="/tmp/page.html"}',
      '```md\n::card{"type":"link","url":"https://example.com"}\n```'
    ]

    for (const text of untouched) {
      expect(promoteJsonDirectives(text)).toBe(text)
    }
  })
})
