import { beforeEach, describe, expect, it, vi } from 'vitest'

import { saveWidgetToLibrary } from './chat-bridge'
import { getLibraryItem, importLibraryFile, updateLibraryItem } from './data'

vi.mock('./data', () => ({
  bumpLibraryRevision: vi.fn(),
  createLibraryPage: vi.fn(async () => ({ id: 'new-page' })),
  exportLibraryItem: vi.fn(),
  getLibraryItem: vi.fn(),
  importLibraryFile: vi.fn(async () => ({ id: 'file-1' })),
  updateLibraryItem: vi.fn(async () => ({}))
}))

vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))

const WIDGET = '<title>Sales</title><div>x</div>'
const page = (over: Record<string, unknown> = {}) => ({ id: 'page-1', kind: 'page', title: 'Notes', ...over }) as never

describe('adding a widget to a page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('puts the widget file under that page and its link after what the page already says', async () => {
    vi.mocked(getLibraryItem).mockResolvedValue({ item: { content: null, id: 'page-1', markdown: 'Intro\n' } } as never)

    await saveWidgetToLibrary(WIDGET, page())

    expect(importLibraryFile).toHaveBeenCalledWith(expect.any(File), 'page-1')
    expect(updateLibraryItem).toHaveBeenCalledWith('page-1', { markdown: 'Intro\n\n[Sales](library://file-1)' })
  })

  it('adds a block to a page that already has a block document, without touching the rest of it', async () => {
    const existing = [{ id: 'a', type: 'paragraph', children: [], props: {} }]

    vi.mocked(getLibraryItem).mockResolvedValue({
      item: { content: JSON.stringify(existing), id: 'page-1', markdown: 'Intro' }
    } as never)

    await saveWidgetToLibrary(WIDGET, page())

    const [, patch] = vi.mocked(updateLibraryItem).mock.calls[0] as [string, { content: string; markdown: string }]
    const blocks = JSON.parse(patch.content)

    expect(blocks[0]).toEqual(existing[0])
    expect(blocks).toHaveLength(2)
    expect(blocks[1]).toMatchObject({ props: { fileId: 'file-1', title: 'Sales' }, type: 'interactive' })
    expect(patch.markdown).toBe('Intro\n\n[Sales](library://file-1)')
  })

  it('starts a page of its own when none is chosen', async () => {
    await saveWidgetToLibrary(WIDGET)

    expect(importLibraryFile).toHaveBeenCalledWith(expect.any(File), 'new-page')
    expect(updateLibraryItem).toHaveBeenCalledWith('new-page', { markdown: '[Sales](library://file-1)' })
    expect(getLibraryItem).not.toHaveBeenCalled()
  })
})
