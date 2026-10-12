import { requestComposerFocus, requestComposerSubmit } from '@/app/chat/composer/focus'
import { formatRefValue } from '@/components/assistant-ui/directive-text'
import { translateNow } from '@/i18n'
import { attachmentId } from '@/lib/chat-runtime'
import {
  addComposerAttachment,
  addTileAttachment,
  type ComposerAttachment,
  requestComposerDraftSync,
  type SessionDraft,
  stashSessionDraft,
  takeSessionDraft
} from '@/store/composer'
import { notify, notifyError } from '@/store/notifications'
import { requestFreshSession } from '@/store/profile'
import { $sessionTiles } from '@/store/session-states'
import { $companionChats, $sideChatOpener, markCompanionChat } from '@/store/side-chat'

import {
  bumpLibraryRevision,
  createLibraryPage,
  exportLibraryItem,
  getLibraryItem,
  importLibraryFile,
  type LibraryItem,
  updateLibraryItem
} from './data'
import { sendToHermes } from './interactive-agent'
import { htmlFileName, htmlTitle } from './interactive-html'

/** A Library item as a composer chip, under the name the user knows. */
async function libraryAttachment(item: LibraryItem): Promise<ComposerAttachment> {
  const path = await exportLibraryItem(item.id)

  return {
    detail: translateNow('library.title'),
    id: attachmentId('file', path),
    kind: 'file',
    label: item.title || item.file_name || path,
    path,
    refText: `@file:${formatRefValue(path)}`
  }
}

/** Put Library items in the main composer as file context, under the names the user knows. The user
 *  chose them, which is the consent: access levels govern what Hermes may reach on its own. */
export async function attachLibraryItems(items: readonly LibraryItem[]): Promise<void> {
  try {
    for (const item of items) {
      addComposerAttachment(await libraryAttachment(item))
    }

    requestComposerFocus()
  } catch (error) {
    notifyError(error, translateNow('library.chat.attachFailed'))
  }
}

// Brain beside the Library is ONE chat: pressing the button on another item, or again on the same, goes to
// the chat already docked rather than opening a second. `opening` covers the moment between pressing and the
// chat existing, so a double press cannot open two either.
let opening: null | Promise<null | string> = null

/** The stored id of the chat docked beside the Library, when one is open in this window. */
function companionSession(): null | string {
  const marked = $companionChats.get()

  return $sessionTiles.get().find(tile => marked.includes(tile.storedSessionId))?.storedSessionId ?? null
}

/** The companion chat — the open one, or a new one seeded with `draft`. `created` says which it was. */
async function ensureCompanion(draft: SessionDraft): Promise<null | { created: boolean; stored: string }> {
  const existing = companionSession()

  if (existing) {
    return { created: false, stored: existing }
  }

  if (opening) {
    const stored = await opening

    return stored ? { created: false, stored } : null
  }

  const open = $sideChatOpener.get()

  if (!open) {
    return null
  }

  opening = open(draft)
    .then(stored => stored ?? null)
    .finally(() => {
      opening = null
    })

  const stored = await opening

  if (!stored) {
    return null
  }

  markCompanionChat(stored)

  return { created: true, stored }
}

/** Brain beside the item: the one chat docked to the right of the Library, with the item attached so the page
 *  stays in view while Brain works on it. An open chat takes the item as one more attachment. Without a shell
 *  to dock into, it falls back to a new chat. */
export async function openHermesBeside(item: LibraryItem): Promise<void> {
  if (!$sideChatOpener.get()) {
    askHermesAbout(item)

    return
  }

  try {
    const attachment = await libraryAttachment(item)
    const chat = await ensureCompanion({ attachments: [attachment], text: '' })

    if (chat && !chat.created) {
      // The open chat's own composer takes the chip; one that is not mounted (a background tab) gets it in its draft.
      if (!addTileAttachment(chat.stored, attachment)) {
        const draft = takeSessionDraft(chat.stored)

        if (!draft.attachments.some(entry => entry.id === attachment.id)) {
          stashSessionDraft(chat.stored, draft.text, [...draft.attachments, attachment])
          requestComposerDraftSync('reload', `tile:${chat.stored}`)
        }
      }

      requestComposerFocus(`tile:${chat.stored}`)
    }
  } catch (error) {
    notifyError(error, translateNow('library.chat.attachFailed'))
  }
}

/** Hand Hermes a task about `itemId` in the chat beside it (a fresh one when none is open), sent at
 *  once — or, if its composer never comes up in time, left written there for one Enter, never lost. */
export async function startHermesBeside(itemId: string, prompt: string): Promise<void> {
  if (!$sideChatOpener.get()) {
    sendToHermes(prompt)

    return
  }

  const chat = await ensureCompanion({ attachments: [], text: '' })

  if (!chat) {
    return
  }

  const stored = chat.stored
  const target = `tile:${stored}`
  let attempts = 0

  const attempt = () => {
    if (requestComposerSubmit(prompt, { target })) {
      return
    }

    attempts += 1

    if (attempts < 30) {
      window.setTimeout(attempt, 150)

      return
    }

    stashSessionDraft(stored, prompt, [])
    requestComposerDraftSync('reload', target)
    requestComposerFocus(target)
  }

  window.setTimeout(attempt, 200)
}

/** Hand Hermes a task about a file in the chat beside it, the file itself referenced in the message. */
export async function askHermesBesideAbout(item: LibraryItem, prompt: string): Promise<void> {
  try {
    const path = await exportLibraryItem(item.id)

    await startHermesBeside(item.id, `${prompt}\n\n@file:${formatRefValue(path)}`)
  } catch (error) {
    notifyError(error, translateNow('library.chat.attachFailed'))
  }
}

/** Start a new chat about one item: a fresh draft with the item attached. */
export function askHermesAbout(item: LibraryItem) {
  requestFreshSession()
  // The fresh draft swaps the composer's scope after it renders; attach once it has.
  window.setTimeout(() => void attachLibraryItems([item]), 250)
}

export const firstLine = (text: string) =>
  text
    .split('\n')
    .map(line =>
      line
        .replace(/^[#>*\-\d.\s]+/, '')
        .replace(/[*_`]/g, '')
        .trim()
    )
    .find(Boolean)
    ?.slice(0, 80)

/** Keep a reply as a Library page, named after its first line, with a way to open it. */
export async function saveTextToLibrary(text: string): Promise<void> {
  try {
    const page = await createLibraryPage({ markdown: text, title: firstLine(text) ?? '' })

    bumpLibraryRevision()
    notify({
      action: {
        label: translateNow('library.chat.open'),
        onClick: () => {
          window.location.hash = `#/artifacts?item=${page.id}`
        }
      },
      durationMs: 5000,
      kind: 'info',
      message: translateNow('library.chat.savedToLibrary')
    })
  } catch (error) {
    notifyError(error, translateNow('library.errors.save'))
  }
}

const HEADING = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i

/** What a widget is called on its page: its `<title>`, else its first heading, else the block's name. */
function widgetName(html: string): string {
  const heading = HEADING.exec(html)?.[1]
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return htmlTitle(html) || heading || translateNow('library.editor.interactive')
}

/** Keep a chat widget in the Library as an interactive block — on a page of its own, or at the end of
 *  `page` when one is chosen. The widget's document sits beneath the page as a file, so it keeps its
 *  data, versions and access like any block. */
export async function saveWidgetToLibrary(html: string, page?: LibraryItem): Promise<void> {
  try {
    const title = widgetName(html)
    const target = page ?? (await createLibraryPage({ title }))
    const file = new File([html], htmlFileName(html, title), { type: 'text/html' })
    const document = await importLibraryFile(file, target.id)
    const link = `[${title.replace(/[[\]]/g, '')}](library://${document.id})`

    if (page) {
      await appendBlock(page.id, link, { fileId: document.id, title })
    } else {
      await updateLibraryItem(target.id, { markdown: link })
    }

    bumpLibraryRevision()
    notify({
      action: {
        label: translateNow('library.chat.open'),
        onClick: () => {
          window.location.hash = `#/artifacts?item=${target.id}`
        }
      },
      durationMs: 5000,
      kind: 'info',
      message: page
        ? translateNow('library.chat.addedToPage', page.title || translateNow('library.untitled'))
        : translateNow('library.chat.savedToLibrary')
    })
  } catch (error) {
    notifyError(error, translateNow('library.errors.save'))
  }
}

/** The page as it is now plus one block at its end — in its markdown, and in its block document when
 *  it has one, so nothing the owner arranged is flattened. */
async function appendBlock(pageId: string, link: string, props: { fileId: string; title: string }) {
  const { item } = await getLibraryItem(pageId)
  const markdown = item.markdown?.trim() ? `${item.markdown.trimEnd()}\n\n${link}` : link

  if (!item.content) {
    await updateLibraryItem(pageId, { markdown })

    return
  }

  const blocks: unknown[] = JSON.parse(item.content)

  blocks.push({ children: [], id: crypto.randomUUID(), props: { ...props, height: 0 }, type: 'interactive' })
  await updateLibraryItem(pageId, { content: JSON.stringify(blocks), markdown })
}
