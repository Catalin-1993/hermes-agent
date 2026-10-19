import { describe, expect, it, vi } from 'vitest'

const respond = vi.fn(() => true)

vi.mock('@/store/server-requests', () => ({ respondToServerRequest: respond }))

const { answerLibraryConsent, normalizeLibraryConsent } = await import('./library-consent')

describe('editing a page on the Library consent card', () => {
  it('keeps the whole page the agent proposed, so the owner can edit it', () => {
    const request = normalizeLibraryConsent(
      {
        action: 'create',
        content: '# Plan\n\nTot textul',
        editable: true,
        preview: '# Plan…',
        summary: 'Create',
        title: 'Plan'
      },
      'req-1',
      'session-1'
    )

    expect(request).toMatchObject({ content: '# Plan\n\nTot textul', editable: true, title: 'Plan' })
  })

  it('sends the owner edits with an approval, and never with a decline', () => {
    answerLibraryConsent('req-2', true, { content: 'Versiunea mea', title: 'Plan nou' })
    answerLibraryConsent('req-3', false, { content: 'ignorat' })

    expect(respond).toHaveBeenCalledWith('req-2', {
      approved: true,
      content: 'Versiunea mea',
      note: '',
      title: 'Plan nou'
    })
    expect(respond).toHaveBeenCalledWith('req-3', { approved: false, note: '' })
  })
})
