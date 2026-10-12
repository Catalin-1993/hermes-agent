import { createReactBlockSpec } from '@blocknote/react'
import { useStore } from '@nanostores/react'
import { createContext, useContext, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { SandboxedFrame } from '@/components/ui/sandboxed-frame'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { networkAccess, parseApprovedHosts } from '@/lib/frame-policy'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'
import { useTheme } from '@/themes/context'

import {
  $libraryRevision,
  bumpLibraryRevision,
  formatBytes,
  getLibraryItem,
  importLibraryFile,
  readLibraryBlob,
  trashLibraryItem
} from './data'
import { editableDocument, readEdit } from './html-edit'
import {
  buildingDocument,
  buildPrompt,
  changePrompt,
  delegateBlock,
  isBuilding,
  looksLikeHtml,
  sendToHermes
} from './interactive-agent'
import {
  clampHeight,
  htmlFileName,
  htmlTitle,
  INTERACTIVE_DEFAULT_HEIGHT,
  INTERACTIVE_MAX_CHARS,
  interactiveSrc,
  parseState,
  readPalette,
  reportedHeight,
  reportedState,
  THEME_MESSAGE
} from './interactive-html'
import { INTERACTIVE_TEMPLATES } from './interactive-templates'
import { useEditSession } from './use-edit-session'

const FOOTER_LINK =
  'cursor-pointer underline decoration-(--ui-stroke-secondary) underline-offset-[0.2em] hover:text-(--ui-text-primary)'

/** The page being edited: an interactive block's document is stored beneath it. */
export const PageIdContext = createContext('')

interface BlockEditor {
  removeBlocks: (blocks: never[]) => unknown
  updateBlock: (block: never, update: { props: Record<string, unknown> }) => unknown
}

/** What the setup card hands over: HTML to run now, or a description for Hermes to build from. */
type Creation = { fileName?: string; html: string; kind: 'html' } | { description: string; kind: 'build' }

interface BlockProps {
  fileId: string
  height: number
  /** The hosts the owner approved this block to reach (JSON array text); '' = none. */
  network: string
  /** What the block asked to keep (`hermes.save`), as JSON text; '' = nothing. */
  state: string
  title: string
}

/** Nothing here yet: paste the HTML, or bring a file. */
function Setup({ onCreate }: { onCreate: (creation: Creation) => Promise<void> }) {
  const { t } = useI18n()
  const copy = t.library.editor
  const [html, setHtml] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const picker = useRef<HTMLInputElement>(null)

  const building = Boolean(html.trim()) && !looksLikeHtml(html)

  const create = async (creation: Creation) => {
    if (creation.kind === 'html' && creation.html.length > INTERACTIVE_MAX_CHARS) {
      setProblem(copy.interactiveTooLarge)

      return
    }

    setBusy(true)
    setProblem('')

    try {
      await onCreate(creation)
    } catch (error) {
      notifyError(error, t.library.errors.save)
      setBusy(false)
    }
  }

  return (
    <div
      className="library-interactive-setup flex w-full flex-col gap-2 rounded-xl border border-dashed border-(--ui-stroke-secondary) bg-(--ui-bg-quinary) p-3"
      contentEditable={false}
    >
      <div className="flex items-center gap-2 text-[0.8125rem] font-medium text-(--ui-text-secondary)">
        <Codicon name="code" size="0.9375rem" />
        {copy.interactive}
      </div>
      <textarea
        aria-label={copy.interactivePaste}
        className="min-h-16 w-full resize-y rounded-lg border border-transparent bg-transparent px-1 py-1 font-mono text-[0.75rem] leading-relaxed text-(--ui-text-primary) outline-none placeholder:text-(--ui-text-quaternary) focus:border-(--ui-stroke-secondary)"
        disabled={busy}
        onChange={event => setHtml(event.target.value)}
        placeholder={copy.interactivePaste}
        spellCheck={false}
        value={html}
      />
      <div className="flex items-center gap-2">
        <button
          className="cursor-pointer text-[0.75rem] text-(--ui-text-tertiary) underline decoration-(--ui-stroke-secondary) underline-offset-[0.2em] transition-colors hover:text-(--ui-text-primary) disabled:pointer-events-none disabled:opacity-50"
          disabled={busy}
          onClick={() => picker.current?.click()}
          type="button"
        >
          {copy.interactiveUpload}
        </button>
        {problem && <span className="text-[0.75rem] text-(--ui-red)">{problem}</span>}
        <Button
          className="ml-auto"
          disabled={busy || !html.trim()}
          onClick={() => void create(building ? { description: html, kind: 'build' } : { html, kind: 'html' })}
          size="sm"
        >
          {busy ? <Loader /> : building ? copy.interactiveBuild : copy.interactiveAdd}
        </Button>
      </div>
      <div className="mt-1 flex flex-col gap-1.5 border-t border-(--ui-stroke-tertiary) pt-2.5">
        <span className="text-[0.6875rem] font-medium tracking-wide text-(--ui-text-quaternary) uppercase">
          {copy.interactiveTemplates}
        </span>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-1.5">
          {INTERACTIVE_TEMPLATES.map(template => (
            <button
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) px-2.5 py-2 text-left text-[0.8125rem] text-(--ui-text-secondary) transition-colors hover:border-(--ui-stroke-secondary) hover:text-(--ui-text-primary) disabled:pointer-events-none disabled:opacity-50"
              disabled={busy}
              key={template.id}
              onClick={() => void create({ fileName: `${template.title}.html`, html: template.html, kind: 'html' })}
              type="button"
            >
              <Codicon className="text-(--ui-accent)" name={template.icon} size="0.9375rem" />
              {copy.interactiveTemplate[template.id]}
            </button>
          ))}
        </div>
      </div>
      <input
        accept=".html,.htm,text/html"
        aria-hidden="true"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]

          event.target.value = ''

          if (file) {
            void file.text().then(text => create({ fileName: file.name, html: text, kind: 'html' }))
          }
        }}
        ref={picker}
        tabIndex={-1}
        type="file"
      />
    </div>
  )
}

/** The block as it runs: the document in a sealed frame, full screen one click away. */
function Running({ block, editor }: { block: { id: string; props: BlockProps }; editor: BlockEditor }) {
  const { t } = useI18n()
  const copy = t.library.editor
  const { fileId, height: fixedHeight, network: approvedText, state: savedState } = block.props
  const { renderedMode, themeName } = useTheme()
  const [text, setText] = useState<null | string>(null)
  const [failed, setFailed] = useState(false)
  const [autoHeight, setAutoHeight] = useState(INTERACTIVE_DEFAULT_HEIGHT)
  const [dragHeight, setDragHeight] = useState<null | number>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const card = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const title = text === null ? '' : htmlTitle(text) || copy.interactive
  const waiting = text !== null && isBuilding(text)
  const [asking, setAsking] = useState(false)
  const [request, setRequest] = useState('')
  // The data as the frame last saved it: it seeds the frame on load, and is never fed back into a
  // running one (a save must not reload the page it came from).
  const kept = useRef(savedState)
  const keepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [src, setSrc] = useState('')
  // Editing the document as it is seen (html-edit.ts): its texts become writable where they stand.
  const [editing, setEditing] = useState(false)
  const [later, setLater] = useState(false)
  // What the document asks to reach, and what the owner has approved of it.
  const access = text === null ? { active: [], invalid: [], pending: [] } : networkAccess(text, approvedText)
  const reach = access.active.join(' ')
  const session = useEditSession(fileId, text ?? '')
  const { record: recordEdit } = session

  // The document, from the Library — and again whenever the Library changed and it did too (Hermes
  // wrote it).
  const revision = useStore($libraryRevision)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let live = true

    getLibraryItem(fileId)
      .then(({ item }) => {
        if (!live) {
          return undefined
        }

        if (item.trashed_at) {
          setFailed(true)

          return undefined
        }

        if (item.updated_at === version || editing) {
          return undefined
        }

        return readLibraryBlob(fileId)
          .then(blob => blob.text())
          .then(body => {
            if (live) {
              setText(body)
              setVersion(item.updated_at)
              setFailed(false)
            }
          })
      })
      .catch(() => live && setFailed(true))

    return () => {
      live = false
    }
  }, [editing, fileId, revision, version])

  // The block's title follows its document (Hermes, a restore): markdown and search name it by it.
  const docTitle = text === null || waiting ? null : htmlTitle(text)

  useEffect(() => {
    if (docTitle !== null && docTitle !== block.props.title) {
      editor.updateBlock(block as never, { props: { title: docTitle } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docTitle])

  // The frame's document: built when the text arrives, with the data and colours as they are then. A later save or theme change reaches the running frame by message.
  useEffect(() => {
    if (text !== null && !waiting) {
      setSrc(
        interactiveSrc(editing ? editableDocument(text) : text, {
          hosts: access.active,
          palette: readPalette(renderedMode),
          state: parseState(kept.current)
        })
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, waiting, reach, editing])

  // What the frame says; only its own frame is believed. Its data is kept in the block's props, so it
  // is saved with the page.
  // eslint-disable-next-line no-restricted-syntax -- `kept` records what the frame sent; it mirrors no state
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) {
        return
      }

      const edit = readEdit(event.data)

      if (edit) {
        recordEdit(edit)

        return
      }

      const height = reportedHeight(event.data)
      const state = reportedState(event.data)

      if (height !== null) {
        setAutoHeight(height)
      }

      if (state !== null) {
        kept.current = state
        clearTimeout(keepTimer.current)
        keepTimer.current = setTimeout(() => editor.updateBlock(block as never, { props: { state } }), 150)
      }
    }

    window.addEventListener('message', onMessage)

    return () => window.removeEventListener('message', onMessage)
  }, [block, editor, recordEdit])

  // The theme changed (or the frame just loaded): tell it the colours.
  const sendTheme = () =>
    frame.current?.contentWindow?.postMessage({ theme: readPalette(renderedMode), type: THEME_MESSAGE }, '*')

  useEffect(() => {
    const id = requestAnimationFrame(sendTheme)

    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderedMode, themeName])

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === card.current)

    document.addEventListener('fullscreenchange', sync)

    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const height = dragHeight ?? (fixedHeight > 0 ? fixedHeight : autoHeight)

  // Dragging the bottom edge fixes the height; a double click gives it back to the content.
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const startY = event.clientY
    const startHeight = height
    const target = event.currentTarget
    let last = startHeight

    target.setPointerCapture(event.pointerId)
    setDragHeight(startHeight)

    const move = (moved: PointerEvent) => {
      last = clampHeight(startHeight + moved.clientY - startY)
      setDragHeight(last)
    }

    const end = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', end)
      target.removeEventListener('pointercancel', end)
      setDragHeight(null)

      // A click on the edge without a drag leaves the height to the content.
      if (last !== startHeight) {
        editor.updateBlock(block as never, { props: { height: last } })
      }
    }

    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', end)
    target.addEventListener('pointercancel', end)
  }

  // The owner hands the block to Hermes: a fresh chat that asks for the change.
  const askHermes = async () => {
    const wanted = request.trim()

    if (!wanted) {
      return
    }

    try {
      await delegateBlock(fileId)
      sendToHermes(changePrompt(fileId, title, wanted))
      setAsking(false)
      setRequest('')
    } catch (error) {
      notifyError(error, t.library.errors.save)
    }
  }

  // Hermes was asked and never wrote it (the owner declined, or walked away): take the block back out.
  const cancelBuild = () => {
    editor.removeBlocks([block] as never[])
    trashLibraryItem(fileId).then(bumpLibraryRevision, error => notifyError(error, t.library.errors.save))
  }

  // The owner's yes (or revoke) to the hosts the document names; the block reloads under the new policy.
  const setNetwork = (hosts: readonly string[]) =>
    editor.updateBlock(block as never, { props: { network: hosts.length ? JSON.stringify(hosts) : '' } })

  const allowNetwork = () => setNetwork([...new Set([...parseApprovedHosts(approvedText), ...access.pending])])

  // Start the block over: what it saved is forgotten, and it reloads from its document.
  const resetData = () => {
    clearTimeout(keepTimer.current)
    kept.current = ''
    editor.updateBlock(block as never, { props: { state: '' } })
  }

  // Begin editing the texts of the page, or end it: what was typed is written, and the block shows the result.
  const toggleEditing = async () => {
    if (!editing) {
      session.reset()
      setEditing(true)

      return
    }

    await session.flush()
    setText(session.current())
    setEditing(false)
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void card.current?.requestFullscreen()
    }
  }

  return (
    <div
      className={cn(
        'library-interactive group/interactive relative w-full overflow-hidden rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor)',
        fullscreen && 'rounded-none border-0'
      )}
      contentEditable={false}
      data-fullscreen={fullscreen || undefined}
      ref={card}
    >
      <div className="library-interactive-body relative" style={fullscreen ? { height: '100%' } : { height }}>
        {failed ? (
          <div className="grid size-full place-items-center bg-(--ui-bg-quinary) text-[0.8125rem] text-(--ui-text-tertiary)">
            {copy.interactiveFailed}
          </div>
        ) : text === null ? (
          <div className="grid size-full place-items-center bg-(--ui-bg-quinary)">
            <Loader />
          </div>
        ) : waiting ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 bg-(--ui-bg-quinary) text-[0.8125rem] text-(--ui-text-secondary)">
            <Loader />
            {copy.interactiveBuilding}
            <button
              className="cursor-pointer text-[0.75rem] text-(--ui-text-tertiary) underline decoration-(--ui-stroke-secondary) underline-offset-[0.2em] hover:text-(--ui-text-primary)"
              onClick={cancelBuild}
              type="button"
            >
              {copy.interactiveCancel}
            </button>
          </div>
        ) : (
          <SandboxedFrame onLoad={sendTheme} ref={frame} src={src} title={title} />
        )}
      </div>

      {text !== null &&
        !waiting &&
        !fullscreen &&
        (savedState || access.active.length > 0 || access.invalid.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) px-4 py-1.5 text-[0.75rem] text-(--ui-text-tertiary)">
            {savedState && (
              <>
                {copy.interactiveData(formatBytes(savedState.length))}
                <button className={FOOTER_LINK} onClick={resetData} type="button">
                  {copy.interactiveResetData}
                </button>
              </>
            )}
            {access.active.length > 0 && (
              <>
                {copy.interactiveNetworkOn(access.active.join(', '))}
                <button className={FOOTER_LINK} onClick={() => setNetwork([])} type="button">
                  {copy.interactiveNetworkRevoke}
                </button>
              </>
            )}
            {access.invalid.length > 0 && <span>{copy.interactiveNetworkInvalid(access.invalid.join(', '))}</span>}
          </div>
        )}

      {text !== null && !waiting && (
        <div
          className="absolute top-2 right-2 flex gap-0.5 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated)/90 p-0.5 opacity-0 backdrop-blur-md transition-opacity group-hover/interactive:opacity-100 focus-within:opacity-100 data-[open=true]:opacity-100"
          data-open={editing ? 'true' : undefined}
        >
          {access.active.length > 0 && (
            <Tip label={copy.interactiveNetworkOn(access.active.join(', '))}>
              <span className="grid size-6 place-items-center text-(--ui-text-tertiary)">
                <Codicon name="globe" size="0.875rem" />
              </span>
            </Tip>
          )}
          <Tip label={copy.interactiveAsk}>
            <Button
              aria-label={copy.interactiveAsk}
              aria-pressed={asking}
              onClick={() => setAsking(!asking)}
              size="icon-xs"
              variant="ghost"
            >
              <Codicon name="sparkle" size="0.875rem" />
            </Button>
          </Tip>
          <Tip label={editing ? t.common.done : t.library.preview.edit}>
            <Button
              aria-label={editing ? t.common.done : t.library.preview.edit}
              aria-pressed={editing}
              onClick={() => void toggleEditing()}
              size="icon-xs"
              variant="ghost"
            >
              <Codicon name={editing ? 'check' : 'edit'} size="0.875rem" />
            </Button>
          </Tip>
          <Tip label={fullscreen ? copy.interactiveCollapse : copy.interactiveExpand}>
            <Button
              aria-label={fullscreen ? copy.interactiveCollapse : copy.interactiveExpand}
              onClick={toggleFullscreen}
              size="icon-xs"
              variant="ghost"
            >
              <Codicon name={fullscreen ? 'screen-normal' : 'screen-full'} size="0.875rem" />
            </Button>
          </Tip>
        </div>
      )}

      {access.pending.length > 0 && !later && !waiting && text !== null && (
        <div
          className="absolute top-2 right-14 left-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated)/95 py-1.5 pr-1.5 pl-3 text-[0.8125rem] text-(--ui-text-secondary) backdrop-blur-md"
          role="alert"
        >
          <Codicon className="text-(--ui-accent)" name="globe" size="0.9375rem" />
          <span className="min-w-0 flex-1">{copy.interactiveNetworkAsk(access.pending.join(', '))}</span>
          <span className="flex gap-1">
            <Button onClick={() => setLater(true)} size="sm" variant="ghost">
              {copy.interactiveNetworkLater}
            </Button>
            <Button onClick={allowNetwork} size="sm">
              {copy.interactiveNetworkAllow}
            </Button>
          </span>
        </div>
      )}

      {asking && !waiting && (
        <form
          className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated)/95 p-1.5 pl-3 backdrop-blur-md"
          onSubmit={event => {
            event.preventDefault()
            void askHermes()
          }}
        >
          <input
            aria-label={copy.interactiveAskPlaceholder}
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-(--ui-text-primary) outline-none placeholder:text-(--ui-text-quaternary)"
            onChange={event => setRequest(event.target.value)}
            onKeyDown={event => event.key === 'Escape' && setAsking(false)}
            placeholder={copy.interactiveAskPlaceholder}
            value={request}
          />
          <Button aria-label={copy.interactiveSend} disabled={!request.trim()} size="icon-xs" type="submit">
            <Codicon name="arrow-up" size="0.875rem" />
          </Button>
        </form>
      )}

      {!fullscreen && !waiting && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-row-resize touch-none items-end justify-center pb-0.5 opacity-0 transition-opacity group-hover/interactive:opacity-100"
          onDoubleClick={() => editor.updateBlock(block as never, { props: { height: 0 } })}
          onPointerDown={startResize}
        >
          <span className="h-0.75 w-8 rounded-full bg-(--ui-stroke-secondary)" />
        </div>
      )}
    </div>
  )
}

function InteractiveBlock({ block, editor }: { block: { id: string; props: BlockProps }; editor: BlockEditor }) {
  const pageId = useContext(PageIdContext)
  const { t } = useI18n()

  if (block.props.fileId) {
    return <Running block={block} editor={editor} />
  }

  return (
    <Setup
      onCreate={async creation => {
        const html = creation.kind === 'html' ? creation.html : buildingDocument()

        const file = new File(
          [html],
          creation.kind === 'html' && creation.fileName
            ? creation.fileName
            : htmlFileName(html, t.library.editor.interactive),
          { type: 'text/html' }
        )

        const item = await importLibraryFile(file, pageId || undefined)

        editor.updateBlock(block as never, {
          props: { fileId: item.id, title: creation.kind === 'html' ? htmlTitle(html) : '' }
        })
        bumpLibraryRevision()

        if (creation.kind === 'build') {
          await delegateBlock(item.id)
          sendToHermes(buildPrompt(item.id, creation.description))
        }
      }}
    />
  )
}

/** An interactive block, as in Notion's HTML block: a small web page — calculator, quiz, chart —
 *  running inside the page. Its document is a Library file beneath the page; the block holds its id,
 *  the height the user gave it (0 = fit the content) and its last-known title. */
export const interactiveBlockSpec = createReactBlockSpec(
  {
    content: 'none',
    propSchema: {
      fileId: { default: '' },
      height: { default: 0 },
      network: { default: '' },
      state: { default: '' },
      title: { default: '' }
    },
    type: 'interactive'
  },
  {
    render: ({ block, editor }) => <InteractiveBlock block={block as never} editor={editor as never} />,
    // Markdown and copy-out keep the link: the agent and search read it as one.
    toExternalHTML: ({ block }) =>
      block.props.fileId ? (
        <a href={`library://${block.props.fileId}`}>{block.props.title || 'Interactive block'}</a>
      ) : (
        <span />
      )
  }
)
