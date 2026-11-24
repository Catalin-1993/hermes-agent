/**
 * Brain: Settings → Appearance → Chat display → "Structured chat". A desktop-local display preference: when on,
 * the transcript is laid out like a short document (components/assistant-ui/thread/chat-structured.css). It changes
 * only how the app shows what the agent already wrote — never what the agent is told or how it answers.
 */

import { Codecs, persistentAtom } from '@/lib/persisted'

export const $structuredChat = persistentAtom('hermes.desktop.structured-chat.v1', false, Codecs.bool)

export const setStructuredChat = (on: boolean) => $structuredChat.set(on)
