import { describe, expect, it } from 'vitest'

import { isVisualHtmlFence } from './html-fence'

describe('isVisualHtmlFence', () => {
  it('draws a page or a dashboard the model wrote as ```html', () => {
    expect(isVisualHtmlFence('html', '<!doctype html><html><body><h1>Dashboard</h1></body></html>')).toBe(true)
    expect(isVisualHtmlFence('HTML', '<div class="kpi">1</div>\n<style>.kpi{font-size:28px}</style>')).toBe(true)
    expect(isVisualHtmlFence('htm', '<canvas id="c"></canvas><script>draw()</script>')).toBe(true)
  })

  it('keeps plain markup — code the user asked to read — as code', () => {
    expect(isVisualHtmlFence('html', '<form>\n  <input name="email">\n  <button>Send</button>\n</form>')).toBe(false)
    expect(isVisualHtmlFence('js', '<!doctype html><script>x()</script>')).toBe(false)
    expect(isVisualHtmlFence('html', '   ')).toBe(false)
  })
})
