import { describe, expect, it } from 'vitest'

import { mergeSpans, parseInline, plainText, serializeInline } from './deck-inline'

describe('a slide’s words and how they look', () => {
  it('reads Markdown marks and the two bits of HTML for what Markdown lacks', () => {
    const spans = parseInline(
      'plain **bold** *it* ~~gone~~ <u>under</u> `code` [site](https://x.dev) <span style="font-family:Georgia;font-size:32pt;color:#C2410C">big</span>'
    )

    expect(spans.map(span => span.text)).toEqual([
      'plain ',
      'bold',
      ' ',
      'it',
      ' ',
      'gone',
      ' ',
      'under',
      ' ',
      'code',
      ' ',
      'site',
      ' ',
      'big'
    ])
    expect(spans.find(span => span.text === 'bold')).toMatchObject({ bold: true })
    expect(spans.find(span => span.text === 'gone')).toMatchObject({ strike: true })
    expect(spans.find(span => span.text === 'under')).toMatchObject({ underline: true })
    expect(spans.find(span => span.text === 'code')).toMatchObject({ code: true })
    expect(spans.find(span => span.text === 'site')).toMatchObject({ link: 'https://x.dev' })
    expect(spans.find(span => span.text === 'big')).toMatchObject({ color: '#c2410c', font: 'Georgia', size: 32 })
  })

  it('nests looks: bold and italic together, a coloured bold word', () => {
    expect(parseInline('***both***')).toEqual([{ bold: true, italic: true, text: 'both' }])
    expect(parseInline('<span style="color:#112233">**red** and plain</span>')).toEqual([
      { bold: true, color: '#112233', text: 'red' },
      { color: '#112233', text: ' and plain' }
    ])
  })

  it('writes back what it read, and the writing reads the same', () => {
    for (const source of [
      'just words',
      'a **b** and *c*',
      '***all*** ~~x~~ <u>y</u>',
      '<span style="font-size:18pt">small</span> then [link](http://a.b)',
      '<span style="font-family:Courier New;color:#abcdef"><u>**mix**</u></span>'
    ]) {
      const once = parseInline(source)

      expect(parseInline(serializeInline(once))).toEqual(once)
    }
  })

  it('leaves words that merely look like marks alone', () => {
    expect(plainText(parseInline('snake_case_name 2*3 and a * b'))).toBe('snake_case_name 2*3 and a * b')
    expect(parseInline('5 > 3 <b>x</b>')[0].text).toBe('5 > 3 <b>x</b>')
  })

  it('merges neighbours that look alike and drops empty ones', () => {
    expect(mergeSpans([{ text: 'a' }, { text: '' }, { text: 'b' }, { bold: true, text: 'c' }])).toEqual([
      { text: 'ab' },
      { bold: true, text: 'c' }
    ])
  })
})
