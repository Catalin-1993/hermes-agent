// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { applyEdits, cleanInline, editableDocument, markEditable, readEdit } from './html-edit'

const PAGE = `<!doctype html><html><head><title>Q</title><style>.a{color:red}</style></head><body>
<h1 class="t">Quarterly <b>revenue</b></h1>
<p>Q1 starter plan signups</p>
<div><span>12</span><button>Reset</button></div>
<canvas id="c"></canvas><script>document.title = 'ran'</script>
</body></html>`

describe('editing an HTML file in place', () => {
  it('numbers the texts the file itself holds, and not scripts, styles, buttons or charts', () => {
    const marked = markEditable(PAGE)
    const doc = new DOMParser().parseFromString(marked, 'text/html')
    const texts = [...doc.querySelectorAll('[data-hermes-edit]')].map(el => el.textContent)

    expect(texts).toEqual(['Quarterly revenue', 'Q1 starter plan signups', '12'])
    expect(doc.querySelector('button')?.hasAttribute('data-hermes-edit')).toBe(false)
  })

  it('changes only the typed text and leaves the rest of the file as it was', () => {
    const next = applyEdits(PAGE, { '1': 'Q1 paid signups' })

    expect(next).toContain('<p>Q1 paid signups</p>')
    expect(next).toContain('<h1 class="t">Quarterly <b>revenue</b></h1>')
    expect(next).toContain('.a{color:red}')
    expect(next).toContain("document.title = 'ran'")
    expect(next.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(applyEdits(PAGE, {})).toBe(PAGE)
  })

  it('numbers the same texts whether the file is marked or edited', () => {
    const marked = new DOMParser().parseFromString(markEditable(PAGE), 'text/html')
    const index = [...marked.querySelectorAll('[data-hermes-edit]')].findIndex(el => el.textContent === '12')

    expect(applyEdits(PAGE, { [String(index)]: '15' })).toContain('<span>15</span>')
  })

  it('keeps inline formatting and drops scripts, handlers and editor leftovers from what was typed', () => {
    const typed =
      'Hello <b>there</b><div onclick="x()">block</div><script>bad()</script><i onmouseover="y()" contenteditable="true">it</i>'

    expect(cleanInline(typed)).toBe('Hello <b>there</b>block<i>it</i>')
  })

  it('brings the editing script into the frame, last', () => {
    const html = editableDocument(PAGE)

    expect(html.indexOf('hermesEdit')).toBeGreaterThan(html.indexOf('Reset'))
    expect(html.trimEnd().endsWith('</html>')).toBe(true)
  })

  it('reads only well-formed edit messages', () => {
    expect(readEdit({ hermesEdit: true, html: 'x', id: '2' })).toEqual({ html: 'x', id: '2' })
    expect(readEdit({ html: 'x', id: '2' })).toBeNull()
    expect(readEdit('hi')).toBeNull()
  })
})
