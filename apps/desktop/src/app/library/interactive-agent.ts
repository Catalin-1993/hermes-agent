import { requestComposerFocus, requestComposerSubmit } from '@/app/chat/composer/focus'
import { setComposerDraft } from '@/store/composer'
import { requestFreshSession } from '@/store/profile'

import { getLibraryItem, updateLibraryItem } from './data'

/** What a block's file holds while Hermes has not yet written its document. */
export const BUILDING_MARKER = '<!-- hermes:building -->'

export const isBuilding = (html: string) => html.trimStart().startsWith(BUILDING_MARKER)

/** The empty document a block starts as when Hermes is to build it. */
export const buildingDocument = () => `${BUILDING_MARKER}\n`

const HTML_START = /^\s*(<!doctype\b|<html\b|<[a-z][\w-]*[\s>/])/i

/** HTML to run, or words to build from? Decides what the setup card's one button does. */
export const looksLikeHtml = (text: string) => HTML_START.test(text)

/** The request Hermes receives to fill a block that is waiting. */
export const buildPrompt = (fileId: string, description: string) =>
  `Build an interactive block for my Library: ${description.trim()}\n\nIt is waiting as the HTML file ${fileId} ` +
  'on one of my pages — write its whole document with the library tool (action "block", id above).'

/** The request Hermes receives to change a block that already runs. */
export const changePrompt = (fileId: string, title: string, request: string) =>
  `Change the interactive block “${title}” in my Library (HTML file ${fileId}): ${request.trim()}\n\n` +
  'Read it first, then write the whole updated document with the library tool (action "block", id above).'

/**
 * Handing a block to Hermes is the owner's own act, so a block that is still private opens to Hermes
 * for asking — it still asks before every read and every write.
 */
export async function delegateBlock(fileId: string): Promise<void> {
  const { item } = await getLibraryItem(fileId)

  if (item.visibility === 'private') {
    await updateLibraryItem(fileId, { visibility: 'ask' })
  }
}

/** A fresh chat that sends `prompt` as soon as its composer is on screen — or, if none comes up in
 *  time, leaves it written in the composer for one Enter, never lost. */
export function sendToHermes(prompt: string): void {
  requestFreshSession()

  let attempts = 0

  const attempt = () => {
    if (requestComposerSubmit(prompt)) {
      return
    }

    attempts += 1

    if (attempts < 20) {
      window.setTimeout(attempt, 150)
    } else {
      setComposerDraft(prompt)
      requestComposerFocus()
    }
  }

  window.setTimeout(attempt, 300)
}
