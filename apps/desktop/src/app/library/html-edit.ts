/**
 * Editing an HTML file by looking at it. The page runs as it always does, in its sealed frame; the texts
 * that sit in the file's own markup become editable where they stand, and what is typed is written back
 * into the file's markup — nobody sees code.
 *
 * Only text the file itself holds can be edited: a number a script draws, a chart, a calculator is not in
 * the markup, so it is not offered (Hermes is asked to change those). Only text changes: tags, classes,
 * styles and scripts of the file stay as they are, and so does everything the person did not touch.
 */

/** Tags that may sit inside a line of text. Whatever else the editor leaves behind is unwrapped. */
const INLINE = new Set(
  'a abbr b bdi bdo br cite code del dfn em i ins kbd mark q s samp small span strong sub sup time u var wbr'.split(' ')
)

/** Elements whose text is not prose, or is not typed into. */
const SKIPPED = 'script,style,svg,canvas,textarea,select,option,button,input,noscript,template,iframe,object,title,head'

const MARK = 'data-hermes-edit'

const isInline = (node: Node): boolean =>
  node.nodeType === Node.TEXT_NODE ||
  (node instanceof Element && INLINE.has(node.localName) && [...node.childNodes].every(isInline))

/** The editable elements of a document, in document order — the same list for the same markup. A line of
 *  text is one element: the bold word inside it is part of it, not another. */
function editableElements(doc: Document): Element[] {
  const lines = [...(doc.body?.querySelectorAll('*') ?? [])].filter(
    el =>
      !el.matches(SKIPPED) &&
      !el.closest(SKIPPED) &&
      [...el.childNodes].every(isInline) &&
      [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
  )

  return lines.filter(el => !lines.some(other => other !== el && other.contains(el)))
}

const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html')

const serialize = (doc: Document, source: string): string =>
  `${/^\s*<!doctype/i.test(source) ? '<!DOCTYPE html>\n' : ''}${doc.documentElement.outerHTML}`

/** The file with each editable text numbered, for the frame to find. */
export function markEditable(html: string): string {
  const doc = parse(html)

  editableElements(doc).forEach((el, index) => el.setAttribute(MARK, String(index)))

  return serialize(doc, html)
}

/** What the person typed, reduced to text and the few inline tags: no scripts, handlers or leftovers. */
export function cleanInline(html: string): string {
  const holder = parse(`<body>${html}</body>`).body

  holder.querySelectorAll(SKIPPED).forEach(el => el.remove())

  for (const el of [...holder.querySelectorAll('*')].reverse()) {
    if (!INLINE.has(el.localName)) {
      el.replaceWith(...el.childNodes)

      continue
    }

    for (const { name, value } of [...el.attributes]) {
      if (name === MARK || name === 'contenteditable' || name.startsWith('on') || /^\s*javascript:/i.test(value)) {
        el.removeAttribute(name)
      }
    }
  }

  return holder.innerHTML
}

/** The file with the typed texts put in their places; the file untouched where nothing was typed. */
export function applyEdits(source: string, edits: Readonly<Record<string, string>>): string {
  if (Object.keys(edits).length === 0) {
    return source
  }

  const doc = parse(source)
  const elements = editableElements(doc)

  for (const [id, html] of Object.entries(edits)) {
    const el = elements[Number(id)]

    if (el) {
      el.innerHTML = cleanInline(html)
    }
  }

  return serialize(doc, source)
}

/** Runs inside the frame: makes the numbered texts editable and reports each change to the app. */
export const EDIT_SCRIPT = `(function(){
var s=document.createElement('style');
s.textContent='[${MARK}]{cursor:text;border-radius:3px;transition:background .12s,box-shadow .12s}[${MARK}]:hover{background:rgba(110,140,255,.1);box-shadow:0 0 0 3px rgba(110,140,255,.1)}[${MARK}]:focus{outline:none;background:rgba(110,140,255,.14);box-shadow:0 0 0 3px rgba(110,140,255,.3)}';
document.head.appendChild(s);
document.querySelectorAll('[${MARK}]').forEach(function(el){
el.contentEditable='true';el.spellcheck=true;
el.addEventListener('input',function(){parent.postMessage({hermesEdit:true,id:el.getAttribute('${MARK}'),html:el.innerHTML},'*')});
el.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();document.execCommand('insertLineBreak')}});
el.addEventListener('paste',function(e){e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))});
});
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('a'))e.preventDefault()},true);
})();`

/** The file prepared for editing in the frame: texts numbered, the editing script last. */
export function editableDocument(html: string): string {
  const marked = markEditable(html)
  const script = `<script>${EDIT_SCRIPT}</script>`

  return /<\/body>/i.test(marked) ? marked.replace(/<\/body>/i, `${script}</body>`) : `${marked}${script}`
}

/** A text of the page, changed: which one, and what it is now. */
export interface PageEdit {
  html: string
  id: string
}

/** A message from the frame: which text changed, and what it is now. */
export function readEdit(data: unknown): null | PageEdit {
  const message = data as { hermesEdit?: unknown; html?: unknown; id?: unknown } | null

  return message?.hermesEdit === true && typeof message.id === 'string' && typeof message.html === 'string'
    ? { html: message.html, id: message.id }
    : null
}
