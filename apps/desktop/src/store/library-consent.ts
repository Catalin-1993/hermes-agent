import { atom, computed, type ReadableAtom } from 'nanostores'

import { respondToServerRequest } from '@/store/server-requests'

export type LibraryConsentAction = 'attach' | 'create' | 'delete' | 'read' | 'search' | 'update'
export type LibraryVisibility = 'ask' | 'open' | 'private'

export interface LibraryConsentTarget {
  id: null | string
  kind: 'file' | 'page'
  title: string
  visibility: LibraryVisibility | null
}

/** One `library.consent` server request, parked until the owner answers it. */
export interface LibraryConsentRequest {
  action: LibraryConsentAction
  changes: string[]
  preview: string
  query: null | string
  reason: string
  receivedAt: number
  /** The server request id — the answer rides back as its JSON-RPC response. */
  requestId: string
  sessionId: null | string
  summary: string
  target: LibraryConsentTarget | null
}

const ACTIONS = new Set<LibraryConsentAction>(['attach', 'create', 'delete', 'read', 'search', 'update'])
const VISIBILITIES = new Set<LibraryVisibility>(['ask', 'open', 'private'])

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Params from the wire → a request, or null when the frame is not a usable consent ask. */
export function normalizeLibraryConsent(
  params: Record<string, unknown>,
  requestId: string,
  sessionId: null | string
): LibraryConsentRequest | null {
  const action = text(params.action) as LibraryConsentAction
  const summary = text(params.summary).trim()

  if (!ACTIONS.has(action) || !summary) {
    return null
  }

  const rawTarget =
    params.target && typeof params.target === 'object' ? (params.target as Record<string, unknown>) : null

  const visibility = text(rawTarget?.visibility) as LibraryVisibility

  return {
    action,
    changes: Array.isArray(params.changes) ? params.changes.filter((c): c is string => typeof c === 'string') : [],
    preview: text(params.preview),
    query: text(params.query) || null,
    reason: text(params.reason).trim(),
    receivedAt: Date.now(),
    requestId,
    sessionId,
    summary,
    target: rawTarget
      ? {
          id: text(rawTarget.id) || null,
          kind: rawTarget.kind === 'file' ? 'file' : 'page',
          title: text(rawTarget.title),
          visibility: VISIBILITIES.has(visibility) ? visibility : null
        }
      : null
  }
}

/** Every parked consent card, oldest first. A replayed request (reconnect) replaces its entry. */
export const $libraryConsents = atom<LibraryConsentRequest[]>([])

export function receiveLibraryConsent(request: LibraryConsentRequest): void {
  $libraryConsents.set([...$libraryConsents.get().filter(r => r.requestId !== request.requestId), request])
}

export function clearLibraryConsent(requestId: string): void {
  const next = $libraryConsents.get().filter(r => r.requestId !== requestId)

  if (next.length !== $libraryConsents.get().length) {
    $libraryConsents.set(next)
  }
}

/** Answer one card. False when the request is gone (withdrawn, answered elsewhere). */
export function answerLibraryConsent(requestId: string, approved: boolean): boolean {
  clearLibraryConsent(requestId)

  return respondToServerRequest(requestId, { approved, note: '' })
}

const bySession = new Map<string, ReadableAtom<LibraryConsentRequest[]>>()

/** The cards one session raised (stable atom per session id). */
export function sessionLibraryConsents(sessionId: null | string): ReadableAtom<LibraryConsentRequest[]> {
  const key = sessionId ?? ''
  let derived = bySession.get(key)

  if (!derived) {
    derived = computed($libraryConsents, all => all.filter(r => (r.sessionId ?? '') === key))
    bySession.set(key, derived)
  }

  return derived
}
