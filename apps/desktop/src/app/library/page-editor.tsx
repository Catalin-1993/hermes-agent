import '@blocknote/shadcn/style.css'

import { filterSuggestionItems } from '@blocknote/core'
import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import {
  type DefaultReactSuggestionItem,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import { mediaExternalUrl, resolveMediaDisplaySrc, resolveMediaPlaybackSrc } from '@/lib/media'
import { notifyError } from '@/store/notifications'
import { useTheme } from '@/themes/context'

import { bumpLibraryRevision, createLibraryPage, getLibraryItem, importLibraryFile, trashLibraryItem } from './data'
import { fileCategoryOf, ITEM_TYPE_ICON } from './file-types'
import { PageIdContext } from './interactive-block'
import { htmlTitle } from './interactive-html'
import { OpenPageContext } from './page-block'
import { type PageDocument, type PageEditorInstance, pageSchema, parseDocument } from './page-schema'

const schema = pageSchema

/** Files embedded in a page are Library items; the document stores `library://<id>` and each render
 *  resolves it to something this window can load (local disk or the remote gateway's media proxy). */
const LIBRARY_URL = /^library:\/\/([\w-]+)$/
const resolved = new Map<string, Promise<string>>()

export function resolveLibraryUrl(url: string): Promise<string> {
  const id = LIBRARY_URL.exec(url)?.[1]

  if (!id) {
    return Promise.resolve(url)
  }

  let pending = resolved.get(id)

  if (!pending) {
    pending = getLibraryItem(id).then(({ item }) => {
      if (!item.path) {
        return url
      }

      const kind = fileCategoryOf(item)

      if (kind === 'image') {
        return resolveMediaDisplaySrc(item.path)
      }

      return kind === 'video' || kind === 'audio' ? resolveMediaPlaybackSrc(item.path) : mediaExternalUrl(item.path)
    })
    pending.catch(() => resolved.delete(id))
    resolved.set(id, pending)
  }

  return pending
}

/** Every sub-page a document links, nested blocks included. */
function subpagesOf(blocks: readonly PageDocument[] | undefined, into = new Set<string>()): Set<string> {
  for (const block of blocks ?? []) {
    if (block.type === 'page' && block.props?.pageId) {
      into.add(block.props.pageId)
    }

    subpagesOf(block.children, into)
  }

  return into
}

/** An HTML file linked alone on a line of a markdown page is an interactive block, as the agent writes
 *  it. The markdown parser drops `library://` links, so each such line is swapped for a marker the
 *  parser keeps, and `restoreBlocks` turns the marker back into the block (or into its plain title). */
const HTML_FILE = /\.html?$/i
const BLOCK_LINE = /^\[([^\]\n]*)\]\(library:\/\/([\w-]+)\)[ \t]*$/gm
const BLOCK_MARKER = /^hermes-block:([\w-]+)$/

export function markBlockLinks(markdown: string) {
  const titles = new Map<string, string>()

  const marked = markdown.replace(BLOCK_LINE, (_line, title: string, id: string) => {
    titles.set(id, title)

    return `hermes-block:${id}`
  })

  return { marked, titles }
}

async function restoreBlocks(editor: PageEditorInstance, titles: ReadonlyMap<string, string>, isLive: () => boolean) {
  for (const block of editor.document) {
    const text =
      block.type === 'paragraph' && Array.isArray(block.content) && block.content.length === 1
        ? block.content[0]?.type === 'text'
          ? block.content[0].text
          : ''
        : ''

    const id = BLOCK_MARKER.exec(text)?.[1]

    if (!id) {
      continue
    }

    const title = titles.get(id) ?? ''

    const item = await getLibraryItem(id).then(
      ({ item: found }) => found,
      () => null
    )

    if (!isLive()) {
      return
    }

    editor.replaceBlocks(
      [block.id],
      [
        item?.kind === 'file' && HTML_FILE.test(item.file_name ?? '')
          ? { props: { fileId: id, title }, type: 'interactive' }
          : { content: title, type: 'paragraph' }
      ]
    )
  }
}

export interface PageEditorChange {
  content: string
  markdown: string
}

interface PageEditorProps {
  content: null | string
  markdown: string
  onChange: (next: PageEditorChange) => void
  /** Open another Library page (a sub-page this one links). */
  onOpenPage: (id: string) => void
  pageId: string
}

/** The Notion-style block editor for one page. Mounted per page id (the caller keys it). */
export default function PageEditor({ content, markdown, onChange, onOpenPage, pageId }: PageEditorProps) {
  const { renderedMode } = useTheme()
  const { t } = useI18n()
  const copy = t.library
  // Only what the page opened with seeds the editor; later saves never reset it.
  const [initialContent] = useState(() => parseDocument(content))
  const [seedMarkdown] = useState(markdown)
  const importing = useRef(false)
  // The sub-pages the document links now, and those it unlinked (and so trashed) this session.
  const linked = useRef(subpagesOf(initialContent))
  const unlinked = useRef(new Set<string>())

  const editor = useCreateBlockNote(
    {
      initialContent,
      schema,
      resolveFileUrl: resolveLibraryUrl,
      uploadFile: async file => `library://${(await importLibraryFile(file, pageId)).id}`
    },
    [pageId]
  )

  // A page written as markdown (by Hermes, or from a template) becomes blocks on first open. That
  // conversion is not an edit: it must not bump "last edited" or mark the page dirty. `importing` is a
  // guard flag around one synchronous call, not a mirrored reactive value.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (initialContent || !seedMarkdown.trim()) {
      return
    }

    const { marked, titles } = markBlockLinks(seedMarkdown)

    importing.current = true

    try {
      editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(marked))
    } finally {
      importing.current = false
    }

    let live = true

    void restoreBlocks(editor, titles, () => live)

    return () => {
      live = false
    }
  }, [editor, initialContent, seedMarkdown])

  // An .html file dropped on the page asks what it is: a block to run, or text to bring in.
  const [dropped, setDropped] = useState<File | null>(null)

  useEffect(() => {
    const dom = editor.domElement

    if (!dom) {
      return
    }

    const onDrop = (event: DragEvent) => {
      const file = [...(event.dataTransfer?.files ?? [])].find(entry => /\.html?$/i.test(entry.name))

      if (file) {
        event.preventDefault()
        event.stopPropagation()
        setDropped(file)
      }
    }

    dom.addEventListener('drop', onDrop, true)

    return () => dom.removeEventListener('drop', onDrop, true)
  }, [editor])

  const bringIn = async (file: File, as: 'block' | 'text') => {
    setDropped(null)

    try {
      const after = editor.getTextCursorPosition().block

      if (as === 'block') {
        const item = await importLibraryFile(file, pageId)

        editor.insertBlocks(
          [{ props: { fileId: item.id, title: htmlTitle(await file.text()) }, type: 'interactive' }],
          after,
          'after'
        )
        bumpLibraryRevision()
      } else {
        editor.insertBlocks(editor.tryParseHTMLToBlocks(await file.text()), after, 'after')
      }
    } catch (error) {
      notifyError(error, copy.errors.save)
    }
  }

  // As in Notion: a sub-page is made on the line the menu was opened from, then opened.
  const createSubpage = () => {
    const placeholder = insertOrUpdateBlockForSlashMenu(editor, { props: { pageId: '' }, type: 'page' })

    createLibraryPage({ parent_id: pageId }).then(
      page => {
        editor.updateBlock(placeholder, { props: { pageId: page.id } })
        bumpLibraryRevision()
        onOpenPage(page.id)
      },
      error => {
        editor.removeBlocks([placeholder])
        notifyError(error, copy.errors.save)
      }
    )
  }

  // A sub-page follows its block: deleting the block trashes the page, undo brings both back.
  const syncSubpages = () => {
    const now = subpagesOf(editor.document)

    for (const id of linked.current) {
      if (!now.has(id)) {
        unlinked.current.add(id)
        trashLibraryItem(id).then(bumpLibraryRevision, error => notifyError(error, copy.errors.save))
      }
    }

    for (const id of now) {
      if (!linked.current.has(id) && unlinked.current.delete(id)) {
        trashLibraryItem(id, true).then(bumpLibraryRevision, error => notifyError(error, copy.errors.save))
      }
    }

    linked.current = now
  }

  return (
    <OpenPageContext value={onOpenPage}>
      <PageIdContext value={pageId}>
        <BlockNoteView
          className="library-editor"
          editor={editor}
          onChange={() => {
            if (!importing.current) {
              syncSubpages()
              onChange({
                content: JSON.stringify(editor.document),
                markdown: editor.blocksToMarkdownLossy(editor.document)
              })
            }
          }}
          slashMenu={false}
          theme={renderedMode}
        >
          <SuggestionMenuController
            getItems={async query => filterSuggestionItems(slashMenuItems(editor, copy.editor, createSubpage), query)}
            triggerCharacter="/"
          />
        </BlockNoteView>
        <Dialog onOpenChange={open => !open && setDropped(null)} open={dropped !== null}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{copy.editor.htmlDropTitle(dropped?.name ?? '')}</DialogTitle>
              <DialogDescription>{copy.editor.htmlDropBody}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row items-center gap-2 sm:justify-end">
              <Button onClick={() => setDropped(null)} size="sm" variant="ghost">
                {copy.editor.interactiveCancel}
              </Button>
              <Button onClick={() => dropped && void bringIn(dropped, 'text')} size="sm" variant="secondary">
                {copy.editor.htmlDropText}
              </Button>
              <Button onClick={() => dropped && void bringIn(dropped, 'block')} size="sm">
                {copy.editor.interactive}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageIdContext>
    </OpenPageContext>
  )
}

/** BlockNote's menu, Notion's way round: Page and To-do list lead the basic blocks. */
function slashMenuItems(
  editor: PageEditorInstance,
  copy: {
    interactive: string
    interactiveHint: string
    page: string
    pageHint: string
    todo: string
    todoHint: string
  },
  createSubpage: () => void
): DefaultReactSuggestionItem[] {
  const words = editor.dictionary.slash_menu
  const items = getDefaultReactSlashMenuItems(editor)
  const checkList = items.find(item => item.title === words.check_list.title)
  const rest = items.filter(item => item !== checkList)

  const lead: DefaultReactSuggestionItem[] = [
    {
      aliases: ['page', 'subpage', 'sub-page'],
      group: words.paragraph.group,
      icon: <Codicon name={ITEM_TYPE_ICON.page} size="1.125rem" />,
      onItemClick: createSubpage,
      subtext: copy.pageHint,
      title: copy.page
    },
    ...(checkList
      ? [
          {
            ...checkList,
            aliases: [...(checkList.aliases ?? []), 'todo', 'to-do', 'task'],
            subtext: copy.todoHint,
            title: copy.todo
          }
        ]
      : [])
  ]

  const at = rest.findIndex(item => item.group === words.paragraph.group)

  rest.splice(at < 0 ? rest.length : at, 0, ...lead)

  // Beside the other embeds: the Media group, where Notion keeps its own.
  const media = rest.findIndex(item => item.group === words.image.group)

  rest.splice(media < 0 ? rest.length : media, 0, {
    aliases: ['html', 'embed', 'app', 'widget', 'calculator', 'quiz'],
    group: words.image.group,
    icon: <Codicon name="code" size="1.125rem" />,
    onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { props: { fileId: '' }, type: 'interactive' }),
    subtext: copy.interactiveHint,
    title: copy.interactive
  })

  return rest
}
