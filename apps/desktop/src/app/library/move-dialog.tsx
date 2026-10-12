import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import { bumpLibraryRevision, createLibraryFolder, type LibraryItem, listLibrary, moveLibraryItems } from './data'

const ROOT = ''

interface MoveDialogProps {
  /** What is moving; folders among them are not offered as destinations (nor what is inside). */
  items: readonly LibraryItem[]
  onClose: () => void
  open: boolean
}

/** "Move to…": the folder tree, expanded on demand, with a folder made in place. */
export function MoveDialog({ items, onClose, open }: MoveDialogProps) {
  const { t } = useI18n()
  const copy = t.library
  const ws = copy.workspace
  const moving = new Set(items.map(item => item.id))
  const [children, setChildren] = useState<Record<string, LibraryItem[]>>({})
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set([ROOT]))
  const [target, setTarget] = useState<string>(ROOT)
  const [naming, setNaming] = useState<null | string>(null)
  const [busy, setBusy] = useState(false)
  // Enter submits and the unmounting input may still blur: the name is committed once.
  const committing = useRef(false)
  const names: Record<string, string> = { [ROOT]: copy.title }

  for (const list of Object.values(children)) {
    for (const folder of list) {
      names[folder.id] = folder.title || ws.untitledFolder
    }
  }

  const load = (parent: string) =>
    listLibrary({ kind: 'folder', parentId: parent, sort: 'name' }).then(
      ({ items: folders }) => setChildren(current => ({ ...current, [parent]: folders })),
      error => notifyError(error, copy.errors.load)
    )

  useEffect(() => {
    if (open) {
      setChildren({})
      setExpanded(new Set([ROOT]))
      setTarget(ROOT)
      setNaming(null)
      void load(ROOT)
    }
    // `load` only closes over setters and copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggle = (id: string) => {
    const next = new Set(expanded)

    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)

      if (!children[id]) {
        void load(id)
      }
    }

    setExpanded(next)
  }

  const createHere = async (title: string) => {
    if (committing.current) {
      return
    }

    committing.current = true
    setNaming(null)

    try {
      const folder = await createLibraryFolder(title.trim() || ws.untitledFolder, target || null)

      await load(target)
      setExpanded(new Set([...expanded, target]))
      setTarget(folder.id)
      bumpLibraryRevision()
    } catch (error) {
      notifyError(error, ws.errors.folder)
    } finally {
      committing.current = false
    }
  }

  const move = async () => {
    setBusy(true)

    try {
      await moveLibraryItems(
        items.map(item => item.id),
        target || null
      )
      bumpLibraryRevision()
      notify({ kind: 'success', message: ws.move.moved(names[target] ?? copy.title) })
      onClose()
    } catch (error) {
      notifyError(error, ws.errors.move)
    } finally {
      setBusy(false)
    }
  }

  const alreadyThere = items.every(item => (item.parent_id ?? ROOT) === target)

  const row = (id: string, label: string, depth: number, hasChildren: boolean) => {
    const disabled = moving.has(id)
    const isOpen = expanded.has(id)

    return (
      <div key={id || 'root'}>
        <div
          aria-disabled={disabled}
          aria-selected={target === id}
          className={cn(
            'group flex h-8 cursor-pointer items-center gap-1.5 rounded-lg pr-2 text-[0.8125rem] text-(--ui-text-secondary) transition-colors hover:bg-(--ui-row-hover-background)',
            target === id && 'bg-(--ui-row-active-background) text-(--ui-text-primary)',
            disabled && 'pointer-events-none opacity-40'
          )}
          onClick={() => setTarget(id)}
          onDoubleClick={() => hasChildren && toggle(id)}
          role="treeitem"
          style={{ paddingLeft: `${0.375 + depth * 1.125}rem` }}
        >
          <button
            aria-label={isOpen ? ws.uploads.collapse : ws.uploads.expand}
            className={cn(
              'grid size-5 place-items-center rounded text-(--ui-text-tertiary) hover:text-(--ui-text-primary)',
              !hasChildren && 'invisible'
            )}
            onClick={event => {
              event.stopPropagation()
              toggle(id)
            }}
            type="button"
          >
            <Codicon
              className={cn('transition-transform', isOpen && 'rotate-90')}
              name="chevron-right"
              size="0.75rem"
            />
          </button>
          <Codicon
            className={id === ROOT ? 'text-(--ui-text-secondary)' : 'text-[#3b82f6]'}
            name={id === ROOT ? 'library' : isOpen ? 'folder-opened' : 'folder'}
            size="0.9375rem"
          />
          <span className="min-w-0 truncate">{label}</span>
        </div>
        {isOpen && !disabled && (
          <div role="group">
            {children[id] === undefined ? (
              <div className="py-1.5" style={{ paddingLeft: `${1.875 + depth * 1.125}rem` }}>
                <Loader />
              </div>
            ) : (
              children[id].map(folder =>
                row(folder.id, folder.title || ws.untitledFolder, depth + 1, (folder.child_count ?? 0) > 0)
              )
            )}
            {naming === id && (
              <form
                className="flex h-8 items-center gap-1.5 pr-2"
                onSubmit={event => {
                  event.preventDefault()
                  void createHere(String(new FormData(event.currentTarget).get('name') ?? ''))
                }}
                style={{ paddingLeft: `${1.875 + depth * 1.125}rem` }}
              >
                <Codicon className="text-[#3b82f6]" name="folder" size="0.9375rem" />
                <input
                  autoFocus
                  className="h-7 min-w-0 flex-1 rounded-md border border-(--ui-stroke-secondary) bg-(--ui-bg-editor) px-2 text-[0.8125rem] outline-none focus:border-(--ui-accent)"
                  defaultValue={ws.untitledFolder}
                  name="name"
                  onBlur={event => void createHere(event.currentTarget.value)}
                  onFocus={event => event.currentTarget.select()}
                  onKeyDown={event => event.key === 'Escape' && (event.stopPropagation(), setNaming(null))}
                />
              </form>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog onOpenChange={next => !next && onClose()} open={open}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="px-5 pb-3 pt-5">
          <DialogTitle>{ws.move.title(items.length)}</DialogTitle>
        </DialogHeader>
        <div className="mx-3 h-72 overflow-y-auto rounded-xl border border-(--ui-stroke-tertiary) p-1.5" role="tree">
          {row(ROOT, copy.title, 0, true)}
        </div>
        <DialogFooter className="flex-row items-center px-5 pb-5 pt-4 sm:justify-between">
          <Button
            onClick={() => {
              setExpanded(new Set([...expanded, target]))
              setNaming(target)
            }}
            size="sm"
            variant="ghost"
          >
            <Codicon name="new-folder" size="0.8125rem" />
            {ws.newFolder}
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={onClose} size="sm" variant="secondary">
              {t.common.cancel}
            </Button>
            <Button disabled={busy || alreadyThere} onClick={() => void move()} size="sm">
              {ws.move.here}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
