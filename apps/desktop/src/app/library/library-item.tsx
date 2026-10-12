import { useStore } from '@nanostores/react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Loader } from '@/components/ui/loader'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { openExternalLink } from '@/lib/external-link'
import { relativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { downloadRemoteFile, revealFile } from '@/store/file-actions'
import { $librarySnapshot } from '@/store/library-snapshot'
import { notify, notifyError } from '@/store/notifications'

import { AccessMenu } from './access-menu'
import { openHermesBeside } from './chat-bridge'
import {
  $libraryRevision,
  bumpLibraryRevision,
  getLibraryItem,
  type LibraryItem,
  type LibraryPatch,
  listLibraryVersions,
  restoreLibraryVersion,
  trashLibraryItem,
  updateLibraryItem
} from './data'
import { changedSlides, isDeck } from './deck'
import { DeckEditor } from './deck-editor'
import { ExportSubmenu } from './export-menu'
import { LibraryFileView } from './file-view'
import { merge3 } from './merge3'
import { MoveDialog } from './move-dialog'
import { $organizeDialog } from './organize'
import { TagSubmenu } from './organize-ui'
import type { PageEditorChange } from './page-editor'
import { PageCoverBand, PageHeadLook } from './page-look'
import { rasterizeElement } from './rasterize'
import { clearLibraryView, setLibraryView } from './view-context'
import { type AgentEdit, AgentEditNote, HermesButton } from './with-hermes'

// The block editor (ProseMirror + menus) is its own chunk: the Library list never pays for it.
const PageEditor = lazy(() => import('./page-editor'))

const SAVE_DEBOUNCE_MS = 700

// Each open item as the server last had it: what an edit made here was made from, and so what to merge
// back from when Hermes changed it meanwhile.
const known = new Map<string, LibraryItem>()

type SaveState = 'error' | 'idle' | 'saved' | 'saving'

interface LibraryItemViewProps {
  itemId: string
  onBack: () => void
  /** Open a folder from the breadcrumb (`null` = the Library's root). */
  onNavigate: (folderId: null | string) => void
  /** Open another item: a parent page from the breadcrumb, a sub-page from its block. */
  onOpenItem: (id: string) => void
}

/** One opened item: a page in the block editor, or a saved file shown as itself, under the path to
 *  it. Edits save on their own a moment after typing stops, and again when the view closes. */
export function LibraryItemView({ itemId, onBack, onNavigate, onOpenItem }: LibraryItemViewProps) {
  const { t } = useI18n()
  const copy = t.library
  const [item, setItem] = useState<LibraryItem | null>(null)
  const [trail, setTrail] = useState<LibraryItem[]>([])
  const [moving, setMoving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [title, setTitle] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [editorRound, setEditorRound] = useState(0)
  // The last change Hermes made to this page while it was open, until reviewed, undone or dismissed.
  const [agentEdit, setAgentEdit] = useState<AgentEdit | null>(null)
  const pending = useRef<LibraryPatch>({})
  const titleField = useRef<HTMLInputElement | null>(null)
  const pageScroller = useRef<HTMLDivElement | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const remote = isDesktopFsRemoteMode()

  useEffect(() => {
    const sync = () =>
      setFullscreen(document.fullscreenElement !== null && document.fullscreenElement === pageScroller.current)

    document.addEventListener('fullscreenchange', sync)

    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  const timer = useRef<number | null>(null)

  useEffect(() => {
    let live = true

    setItem(null)
    setFailed(false)
    setAgentEdit(null)
    getLibraryItem(itemId).then(
      next => {
        if (live) {
          known.set(next.item.id, next.item)
          setItem(next.item)
          setTrail(next.trail ?? [])
          setTitle(next.item.title)
        }
      },
      () => live && setFailed(true)
    )

    return () => {
      live = false
    }
  }, [itemId])

  // A file opened in its own app may come back edited: on returning to the window, look again (the
  // backend takes the edit in and reprocesses it). Pages are edited here, so they stay as they are.
  const fileId = item?.kind === 'file' ? item.id : null
  const fileVersion = item?.updated_at

  useEffect(() => {
    if (!fileId) {
      return
    }

    const look = () =>
      getLibraryItem(fileId).then(
        next => next.item.updated_at !== fileVersion && setItem(next.item),
        () => undefined
      )

    window.addEventListener('focus', look)

    return () => window.removeEventListener('focus', look)
  }, [fileId, fileVersion])

  // Hermes may change an open page (adding a block): when it did, and nothing of the owner's is
  // waiting to be saved, the editor starts afresh from the page as it is now.
  const revision = useStore($libraryRevision)
  const pageId = item?.kind === 'page' ? item.id : null
  const pageVersion = item?.updated_at

  useEffect(() => {
    if (!pageId || pageVersion === undefined) {
      return
    }

    let live = true

    getLibraryItem(pageId).then(
      next => {
        if (live && next.item.updated_at > pageVersion && Object.keys(pending.current).length === 0) {
          const after = next.item.markdown ?? ''

          known.set(next.item.id, next.item)
          setItem(current => {
            if (current && (current.markdown ?? '') !== after) {
              setAgentEdit({ after, before: current.markdown ?? '' })
            }

            return next.item
          })
          setTitle(next.item.title)
          setEditorRound(n => n + 1)
        }
      },
      () => undefined
    )

    return () => {
      live = false
    }
  }, [pageId, pageVersion, revision])

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }

    let patch = pending.current

    if (Object.keys(patch).length === 0) {
      return
    }

    pending.current = {}
    setSaveState('saving')

    try {
      // A presentation is only its Markdown, so when Hermes changed it while the owner was typing, the
      // two edits are merged line by line instead of the later save wiping out the earlier one.
      const base = known.get(itemId)
      let merged: null | { before: string; conflicts: number; text: string } = null

      if (patch.markdown !== undefined && base && isDeck(base.markdown)) {
        const latest = (await getLibraryItem(itemId)).item

        if (latest.updated_at > base.updated_at && (latest.markdown ?? '') !== (base.markdown ?? '')) {
          const result = merge3(base.markdown ?? '', patch.markdown, latest.markdown ?? '')

          merged = { before: patch.markdown, conflicts: result.conflicts, text: result.text }
          patch = { ...patch, markdown: result.text }
        }
      }

      const saved = await updateLibraryItem(itemId, patch)

      known.set(itemId, { ...(known.get(itemId) ?? saved), ...saved })

      if (merged && merged.text !== merged.before) {
        // Show the merged deck, and what Hermes's part of it did.
        setAgentEdit({ after: merged.text, before: merged.before })
        setEditorRound(n => n + 1)

        if (merged.conflicts > 0) {
          notify({ durationMs: 4500, kind: 'info', message: copy.withHermes.keptYours })
        }
      }

      // Keep the editor's own document; only the metadata the header shows comes back.
      setItem(current => (current ? { ...current, ...saved, content: current.content } : saved))
      setSaveState('saved')
      bumpLibraryRevision()
    } catch (error) {
      setSaveState('error')
      notifyError(error, copy.errors.save)
    }
  }, [copy.errors.save, copy.withHermes.keptYours, itemId])

  const queue = useCallback(
    (patch: LibraryPatch) => {
      pending.current = { ...pending.current, ...patch }

      if (timer.current !== null) {
        window.clearTimeout(timer.current)
      }

      timer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS)
    },
    [flush]
  )

  // Icon and cover land at once: they are one click, not typing.
  const changeLook = useCallback(
    (patch: Pick<LibraryPatch, 'cover' | 'icon'>) => {
      setItem(current => (current ? { ...current, ...patch } : current))
      queue(patch)
      void flush()
    },
    [flush, queue]
  )

  // A fresh, untitled page starts with its name — also when it was opened from another page's
  // editor, which lets go of focus only as it unmounts (so after the field's own autofocus).
  const loadedId = item?.id
  const startsUntitled = item?.kind === 'page' && !item.title

  useEffect(() => {
    if (!loadedId || !startsUntitled) {
      return
    }

    const frame = requestAnimationFrame(() => titleField.current?.focus())

    return () => cancelAnimationFrame(frame)
  }, [loadedId, startsUntitled])

  // Hermes can ask what is open.
  useEffect(() => {
    setLibraryView({ itemId })

    return clearLibraryView
  }, [itemId])

  // A page is drawn from the app's own look; a presentation draws itself (see DeckEditor).
  const drawnAsPage = item?.kind === 'page' && !isDeck(item.markdown)

  useEffect(() => {
    if (!drawnAsPage) {
      return
    }

    $librarySnapshot.set({
      itemId,
      take: async () =>
        pageScroller.current
          ? rasterizeElement(pageScroller.current, {
              styled: true,
              without: '.bn-side-menu, .bn-formatting-toolbar, .bn-suggestion-menu, [data-block-tools]'
            })
          : null
    })

    return () => $librarySnapshot.set(null)
  }, [drawnAsPage, itemId])

  // Leaving the page (back, another item, closing the view) writes what is still pending.
  useEffect(() => () => void flush(), [flush])

  // One step back: Hermes's tool keeps the page exactly as it was before each edit (see
  // tools/library_tool.py), so the newest version is what the owner had.
  const undoAgentEdit = async () => {
    try {
      const [previous] = await listLibraryVersions(itemId)

      if (!previous) {
        return
      }

      const restored = await restoreLibraryVersion(itemId, previous.id)

      known.set(restored.id, restored)
      setItem(restored)
      setTitle(restored.title)
      setEditorRound(n => n + 1)
      setAgentEdit(null)
      bumpLibraryRevision()
      notify({ durationMs: 3000, kind: 'info', message: copy.withHermes.undone })
    } catch (error) {
      notifyError(error, copy.withHermes.undoFailed)
    }
  }

  const patchNow = async (patch: LibraryPatch) => {
    try {
      const saved = await updateLibraryItem(itemId, patch)

      known.set(itemId, { ...(known.get(itemId) ?? saved), ...saved })
      setItem(current => (current ? { ...current, ...saved, content: current.content } : saved))
      bumpLibraryRevision()
    } catch (error) {
      notifyError(error, copy.errors.save)
    }
  }

  // After a move only the path changes; the editor keeps what it holds.
  const reloadTrail = () =>
    getLibraryItem(itemId).then(
      next => {
        setTrail(next.trail ?? [])
        setItem(current => (current ? { ...current, parent_id: next.item.parent_id } : current))
      },
      () => undefined
    )

  const moveToTrash = async () => {
    try {
      await flush()
      await trashLibraryItem(itemId)
      bumpLibraryRevision()
      onBack()
    } catch (error) {
      notifyError(error, copy.errors.save)
    }
  }

  if (failed) {
    return (
      <div className="grid h-full place-items-center text-sm text-(--ui-text-tertiary)">
        <div className="flex flex-col items-center gap-3">
          {copy.errors.load}
          <Button onClick={onBack} size="sm" variant="secondary">
            {copy.actions.back}
          </Button>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="grid h-full place-items-center">
        <Loader />
      </div>
    )
  }

  const isPage = item.kind === 'page'
  const deck = isPage && isDeck(item.markdown)

  const toggleFullscreen = () =>
    void (fullscreen ? document.exitFullscreen() : pageScroller.current?.requestFullscreen())

  const status =
    saveState === 'saving'
      ? copy.saving
      : saveState === 'saved'
        ? copy.saved
        : copy.edited(relativeTime(item.updated_at * 1000))

  return (
    <div className="flex h-full min-h-0 flex-col" data-library-item={item.id}>
      <header className="flex shrink-0 items-center gap-2 px-4 py-2.5">
        <nav
          aria-label={copy.title}
          className="flex min-w-0 flex-1 items-center gap-0.5 text-xs text-(--ui-text-tertiary)"
        >
          {[null, ...trail].map(crumb => (
            <span className="flex min-w-0 shrink items-center gap-0.5" key={crumb?.id ?? 'root'}>
              <button
                className={cn(
                  'max-w-36 cursor-pointer truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-(--ui-row-hover-background) hover:text-(--ui-text-primary)',
                  !crumb && 'text-[0.8125rem] font-semibold text-(--ui-text-primary)'
                )}
                onClick={() => (crumb?.kind === 'page' ? onOpenItem(crumb.id) : onNavigate(crumb?.id ?? null))}
                type="button"
              >
                {crumb ? crumb.title || copy.untitled : copy.title}
              </button>
              <Codicon className="shrink-0 opacity-60" name="chevron-right" size="0.625rem" />
            </span>
          ))}
          <span className="min-w-0 truncate px-1.5 text-(--ui-text-secondary)">{title || copy.untitled}</span>
        </nav>
        <HermesButton
          item={item}
          onAllow={() => patchNow({ visibility: 'ask' })}
          onOpen={() => void flush().then(() => openHermesBeside(item))}
        />
        <AccessMenu onChange={visibility => void patchNow({ visibility })} size="button" visibility={item.visibility} />
        <Tip label={item.favorite ? copy.actions.unfavorite : copy.actions.favorite}>
          <Button
            aria-label={item.favorite ? copy.actions.unfavorite : copy.actions.favorite}
            aria-pressed={item.favorite}
            className={cn(item.favorite && 'text-[color-mix(in_srgb,var(--ui-yellow)_85%,var(--ui-text-primary))]')}
            onClick={() => void patchNow({ favorite: !item.favorite })}
            size="icon-sm"
            variant="ghost"
          >
            <Codicon name={item.favorite ? 'star-full' : 'star-empty'} size="0.9375rem" />
          </Button>
        </Tip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={copy.actions.more} size="icon-sm" variant="ghost">
              <Codicon name="kebab-vertical" size="0.9375rem" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuLabel
              className="flex items-center gap-2 py-1 text-[0.6875rem] font-normal text-(--ui-text-tertiary)"
              data-save-state={saveState}
            >
              <Codicon name="history" size="0.75rem" />
              {status}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isPage && (
              <DropdownMenuItem onSelect={toggleFullscreen}>
                <Codicon name={fullscreen ? 'screen-normal' : 'screen-full'} size="0.8125rem" />
                {fullscreen ? copy.preview.exitFullscreen : copy.preview.fullscreen}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setMoving(true)}>
              <Codicon name="arrow-swap" size="0.8125rem" />
              {copy.workspace.moveTo}
            </DropdownMenuItem>
            <TagSubmenu items={[item]} />
            <DropdownMenuItem
              onSelect={() =>
                void flush().then(() =>
                  $organizeDialog.set({
                    item,
                    kind: 'versions',
                    onRestored: restored => {
                      known.set(restored.id, restored)
                      setItem(restored)
                      setTitle(restored.title)
                      // The editor seeds from its first content only: a restore starts it afresh.
                      setEditorRound(n => n + 1)
                    }
                  })
                )
              }
            >
              <Codicon name="history" size="0.8125rem" />
              {copy.organize.versionHistory}
            </DropdownMenuItem>
            <ExportSubmenu before={flush} item={item} />
            {item.path && remote && (
              <DropdownMenuItem onSelect={() => void downloadRemoteFile(item.path!)}>
                <Codicon name="cloud-download" size="0.8125rem" />
                {copy.actions.download}
              </DropdownMenuItem>
            )}
            {item.path && !remote && (
              <>
                <DropdownMenuItem onSelect={() => openExternalLink(item.path!)}>
                  <Codicon name="link-external" size="0.8125rem" />
                  {copy.preview.openInApp}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void revealFile(item.path!)}>
                  <Codicon name="folder-opened" size="0.8125rem" />
                  {copy.actions.download}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void moveToTrash()} variant="destructive">
              <Codicon name="trash" size="0.8125rem" />
              {copy.actions.trash}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-(--ui-bg-editor)" ref={pageScroller}>
        {agentEdit && <AgentEditNote edit={agentEdit} onDismiss={() => setAgentEdit(null)} onUndo={undoAgentEdit} />}
        {isPage && <PageCoverBand item={item} onChange={changeLook} />}
        <article
          className={cn(
            'mx-auto flex w-full flex-col px-6 pt-8',
            deck ? 'max-w-5xl pb-24' : isPage ? 'max-w-3xl pb-24' : 'h-full max-w-6xl pb-6'
          )}
        >
          <div className="group/head flex flex-col">
            {isPage ? (
              <PageHeadLook item={item} onChange={changeLook} />
            ) : (
              item.icon && <div className="mb-2 text-5xl leading-none">{item.icon}</div>
            )}
            <input
              aria-label={copy.columns.name}
              className="library-title w-full border-0 bg-transparent p-0 text-[2rem] font-bold leading-tight tracking-tight text-(--ui-text-primary) outline-none placeholder:text-(--ui-text-quaternary)"
              onBlur={() => void flush()}
              onChange={event => {
                setTitle(event.target.value)
                queue({ title: event.target.value })
              }}
              placeholder={copy.untitled}
              ref={titleField}
              value={title}
            />
            <p className="mb-6 mt-2 flex items-center gap-2 text-xs text-(--ui-text-tertiary)">
              {copy.edited(relativeTime(item.updated_at * 1000))}
              {item.created_by === 'agent' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] px-2 py-0.5 text-(--ui-accent)">
                  <Codicon name="robot" size="0.6875rem" />
                  {copy.createdByHermes}
                </span>
              )}
            </p>
          </div>
          {deck ? (
            <DeckEditor
              beforeExport={flush}
              changed={agentEdit ? changedSlides(agentEdit.before, agentEdit.after) : []}
              itemId={item.id}
              key={`${item.id}:${editorRound}`}
              markdown={item.markdown ?? ''}
              onChange={markdown => queue({ markdown })}
              title={title || copy.untitled}
            />
          ) : isPage ? (
            <Suspense fallback={<Loader />}>
              <div className="-mx-12">
                <PageEditor
                  content={item.content ?? null}
                  key={`${item.id}:${editorRound}`}
                  markdown={item.markdown ?? ''}
                  onChange={(change: PageEditorChange) => queue(change)}
                  onOpenPage={onOpenItem}
                  pageId={item.id}
                />
              </div>
            </Suspense>
          ) : (
            <LibraryFileView
              item={item}
              onOpenFolder={onNavigate}
              onSaved={saved => setItem(current => (current ? { ...current, ...saved } : saved))}
            />
          )}
        </article>
      </div>
      <MoveDialog
        items={[item]}
        onClose={() => {
          setMoving(false)
          void reloadTrail()
        }}
        open={moving}
      />
    </div>
  )
}
