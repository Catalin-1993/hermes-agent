import { atom } from 'nanostores'

import { persistStore } from '@/lib/persist-store'
import { persistBoolean, storedBoolean } from '@/lib/storage'

const STICKY_PROMPT_STORAGE_KEY = 'hermes.desktop.stickyPrompt.v1'

/**
 * Whether the question you last asked stays pinned at the top of the conversation while you scroll. Off by default:
 * the question scrolls away with the page, like any other message. Desktop-local, shared by all threads in this window.
 */
export const $stickyPrompt = atom(storedBoolean(STICKY_PROMPT_STORAGE_KEY, false))

persistStore($stickyPrompt, (value, options) => persistBoolean(STICKY_PROMPT_STORAGE_KEY, value, options), false)

export function setStickyPrompt(value: boolean) {
  $stickyPrompt.set(value)
}
