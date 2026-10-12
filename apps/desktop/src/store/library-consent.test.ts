import type { ServerRequest } from '@hermes/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  $libraryConsents,
  answerLibraryConsent,
  normalizeLibraryConsent,
  receiveLibraryConsent,
  sessionLibraryConsents
} from './library-consent'
import { rememberServerRequest, resetServerRequestsForTests } from './server-requests'

const fakeRequest = (id: string) =>
  ({ id, respond: vi.fn() }) as unknown as ServerRequest & { respond: ReturnType<typeof vi.fn> }

afterEach(() => {
  $libraryConsents.set([])
  resetServerRequestsForTests()
})

describe('library consent', () => {
  it('refuses frames the card cannot spell out', () => {
    expect(normalizeLibraryConsent({ action: 'create' }, 'r1', 's1')).toBeNull()
    expect(normalizeLibraryConsent({ action: 'format_disk', summary: 'x' }, 'r1', 's1')).toBeNull()

    const request = normalizeLibraryConsent(
      {
        action: 'update',
        changes: ['Replaces the page', 7],
        summary: 'Edit',
        target: { title: 'Plan', visibility: 'nope' }
      },
      'r1',
      's1'
    )

    expect(request?.changes).toEqual(['Replaces the page'])
    expect(request?.target).toMatchObject({ kind: 'page', title: 'Plan', visibility: null })
  })

  it('answers the backend exactly once and takes the card down', () => {
    const wire = fakeRequest('r1')

    rememberServerRequest(wire)
    receiveLibraryConsent(normalizeLibraryConsent({ action: 'delete', summary: 'Trash it' }, 'r1', 's1')!)
    expect(sessionLibraryConsents('s1').get()).toHaveLength(1)

    expect(answerLibraryConsent('r1', false)).toBe(true)
    expect(answerLibraryConsent('r1', true)).toBe(false)
    expect(wire.respond).toHaveBeenCalledTimes(1)
    expect(wire.respond).toHaveBeenCalledWith({ approved: false, note: '' })
    expect(sessionLibraryConsents('s1').get()).toHaveLength(0)
  })

  it('keeps each session to its own cards', () => {
    receiveLibraryConsent(normalizeLibraryConsent({ action: 'read', summary: 'a' }, 'r1', 's1')!)
    receiveLibraryConsent(normalizeLibraryConsent({ action: 'read', summary: 'b' }, 'r2', 's2')!)

    expect(
      sessionLibraryConsents('s1')
        .get()
        .map(r => r.requestId)
    ).toEqual(['r1'])
    expect(
      sessionLibraryConsents('s2')
        .get()
        .map(r => r.requestId)
    ).toEqual(['r2'])
  })
})
