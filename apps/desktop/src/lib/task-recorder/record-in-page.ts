/**
 * Brain: TASK RECORDER, page half — what runs inside the in-app browser's guest page while you show Hermes a task.
 *
 * It is injected as SOURCE through the pane's script runner (preview-script-runner.ts), so, like the act engine
 * (lib/preview-act/act-in-page.ts), it names nothing from module scope: the whole program is the string below.
 * Each injection is one call: install the listeners if this document has none yet, then hand back (and clear)
 * whatever was captured since the last call, as JSON. The host polls it; a navigation brings a fresh document, the
 * next call installs again, and what the old document had not handed over survives in sessionStorage when the new
 * page shares its origin.
 *
 * Captured, in page order: clicks (on the nearest control, not the icon inside it), what was typed into a field
 * (once, when it settles — on change, or just before Enter), choices in a select, Enter / Escape / Tab, and every
 * address the page moves to. Each step names its element twice: a CSS selector that matches only that element,
 * and the words a person sees on it, so a replay can fall back to the label when a site's markup shifts. Password
 * and card fields never leave the page: their value is recorded as a secret, to be asked for at replay.
 */

/** One captured step, as the page hands it over. */
export interface RecordedPageEvent {
  at: number
  href?: string
  key?: string
  kind: 'click' | 'key' | 'page' | 'select' | 'type'
  label?: string
  role?: string
  secret?: boolean
  selector?: string
  tag?: string
  url?: string
  value?: string
}

export const RECORD_IN_PAGE_SOURCE = String.raw`(() => {
  const KEY = '__brainTaskRec'
  const STORE = 'brain-task-recorder'
  const w = window
  let rec = w[KEY]

  if (!rec) {
    let saved = []
    try { saved = JSON.parse(sessionStorage.getItem(STORE) || '[]') } catch (e) { saved = [] }
    rec = w[KEY] = { buffer: Array.isArray(saved) ? saved : [], lastHref: '', values: new WeakMap() }

    const persist = () => { try { sessionStorage.setItem(STORE, JSON.stringify(rec.buffer)) } catch (e) {} }
    const push = event => { if (rec.off) return; event.at = Date.now(); rec.buffer.push(event); persist() }
    const trim = (text, max) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max || 80)
    const quote = v => '"' + String(v).replace(/(["\\])/g, '\\$1') + '"'
    const unique = s => { try { return document.querySelectorAll(s).length === 1 } catch (e) { return false } }
    const stableId = id => /^[A-Za-z][\w-]{0,60}$/.test(id) && !/\d{4,}|[a-f0-9]{8,}/i.test(id)

    const selectorOf = el => {
      const tag = el.tagName.toLowerCase()
      if (el.id && stableId(el.id) && unique('#' + CSS.escape(el.id))) return '#' + CSS.escape(el.id)
      for (const attr of ['data-testid', 'data-test', 'data-qa', 'name', 'aria-label', 'placeholder', 'title', 'alt']) {
        const v = el.getAttribute(attr)
        if (v && v.length < 100) {
          const s = tag + '[' + attr + '=' + quote(v) + ']'
          if (unique(s)) return s
        }
      }
      if (tag === 'a' && el.getAttribute('href')) {
        const s = 'a[href=' + quote(el.getAttribute('href')) + ']'
        if (unique(s)) return s
      }
      const parts = []
      let node = el
      while (node && node.nodeType === 1 && node !== document.body && parts.length < 8) {
        if (node !== el && node.id && stableId(node.id) && unique('#' + CSS.escape(node.id))) {
          parts.unshift('#' + CSS.escape(node.id))
          break
        }
        const name = node.tagName.toLowerCase()
        const siblings = node.parentElement ? Array.from(node.parentElement.children).filter(c => c.tagName === node.tagName) : []
        parts.unshift(siblings.length > 1 ? name + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')' : name)
        node = node.parentElement
      }
      return parts.join(' > ')
    }

    const labelOf = el =>
      trim(el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].innerText) || el.innerText ||
        el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') ||
        (el.type === 'submit' || el.type === 'button' ? el.value : '') || el.getAttribute('name'))

    const describe = el => ({
      label: labelOf(el),
      role: el.getAttribute('role') || undefined,
      selector: selectorOf(el),
      tag: el.tagName.toLowerCase()
    })

    const isSecret = el => {
      const type = (el.getAttribute('type') || '').toLowerCase()
      const auto = (el.getAttribute('autocomplete') || '').toLowerCase()
      return type === 'password' || /cc-|one-time-code|current-password|new-password/.test(auto)
    }

    const isField = el =>
      el && ((el.tagName === 'INPUT' && !/^(button|submit|reset|checkbox|radio|file|image|range|color)$/i.test(el.type)) ||
        el.tagName === 'TEXTAREA' || el.isContentEditable)

    const valueOf = el => (el.isContentEditable ? el.innerText : el.value)

    const flushField = el => {
      if (!isField(el)) return
      const value = valueOf(el)
      if (rec.values.get(el) === value) return
      rec.values.set(el, value)
      const secret = isSecret(el)
      push(Object.assign({ kind: 'type', secret: secret || undefined, value: secret ? '' : trim(value, 2000) }, describe(el)))
    }

    const CONTROL = 'a,button,input,select,textarea,label,summary,[role=button],[role=link],[role=menuitem],' +
      '[role=tab],[role=option],[role=checkbox],[role=radio],[role=switch],[onclick],[contenteditable=true]'

    document.addEventListener('click', event => {
      if (!event.isTrusted || !(event.target instanceof Element)) return
      const el = event.target.closest(CONTROL) || event.target
      if (el.tagName === 'SELECT') return
      const href = el.closest('a') && el.closest('a').href
      push(Object.assign({ kind: 'click', href: href || undefined }, describe(el)))
    }, true)

    document.addEventListener('change', event => {
      if (!event.isTrusted || !(event.target instanceof Element)) return
      const el = event.target
      if (el.tagName === 'SELECT') {
        const option = el.options[el.selectedIndex]
        push(Object.assign({ kind: 'select', value: option ? trim(option.text) : '' }, describe(el)))
        return
      }
      flushField(el)
    }, true)

    document.addEventListener('keydown', event => {
      if (!event.isTrusted || !['Enter', 'Escape', 'Tab'].includes(event.key) || !(event.target instanceof Element)) return
      if (event.key === 'Enter' && event.target.tagName === 'TEXTAREA' && !event.metaKey && !event.ctrlKey) return
      flushField(event.target)
      push(Object.assign({ kind: 'key', key: event.key }, describe(event.target)))
    }, true)

    document.addEventListener('focusout', event => {
      if (event.isTrusted && event.target instanceof Element) flushField(event.target)
    }, true)
  }

  rec.off = false

  if (rec.lastHref !== location.href) {
    rec.lastHref = location.href
    rec.buffer.push({ at: Date.now(), kind: 'page', url: location.href, label: document.title.slice(0, 80) })
  }

  const out = rec.buffer
  rec.buffer = []
  try { sessionStorage.removeItem(STORE) } catch (e) {}
  return JSON.stringify(out)
})()`

/** Stop recording in this document: the listeners stay (a page cannot remove anonymous ones) but go quiet. */
export const STOP_IN_PAGE_SOURCE = String.raw`(() => {
  try { sessionStorage.removeItem('brain-task-recorder') } catch (e) {}
  const rec = window.__brainTaskRec
  if (rec) { rec.off = true; rec.buffer = []; rec.lastHref = '' }
  return true
})()`
