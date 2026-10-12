import { BlockNoteEditor } from '@blocknote/core'

import { networkAccess } from '@/lib/frame-policy'

import { readLibraryBlob } from './data'
import { INTERACTIVE_DEFAULT_HEIGHT, interactiveDocument } from './interactive-html'
import { pageSchema, parseDocument } from './page-schema'

/** A page as one self-contained HTML file: its text and pictures inline, each interactive block alive
 *  in its own sealed frame. A block reaches only the hosts its owner approved on it. */

const MARKER = (n: number) => `⟦hermes-interactive:${n}⟧`
const MARKER_PARAGRAPH = /<p[^>]*>\s*⟦hermes-interactive:(\d+)⟧\s*<\/p>/g

/** The most an image may add to the file; a larger one is left out rather than bloating it. */
const IMAGE_MAX_BYTES = 8 * 1024 * 1024
const LIBRARY_URL = /^library:\/\/([\w-]+)$/

interface BlockLike {
  children?: BlockLike[]
  content?: unknown
  props?: Record<string, unknown>
  type: string
}

interface InteractiveUse {
  fileId: string
  height: number
  network: string
  state: string
  title: string
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const paragraph = (text: string) => ({ content: [{ styles: {}, text, type: 'text' }], type: 'paragraph' })

function dataUrlOf(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** The page's blocks, ready to print as plain HTML: interactive blocks held by a marker, sub-pages
 *  as their title, pictures inline, other attachments by name. */
async function prepare(blocks: readonly BlockLike[], uses: InteractiveUse[]): Promise<BlockLike[]> {
  const out: BlockLike[] = []

  for (const block of blocks) {
    const props = block.props ?? {}
    const children = block.children?.length ? await prepare(block.children, uses) : []

    if (block.type === 'interactive' && typeof props.fileId === 'string' && props.fileId) {
      uses.push({
        fileId: props.fileId,
        height: Number(props.height) || 0,
        network: String(props.network ?? ''),
        state: String(props.state ?? ''),
        title: String(props.title ?? '')
      })
      out.push(paragraph(MARKER(uses.length - 1)) as BlockLike)

      continue
    }

    if (block.type === 'page') {
      out.push(paragraph(String(props.title ?? '')) as BlockLike)

      continue
    }

    const id = typeof props.url === 'string' ? LIBRARY_URL.exec(props.url)?.[1] : undefined

    if (id && block.type === 'image') {
      const blob = await readLibraryBlob(id).catch(() => null)

      out.push(
        blob && blob.size <= IMAGE_MAX_BYTES
          ? { ...block, children, props: { ...props, url: await dataUrlOf(blob) } }
          : (paragraph(String(props.name ?? '')) as BlockLike)
      )

      continue
    }

    if (id) {
      out.push(paragraph(String(props.name ?? '')) as BlockLike)

      continue
    }

    out.push({ ...block, children })
  }

  return out
}

const STYLE = `*{box-sizing:border-box}
body{margin:0;background:#fff;color:#1d1d1f;font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:56px 24px 96px}
h1.title{margin:0 0 28px;font-size:2.25rem;line-height:1.15;letter-spacing:-.02em}
h1,h2,h3{line-height:1.25;letter-spacing:-.01em}h2{margin-top:1.8em}h3{margin-top:1.5em}
p,ul,ol,blockquote,pre,table{margin:.75em 0}img{max-width:100%;height:auto;border-radius:8px}
blockquote{margin-left:0;padding-left:16px;border-left:3px solid #d4d4d8;color:#52525b}
pre,code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.875em}
pre{padding:14px 16px;border-radius:10px;background:#f4f4f5;overflow:auto}
table{border-collapse:collapse;width:100%}th,td{padding:8px 10px;border:1px solid #e4e4e7;text-align:left}
iframe.hermes-block{display:block;width:100%;margin:1.1em 0;border:1px solid #e4e4e7;border-radius:12px;background:#fff}
@media print{main{max-width:none;padding:0}iframe.hermes-block{break-inside:avoid}}`

/** Frames say how tall their content is; an exported page that can run a script lets them fit it. */
const FIT_SCRIPT = `<script>addEventListener('message',function(e){var d=e.data;if(!d||d.type!=='hermes-interactive-height')return;var f=document.querySelectorAll('iframe.hermes-block[data-fit]');for(var i=0;i<f.length;i++)if(f[i].contentWindow===e.source)f[i].style.height=Math.min(1200,Math.max(120,d.height))+'px'})</script>`

export interface PageHtmlOptions {
  content: null | string
  markdown: string
  /** Let frames fit their content by script (a downloaded file), or keep their heights (printing). */
  fit: boolean
  title: string
}

export async function pageHtml({ content, fit, markdown, title }: PageHtmlOptions): Promise<string> {
  const editor = BlockNoteEditor.create({ schema: pageSchema })
  const source = (parseDocument(content) ?? editor.tryParseMarkdownToBlocks(markdown)) as unknown as BlockLike[]
  const uses: InteractiveUse[] = []
  const prepared = await prepare(source, uses)
  let body = editor.blocksToHTMLLossy(prepared as never)

  const frames = new Map<number, string>()

  for (const [n, use] of uses.entries()) {
    const html = await readLibraryBlob(use.fileId)
      .then(blob => blob.text())
      .catch(() => null)

    let state: unknown = null

    try {
      state = use.state ? JSON.parse(use.state) : null
    } catch {
      state = null
    }

    frames.set(
      n,
      html === null
        ? ''
        : `<iframe class="hermes-block" ${fit && !use.height ? 'data-fit ' : ''}sandbox="allow-scripts" title="${escapeHtml(use.title || 'Interactive block')}" style="height:${use.height || INTERACTIVE_DEFAULT_HEIGHT}px" srcdoc="${escapeHtml(interactiveDocument(html, { hosts: networkAccess(html, use.network).active, state }))}"></iframe>`
    )
  }

  body = body.replace(MARKER_PARAGRAPH, (_match, n: string) => frames.get(Number(n)) ?? '')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${STYLE}
</style>
</head>
<body>
<main>
<h1 class="title">${escapeHtml(title)}</h1>
${body}
</main>
${fit ? FIT_SCRIPT : ''}
</body>
</html>
`
}
