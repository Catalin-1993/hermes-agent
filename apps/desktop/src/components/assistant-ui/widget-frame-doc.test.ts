import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  collectThemeBridge,
  evaluateIntent,
  FIGURE_MAX_WIDTH,
  figureArea,
  frameSizeFromMessage,
  INTENT_THROTTLE_MS,
  intentAckMessage,
  intentScript,
  isCompleteWidget,
  MAX_INTENT_LENGTH,
  partialHtml,
  partialMessage,
  partialShell,
  placeFigure,
  themePrelude,
  widgetKey,
  withInlineChrome
} from './widget-frame-doc'

describe('withInlineChrome', () => {
  const prelude = themePrelude({ '--foreground': '#eee' }, 'Inter', 'dark')

  it('puts the theme prelude FIRST so page styles override it', () => {
    const doc = '<html><head><style>body{color:red}</style></head><body><h1>hi</h1></body></html>'
    const framed = withInlineChrome(doc, 'tok', prelude)

    expect(framed.startsWith(prelude)).toBe(true)
    expect(framed.indexOf(prelude)).toBeLessThan(framed.indexOf('color:red'))
  })

  it('injects the measuring script before </body>', () => {
    const doc = '<html><body><h1>hi</h1></body></html>'
    const framed = withInlineChrome(doc, 'tok', prelude)

    expect(framed.indexOf('postMessage')).toBeGreaterThan(framed.indexOf('<h1>'))
    expect(framed.indexOf('postMessage')).toBeLessThan(framed.indexOf('</body>'))
    expect(framed).toContain('"tok"')
  })

  it('appends the script when there is no body close tag', () => {
    const framed = withInlineChrome('<h1>fragment</h1>', 'tok', prelude)

    expect(framed).toContain('<h1>fragment</h1>')
    expect(framed).toContain('postMessage')
  })
})

describe('themePrelude', () => {
  it.each(['light', 'dark'] as const)('injects the app color scheme %s into the frame document', colorScheme => {
    expect(themePrelude({}, '', colorScheme)).toContain(`color-scheme:${colorScheme}`)
  })

  it('puts the injected color scheme where a page declaration overrides it', () => {
    const doc = '<html><head><style>:root{color-scheme:dark}</style></head><body><h1>hi</h1></body></html>'
    const framed = withInlineChrome(doc, 'tok', themePrelude({}, '', 'light'))

    // The injected default comes first; the page's own :root rule wins.
    expect(framed.indexOf('color-scheme:light')).toBeLessThan(framed.indexOf('color-scheme:dark'))
  })

  it('carries resolved tokens, transparent background, and the app font', () => {
    const prelude = themePrelude(
      { '--foreground': 'oklch(0.9 0 0)', '--accent': '#7aa2f7' },
      'Inter, sans-serif',
      'dark'
    )

    expect(prelude).toContain('--foreground:oklch(0.9 0 0)')
    expect(prelude).toContain('--accent:#7aa2f7')
    expect(prelude).toContain('background:transparent')
    expect(prelude).toContain('font-family:Inter, sans-serif')
  })

  it('omits the font rule when no font resolved', () => {
    expect(themePrelude({}, '', 'light')).not.toContain('font-family')
  })
})

describe('collectThemeBridge', () => {
  afterEach(() => {
    document.documentElement.className = ''
    delete document.documentElement.dataset.hermesMode
  })

  // #123048: the frame's color-scheme must come from the same resolved
  // appearance as the injected tokens, not from the separate `.dark` class
  // React's useIsDark() reads — that class can still hold last render's
  // value for a paint after applyTheme() has already updated data-hermes-mode.
  it('reads color-scheme from data-hermes-mode, not the .dark class', () => {
    document.documentElement.dataset.hermesMode = 'dark'
    document.documentElement.classList.remove('dark')

    expect(collectThemeBridge().colorScheme).toBe('dark')
  })

  it('falls back to light when the mode attribute disagrees the other way', () => {
    document.documentElement.dataset.hermesMode = 'light'
    document.documentElement.classList.add('dark')

    expect(collectThemeBridge().colorScheme).toBe('light')
  })
})

describe('frameSizeFromMessage', () => {
  const msg = (over: Record<string, unknown> = {}) => ({
    type: 'hermes-inline-preview-size',
    token: 'tok',
    height: 500,
    width: 300,
    viewport: 640,
    ...over
  })

  it('accepts our message with our token, height clamped', () => {
    expect(frameSizeFromMessage(msg(), 'tok')).toEqual({ height: 500, viewport: 640, width: 300 })
    expect(frameSizeFromMessage(msg({ height: 12 }), 'tok')?.height).toBe(120)
    expect(frameSizeFromMessage(msg({ height: 5000 }), 'tok')?.height).toBe(1200)
    expect(frameSizeFromMessage(msg({ height: 500.7 }), 'tok')?.height).toBe(501)
  })

  it('sanitizes width to 0 when missing or hostile', () => {
    expect(frameSizeFromMessage(msg({ width: undefined }), 'tok')?.width).toBe(0)
    expect(frameSizeFromMessage(msg({ width: 'wide' }), 'tok')?.width).toBe(0)
    expect(frameSizeFromMessage(msg({ width: Infinity }), 'tok')?.width).toBe(0)
    expect(frameSizeFromMessage(msg({ width: -10 }), 'tok')?.width).toBe(0)
  })

  it('reports the frame width the content was measured in, 0 when it is hostile', () => {
    expect(frameSizeFromMessage(msg(), 'tok')?.viewport).toBe(640)
    expect(frameSizeFromMessage(msg({ viewport: 'wide' }), 'tok')?.viewport).toBe(0)
    expect(frameSizeFromMessage(msg({ viewport: undefined }), 'tok')?.viewport).toBe(0)
  })

  it('rejects wrong type, wrong token, and hostile shapes', () => {
    expect(frameSizeFromMessage(msg({ type: 'other' }), 'tok')).toBeNull()
    expect(frameSizeFromMessage(msg({ token: 'stolen' }), 'tok')).toBeNull()
    expect(frameSizeFromMessage(msg({ height: 'tall' }), 'tok')).toBeNull()
    expect(frameSizeFromMessage(msg({ height: Infinity }), 'tok')).toBeNull()
    expect(frameSizeFromMessage(msg({ height: -5 }), 'tok')).toBeNull()
    expect(frameSizeFromMessage(null, 'tok')).toBeNull()
    expect(frameSizeFromMessage('str', 'tok')).toBeNull()
  })
})

describe('evaluateIntent', () => {
  const msg = (over: Record<string, unknown> = {}) => ({
    type: 'hermes-inline-preview-intent',
    token: 'tok',
    id: 7,
    prompt: 'get-price eth',
    ...over
  })

  const NOW = 100_000

  it('accepts our intent with our token, trimmed, carrying the call id', () => {
    expect(evaluateIntent(msg(), 'tok', NOW, 0)).toEqual({ id: 7, kind: 'accept', prompt: 'get-price eth' })
    expect(evaluateIntent(msg({ prompt: '  hi  ' }), 'tok', NOW, 0)).toMatchObject({ kind: 'accept', prompt: 'hi' })
  })

  it('accepts a prompt exactly at the cap untouched', () => {
    const prompt = 'x'.repeat(MAX_INTENT_LENGTH)

    expect(evaluateIntent(msg({ prompt }), 'tok', NOW, 0)).toMatchObject({ kind: 'accept', prompt })
  })

  // #118973: a sliced JSON payload reached the agent as garbage while the
  // widget believed it sent. Over-length is an explicit rejection now.
  it('rejects an over-length prompt instead of truncating it', () => {
    const payload = 'FC-FLUSH ' + JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ card: i, rating: 3 })))

    expect(payload.length).toBeGreaterThan(MAX_INTENT_LENGTH)
    expect(evaluateIntent(msg({ prompt: payload }), 'tok', NOW, 0)).toEqual({
      ack: { error: 'too_long', maxLength: MAX_INTENT_LENGTH, ok: false },
      id: 7,
      kind: 'reject'
    })
  })

  it('rejects a throttled intent with a retry hint instead of dropping it', () => {
    expect(evaluateIntent(msg(), 'tok', NOW, NOW - 300)).toEqual({
      ack: { error: 'throttled', ok: false, retryAfterMs: INTENT_THROTTLE_MS - 300 },
      id: 7,
      kind: 'reject'
    })
    expect(evaluateIntent(msg(), 'tok', NOW, NOW - INTENT_THROTTLE_MS)).toMatchObject({ kind: 'accept' })
  })

  it('rejects an empty or non-string prompt from our frame as invalid', () => {
    expect(evaluateIntent(msg({ prompt: '   ' }), 'tok', NOW, 0)).toMatchObject({ ack: { error: 'invalid' } })
    expect(evaluateIntent(msg({ prompt: 42 }), 'tok', NOW, 0)).toMatchObject({ ack: { error: 'invalid' } })
  })

  it('drops a non-integer id so the ack cannot be aimed with a hostile value', () => {
    expect(evaluateIntent(msg({ id: 'x' }), 'tok', NOW, 0)).toMatchObject({ id: null, kind: 'accept' })
    expect(evaluateIntent(msg({ id: 1.5 }), 'tok', NOW, 0)).toMatchObject({ id: null })
  })

  it('ignores wrong token, wrong type, and hostile shapes without a reply', () => {
    expect(evaluateIntent(msg({ token: 'stolen' }), 'tok', NOW, 0)).toBeNull()
    expect(evaluateIntent(msg({ type: 'hermes-inline-preview-size' }), 'tok', NOW, 0)).toBeNull()
    expect(evaluateIntent(null, 'tok', NOW, 0)).toBeNull()
    expect(evaluateIntent('str', 'tok', NOW, 0)).toBeNull()
  })
})

describe('intentScript', () => {
  // Run the injected script against a fake parent so the frame side of the
  // protocol is exercised for real: what it posts and what send() resolves.
  function mountFrame() {
    const posted: Array<Record<string, unknown>> = []
    const listeners: Record<string, Array<(e: unknown) => void>> = {}
    const parent = { postMessage: (data: Record<string, unknown>) => posted.push(data) }
    const win: { hermes?: { maxLength: number; send: (p: unknown) => Promise<unknown> } } = {}

    const addEventListener = (type: string, fn: (e: unknown) => void) => {
      ;(listeners[type] ??= []).push(fn)
    }

    const body = intentScript('tok')
      .replace(/^<script>/, '')
      .replace(/<\/script>$/, '')

    new Function('parent', 'addEventListener', 'window', body)(parent, addEventListener, win)

    const reply = (data: unknown, source: unknown = parent) => listeners.message?.forEach(fn => fn({ data, source }))

    return { posted, reply, send: win.hermes!.send, win }
  }

  it('posts the full prompt, never a truncated one', () => {
    const { posted, send } = mountFrame()
    const long = 'y'.repeat(3200)

    void send(long)

    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ prompt: long, token: 'tok', type: 'hermes-inline-preview-intent' })
  })

  it('resolves send() with the parent ack for that call', async () => {
    const { posted, reply, send } = mountFrame()
    const pending = send('hello')
    const id = posted[0].id as number

    reply(intentAckMessage('tok', id, { error: 'too_long', maxLength: 500, ok: false }))

    await expect(pending).resolves.toEqual({ error: 'too_long', maxLength: 500, ok: false })
  })

  it('ignores acks with the wrong token or from a non-parent source', async () => {
    vi.useFakeTimers()

    try {
      const { posted, reply, send } = mountFrame()
      const pending = send('hello')
      const id = posted[0].id as number

      reply(intentAckMessage('stolen', id, { ok: true }))
      reply(intentAckMessage('tok', id, { ok: true }), {})
      vi.advanceTimersByTime(5000)

      await expect(pending).resolves.toEqual({ error: 'undelivered', ok: false })
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves invalid for an empty prompt without posting, and exposes the cap', async () => {
    const { posted, send, win } = mountFrame()

    await expect(send('   ')).resolves.toEqual({ error: 'invalid', ok: false })
    expect(posted).toHaveLength(0)
    expect(win.hermes?.maxLength).toBe(MAX_INTENT_LENGTH)
  })
})

describe('a widget that is still being written', () => {
  it('shows its markup and styles, never a script — finished or not', () => {
    expect(partialHtml('<h3>Sales</h3><style>h3{color:red}</style><script>alert(1)</script><p>x</p>')).toBe(
      '<h3>Sales</h3><style>h3{color:red}</style><p>x</p>'
    )
    expect(partialHtml('<p>a</p><script>let x = 1; if (a <')).toBe('<p>a</p>')
    expect(partialHtml('<p>a</p><SCRIPT src="https://cdn.jsdelivr.net/x.js"></SCRIPT>')).toBe('<p>a</p>')
  })

  it('cuts a tag that has only half arrived, and keeps text that merely contains a "<"', () => {
    expect(partialHtml('<p>a</p><div class="ca')).toBe('<p>a</p>')
    expect(partialHtml('<p>a</p><di')).toBe('<p>a</p>')
    expect(partialHtml('<p>1 < 2</p>')).toBe('<p>1 < 2</p>')
    expect(partialHtml('')).toBe('')
  })

  it('knows a finished document from one cut off mid-way', () => {
    expect(isCompleteWidget('<div>hi</div><script>draw()</script>')).toBe(true)
    expect(isCompleteWidget('<!doctype html><html><body><p>x</p></body></html>')).toBe(true)
    expect(isCompleteWidget('<div>hi</div><script>draw(')).toBe(false)
    expect(isCompleteWidget('<style>p{}')).toBe(false)
    expect(isCompleteWidget('<html><body><p>x</p>')).toBe(false)
    expect(isCompleteWidget('<div>hi</di')).toBe(false)
    expect(isCompleteWidget('  ')).toBe(false)
  })

  it('pours markup into a shell that only believes its own parent and token', () => {
    const shell = partialShell('tok', themePrelude({}, '', 'light'))

    expect(shell).toContain('e.source===parent')
    expect(shell).toContain('d.token===t')
    expect(shell).toContain('"tok"')
    expect(shell).toContain('hermes-inline-preview-size')
    expect(partialMessage('tok', '<p>x</p>')).toEqual({ html: '<p>x</p>', token: 'tok', type: 'hermes-widget-partial' })
  })

  it('files a widget under a name that follows its text', () => {
    expect(widgetKey('<p>a</p>')).toBe(widgetKey('<p>a</p>'))
    expect(widgetKey('<p>a</p>')).not.toBe(widgetKey('<p>b</p>'))
    expect(widgetKey('<p>a</p>')).toMatch(/^widget:/)
  })
})

describe('where a widget sits', () => {
  it('widens the figure area only as far as the pane has room, and never below the column', () => {
    expect(figureArea(688, 2000)).toBe(FIGURE_MAX_WIDTH)
    expect(figureArea(688, 800)).toBeGreaterThanOrEqual(688)
    expect(figureArea(688, 800)).toBeLessThanOrEqual(800)
    expect(figureArea(300, 320)).toBe(300)
  })

  it('lines a widget that fits the column up with the text', () => {
    const { offset, width } = placeFigure({ area: 896, column: 688, content: 440 })

    expect(width).toBe(440)
    expect(offset).toBe((896 - 688) / 2)
  })

  it('centres a widget wider than the column on it, and lets a fluid one fill the area', () => {
    expect(placeFigure({ area: 896, column: 688, content: 760 })).toEqual({ offset: 68, width: 760 })
    expect(placeFigure({ area: 896, column: 688, content: null })).toEqual({ offset: 0, width: 896 })
    expect(placeFigure({ area: 896, column: 688, content: 5000 }).width).toBe(896)
  })
})
