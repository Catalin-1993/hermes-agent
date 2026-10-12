import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Slide } from './deck-slide'

describe('Slide', () => {
  it('draws a slide as plain, self-contained markup an export can print', () => {
    const html = renderToStaticMarkup(
      <Slide slide={'## Goals\n\n- Grow **30%**\n  - Mobile first\n1. One\n2. Two\n\n![chart](library://img_1)'} theme="ink" />
    )

    expect(html).toContain('Goals')
    expect(html).toMatch(/font-weight:700">30%<\/span>/)
    expect(html).toContain('Mobile first')
    expect(html).toContain('>1.<')
    expect(html).toContain('>2.<')
    expect(html).toContain('container-type:inline-size')
    expect(html).not.toContain('class=')
  })

  it('puts a Library image in the page when the export has already read it', () => {
    const html = renderToStaticMarkup(
      <Slide images={{ img_1: 'data:image/png;base64,AAAA' }} slide="![chart](library://img_1)" theme="paper" />
    )

    expect(html).toContain('src="data:image/png;base64,AAAA"')
  })

  it('sets a lone heading and its subtitle as a title slide', () => {
    const title = renderToStaticMarkup(<Slide slide={'# Launch\n\nQ4'} theme="paper" />)
    const content = renderToStaticMarkup(<Slide slide={'## Launch\n\n- Q4'} theme="paper" />)

    expect(title).toContain('font-size:8.4cqw')
    expect(content).not.toContain('font-size:8.4cqw')
  })
})
