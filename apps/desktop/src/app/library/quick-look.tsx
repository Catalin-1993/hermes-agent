import { useEffect, useState } from 'react'

import { MarkdownPreview } from '@/app/chat/right-rail/preview-file'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'

import { getLibraryItem, type LibraryItem } from './data'
import { ITEM_TYPE_ICON, ITEM_TYPE_TINT, itemTypeOf } from './file-types'
import { LibraryFileView } from './file-view'
import { ItemFacts } from './inspector'
import type { LibraryRun } from './library-views'

const EDITABLE = 'input, textarea, [contenteditable="true"]'

/** A page's text, read-only. */
function PagePeek({ id }: { id: string }) {
  const [markdown, setMarkdown] = useState<null | string>(null)

  useEffect(() => {
    let live = true

    getLibraryItem(id).then(
      ({ item }) => live && setMarkdown(item.markdown ?? ''),
      () => live && setMarkdown('')
    )

    return () => {
      live = false
    }
  }, [id])

  return markdown === null ? (
    <div className="grid h-full place-items-center">
      <Loader />
    </div>
  ) : (
    <div className="h-full overflow-y-auto rounded-2xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) px-8 py-6">
      <MarkdownPreview text={markdown} />
    </div>
  )
}

function FolderPeek({ item }: { item: LibraryItem }) {
  const { t } = useI18n()

  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <Codicon name="folder" size="3.5rem" style={{ color: ITEM_TYPE_TINT.folder }} />
        <p className="m-0 text-sm text-(--ui-text-tertiary)">{t.library.workspace.items(item.child_count ?? 0)}</p>
      </div>
    </div>
  )
}

/**
 * Space on a selection: the item, large, over the listing — a file in its own viewer, a page as its
 * text, a folder as what it holds. ← / → page through the listing in its order; Space or Esc close.
 */
export function QuickLook({
  folderTitle,
  id,
  info,
  items,
  onClose,
  onInfoChange,
  onNavigate,
  onOpen,
  onRun,
  restoreFocus
}: {
  /** Where the listing is, for an item that does not say itself (the facts' "Location"). */
  folderTitle: string
  id: null | string
  /** The details column — kind, size, dates, who made it, tags, access — beside the preview. */
  info: boolean
  items: readonly LibraryItem[]
  onClose: () => void
  onInfoChange: (info: boolean) => void
  onRun: LibraryRun
  onNavigate: (id: string) => void
  onOpen: (item: LibraryItem) => void
  /** Where keys should land once the overlay is gone (Radix would drop them on the page body). */
  restoreFocus: () => void
}) {
  const { t } = useI18n()
  const index = items.findIndex(item => item.id === id)
  const item = index >= 0 ? items[index] : null
  const pageable = items.length > 1

  const step = (delta: number) => {
    if (pageable && index >= 0) {
      onNavigate(items[(index + delta + items.length) % items.length].id)
    }
  }

  const pager = (delta: -1 | 1) => (
    <Button
      aria-label={delta < 0 ? t.ui.pagination.previous : t.ui.pagination.next}
      className={
        delta < 0 ? 'absolute -left-14 top-1/2 -translate-y-1/2' : 'absolute -right-14 top-1/2 -translate-y-1/2'
      }
      onClick={() => step(delta)}
      size="icon-lg"
      variant="ghost"
    >
      <Codicon name={delta < 0 ? 'chevron-left' : 'chevron-right'} />
    </Button>
  )

  const type = item ? itemTypeOf(item) : 'file'

  return (
    <Dialog onOpenChange={open => !open && onClose()} open={Boolean(item)}>
      <DialogContent
        aria-describedby={undefined}
        bodyClassName="gap-3 p-4"
        chrome={
          pageable && (
            <>
              {pager(-1)}
              {pager(1)}
            </>
          )
        }
        className={info ? 'max-w-6xl' : 'max-w-5xl'}
        onCloseAutoFocus={event => {
          event.preventDefault()
          restoreFocus()
        }}
        onKeyDown={event => {
          if ((event.target as HTMLElement).closest(EDITABLE)) {
            return
          }

          if (event.key === ' ') {
            event.preventDefault()
            onClose()
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            step(event.key === 'ArrowLeft' ? -1 : 1)
          }
        }}
      >
        {item && (
          <>
            <div className="flex items-center gap-2 pr-8">
              {item.icon ? (
                <span className="text-base leading-none">{item.icon}</span>
              ) : (
                <Codicon name={ITEM_TYPE_ICON[type]} size="0.9375rem" style={{ color: ITEM_TYPE_TINT[type] }} />
              )}
              <DialogTitle className="min-w-0 truncate text-sm font-medium">
                {item.title || t.library.untitled}
              </DialogTitle>
              {pageable && (
                <span className="shrink-0 text-xs tabular-nums text-(--ui-text-tertiary)">
                  {t.library.explorer.position(index + 1, items.length)}
                </span>
              )}
              <Button
                aria-label={t.library.explorer.details}
                aria-pressed={info}
                className="ml-auto"
                onClick={() => onInfoChange(!info)}
                size="xs"
                variant={info ? 'secondary' : 'ghost'}
              >
                <Codicon name="info" size="0.75rem" />
                {t.library.explorer.details}
              </Button>
              <Button onClick={() => onOpen(item)} size="xs" variant="secondary">
                {t.library.workspace.open}
              </Button>
            </div>
            <div className="flex h-[min(72vh,48rem)] min-h-0 gap-4">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col" key={item.id}>
                {item.kind === 'file' ? (
                  <LibraryFileView item={item} />
                ) : item.kind === 'page' ? (
                  <PagePeek id={item.id} />
                ) : (
                  <FolderPeek item={item} />
                )}
              </div>
              {info && (
                <aside
                  aria-label={t.library.explorer.details}
                  className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-(--ui-stroke-quaternary) pl-4"
                >
                  <ItemFacts item={item} location={item.parent_title || folderTitle} onRun={onRun} />
                </aside>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
