import { describe, expect, it, vi } from 'vitest'

const files: Record<string, Blob> = {
  fl_block: new Blob(['<!doctype html><title>ROI</title><p id="x">hi "there" & <b>bold</b></p><script>1</script>'], {
    type: 'text/html'
  }),
  fl_image: new Blob(['PNGDATA'], { type: 'image/png' })
}

vi.mock('./data', () => ({
  readLibraryBlob: (id: string) => (files[id] ? Promise.resolve(files[id]) : Promise.reject(new Error('gone')))
}))

const { pageHtml } = await import('./page-export')

const doc = JSON.stringify([
  {
    children: [],
    content: [{ styles: {}, text: 'Plan', type: 'text' }],
    id: 'a',
    props: { level: 2 },
    type: 'heading'
  },
  {
    children: [],
    content: [{ styles: {}, text: 'Before the tool.', type: 'text' }],
    id: 'b',
    props: {},
    type: 'paragraph'
  },
  {
    children: [],
    id: 'c',
    props: { fileId: 'fl_block', height: 0, state: '{"n":2}', title: 'ROI' },
    type: 'interactive'
  },
  { children: [], id: 'd', props: { pageId: 'pg_sub', title: 'Sub page' }, type: 'page' },
  { children: [], id: 'e', props: { name: 'pic.png', url: 'library://fl_image' }, type: 'image' },
  { children: [], id: 'f', props: { fileId: 'fl_missing', height: 500, state: '', title: 'Lost' }, type: 'interactive' }
])

describe('pageHtml', () => {
  it('writes the page as one file: text, pictures inline, each block alive in a sealed frame', async () => {
    const html = await pageHtml({ content: doc, fit: true, markdown: '', title: 'My <plan>' })

    expect(html).toContain('<title>My &lt;plan&gt;</title>')
    expect(html).toMatch(/<h2[^>]*>Plan<\/h2>/)
    expect(html).toContain('Before the tool.')
    expect(html).toContain('Sub page')
    expect(html).toContain('data:image/png;base64,')
    // Nothing points back into the Library.
    expect(html).not.toContain('library://')
    // The block is its own sandboxed frame; its document is escaped into the attribute, state included.
    const frame = /<iframe class="hermes-block" data-fit sandbox="allow-scripts"[^>]*srcdoc="([^"]*)"/.exec(html)

    expect(frame).not.toBeNull()
    expect(frame![1]).toContain('&lt;p id=&quot;x&quot;&gt;hi &quot;there&quot; &amp; &lt;b&gt;bold')
    expect(frame![1]).toContain('Content-Security-Policy')
    expect(frame![1]).toContain('&quot;n&quot;:2')
    // One that cannot be read leaves nothing behind, and a fixed height is kept without fitting.
    expect(html.match(/<iframe/g)).toHaveLength(1)
    expect(html).toContain('hermes-interactive-height')
  })

  it('keeps each frame to its own height when printing', async () => {
    const html = await pageHtml({ content: doc, fit: false, markdown: '', title: 'Plan' })

    expect(html).not.toContain('data-fit')
    expect(html).not.toContain('<script>addEventListener')
    expect(html).toContain('style="height:320px"')
  })

  it('falls back to the markdown of a page that was never opened', async () => {
    const html = await pageHtml({ content: null, fit: false, markdown: '# Hello\n\nA *plain* page.', title: 'New' })

    expect(html).toMatch(/<h1[^>]*>Hello<\/h1>/)
    expect(html).toContain('<em>plain</em>')
  })
})
