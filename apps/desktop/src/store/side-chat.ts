import { atom } from 'nanostores'

import { Codecs, persistentAtom } from '@/lib/persisted'

import type { SessionDraft } from './composer'

/** Opens a fresh chat in a pane beside whatever the window shows, its composer seeded with `draft`.
 *  Wired by the shell (it owns session creation); null until then. A page that wants Hermes beside
 *  it — the Library's "Hermes" button — calls this instead of reaching for session plumbing. Resolves to the new stored session id. */
export const $sideChatOpener = atom<((draft: SessionDraft) => Promise<string | undefined>) | null>(null)

/** Chats opened beside a page as its companion. They run bare — no tab strip, no title, no "+" —
 *  because the page is the subject and the chat only its helper; a handle on the chat's own corner
 *  brings the full chrome back. Persisted so a restart keeps them as they were. */
export const $companionChats = persistentAtom<string[]>('hermes.desktop.companionChats', [], Codecs.stringArray)

export function markCompanionChat(storedSessionId: string) {
  if (!$companionChats.get().includes(storedSessionId)) {
    $companionChats.set([...$companionChats.get(), storedSessionId].slice(-40))
  }
}

export function unmarkCompanionChat(storedSessionId: string) {
  $companionChats.set($companionChats.get().filter(id => id !== storedSessionId))
}
