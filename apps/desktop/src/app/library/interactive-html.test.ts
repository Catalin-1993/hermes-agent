import { describe, expect, it } from 'vitest'

import {
  clampHeight,
  htmlFileName,
  htmlTitle,
  INTERACTIVE_MAX_HEIGHT,
  INTERACTIVE_MIN_HEIGHT,
  interactiveSrc,
  parseState,
  reportedHeight,
  reportedState,
  STATE_MAX_CHARS
} from './interactive-html'

// What a block puts in its frame, and what it will believe from it.

const documentOf = (src: string) => decodeURIComponent(src.replace(/^data:text\/html;charset=utf-8,/, ''))

describe('interactiveSrc', () => {
  it('seals the document before any script of its own can run, and wires the height report', () => {
    const doc = documentOf(
      interactiveSrc('<html><head><title>ROI</title></head><body><script>x()</script></body></html>')
    )

    expect(doc.indexOf('Content-Security-Policy')).toBeGreaterThan(-1)
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('hermes-interactive-height'))
    expect(doc.indexOf('hermes-interactive-height')).toBeLessThan(doc.indexOf('x()'))
  })

  it('does the same for a fragment with no head', () => {
    const doc = documentOf(interactiveSrc('<button>Go</button>'))

    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('hermes-interactive-height'))
    expect(doc.endsWith('<button>Go</button>')).toBe(true)
  })
})

describe('reportedHeight', () => {
  it('takes only our message, and keeps it inside the bounds', () => {
    expect(reportedHeight({ height: 480, type: 'hermes-interactive-height' })).toBe(480)
    expect(reportedHeight({ height: 1, type: 'hermes-interactive-height' })).toBe(INTERACTIVE_MIN_HEIGHT)
    expect(reportedHeight({ height: 1e9, type: 'hermes-interactive-height' })).toBe(INTERACTIVE_MAX_HEIGHT)
    expect(reportedHeight({ height: 480, type: 'something-else' })).toBeNull()
    expect(reportedHeight({ height: '480', type: 'hermes-interactive-height' })).toBeNull()
    expect(reportedHeight({ height: Number.NaN, type: 'hermes-interactive-height' })).toBeNull()
    expect(reportedHeight(null)).toBeNull()
  })

  it('clamps whatever a drag produces', () => {
    expect(clampHeight(-50)).toBe(INTERACTIVE_MIN_HEIGHT)
    expect(clampHeight(333.4)).toBe(333)
  })
})

describe('naming', () => {
  it('names the file after the document, never a path', () => {
    expect(htmlTitle('<title> ROI &amp; payback\n calculator </title>')).toBe('ROI & payback calculator')
    expect(htmlFileName('<title>a/b\\c: d?</title>', 'Interactive block')).toBe('a b c d.html')
    expect(htmlFileName('<p>no title</p>', 'Interactive block')).toBe('Interactive block.html')
  })
})

describe('what a block can keep and see', () => {
  const doc = (state: unknown) =>
    documentOf(
      interactiveSrc('<p>x</p>', {
        palette: { accent: '#00f', bg: '#111', border: '#333', fg: '#eee', muted: '#999', scheme: 'dark' },
        state
      })
    )

  it('hands the frame its saved data and the theme before its own scripts run', () => {
    const out = doc({ rate: 6 })

    expect(out).toContain('"rate":6')
    expect(out).toContain('"scheme":"dark"')
    expect(out.indexOf('window.hermes=')).toBeLessThan(out.indexOf('<p>x</p>'))
  })

  it('cannot be broken out of by what it saved', () => {
    const out = doc({ note: '</script><script>alert(1)</script>\u2028' })

    expect(out).not.toContain('</script><script>alert')
    expect(out).toContain('\\u003c/script>')
  })

  it('keeps only data that is JSON, ours and small enough', () => {
    const message = (state: unknown, type = 'hermes-interactive-state') => ({ state, type })

    expect(reportedState(message('{"a":1}'))).toBe('{"a":1}')
    expect(reportedState(message('not json'))).toBeNull()
    expect(reportedState(message({ a: 1 }))).toBeNull()
    expect(reportedState(message('{"a":1}', 'other'))).toBeNull()
    expect(reportedState(message(`"${'x'.repeat(STATE_MAX_CHARS)}"`))).toBeNull()
    expect(reportedState(null)).toBeNull()
  })

  it('reads saved data back, and a damaged copy as nothing', () => {
    expect(parseState('{"a":[1,2]}')).toEqual({ a: [1, 2] })
    expect(parseState('')).toBeNull()
    expect(parseState('{oops')).toBeNull()
  })
})

describe('what a block frame may load', () => {
  it('lets a block pull code from the public CDNs, and nothing else off the device', () => {
    const doc = documentOf(interactiveSrc('<p>x</p>'))

    expect(doc).toContain("script-src 'unsafe-inline' https://cdnjs.cloudflare.com")
    expect(doc).not.toContain('connect-src')
    expect(doc).not.toMatch(/img-src[^;]*https:/)
  })

  it('opens the connection to exactly the approved hosts', () => {
    expect(documentOf(interactiveSrc('<p>x</p>', { hosts: ['api.frankfurter.dev'] }))).toContain(
      'connect-src https://api.frankfurter.dev wss://api.frankfurter.dev'
    )
  })
})
