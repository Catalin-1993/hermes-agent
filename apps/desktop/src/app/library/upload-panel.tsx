import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { CheckboxMark } from '@/components/ui/checkbox'
import { Codicon } from '@/components/ui/codicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import { fileCategoryOf, ITEM_TYPE_ICON, ITEM_TYPE_TINT } from './file-types'
import {
  $libraryUploads,
  cancelLibraryUpload,
  dismissLibraryUploads,
  isUploadSettled,
  type LibraryUploadTask,
  resolveLibraryConflict,
  retryLibraryUpload
} from './upload-queue'

function TaskRow({ task }: { task: LibraryUploadTask }) {
  const { t } = useI18n()
  const up = t.library.workspace.uploads
  const type = task.kind === 'folder' ? 'folder' : fileCategoryOf({ file_name: task.name, mime: null })
  const active = task.status === 'uploading' || task.status === 'queued'

  const status =
    task.status === 'queued'
      ? up.waiting
      : task.status === 'uploading'
        ? task.progress > 0 && task.progress < 1
          ? `${Math.round(task.progress * 100)}%`
          : up.copying
        : task.status === 'done'
          ? task.kind === 'folder'
            ? up.files(task.imported ?? 0)
            : up.ready
          : task.status === 'skipped'
            ? up.skipped
            : task.status === 'cancelled'
              ? up.cancelled
              : task.status === 'failed'
                ? up.failed
                : ''

  return (
    <li className="group flex items-center gap-3 px-3 py-2">
      <span
        className="grid size-7 shrink-0 place-items-center rounded-lg"
        style={{
          background: `color-mix(in srgb, ${ITEM_TYPE_TINT[type]} 12%, transparent)`,
          color: ITEM_TYPE_TINT[type]
        }}
      >
        <Codicon name={ITEM_TYPE_ICON[type]} size="0.8125rem" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-xs font-medium text-(--ui-text-primary)" title={task.name}>
          {task.name}
        </span>
        {task.status === 'uploading' ? (
          <Progress indeterminate={task.progress <= 0 || task.progress >= 1} size="sm" value={task.progress} />
        ) : (
          <span
            className={cn(
              'truncate text-[0.6875rem]',
              task.status === 'failed' ? 'text-(--ui-red)' : 'text-(--ui-text-tertiary)'
            )}
            title={task.error}
          >
            {status}
          </span>
        )}
      </span>
      {task.status === 'done' && <Codicon className="text-(--ui-green)" name="pass-filled" size="0.875rem" />}
      {task.status === 'failed' && (
        <Tip label={up.retry}>
          <Button aria-label={up.retry} onClick={() => retryLibraryUpload(task.id)} size="icon-xs" variant="ghost">
            <Codicon name="refresh" size="0.75rem" />
          </Button>
        </Tip>
      )}
      {active && (
        <Tip label={up.cancel}>
          <Button
            aria-label={up.cancel}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => cancelLibraryUpload(task.id)}
            size="icon-xs"
            variant="ghost"
          >
            <Codicon name="close" size="0.75rem" />
          </Button>
        </Tip>
      )}
    </li>
  )
}

/** The one conflict on screen at a time: what collides, and the answers that make sense for it. */
function DuplicateDialog({ pending, task }: { pending: number; task: LibraryUploadTask }) {
  const { t } = useI18n()
  const copy = t.library
  const dup = copy.workspace.duplicate
  const [applyToRest, setApplyToRest] = useState(false)
  const conflict = task.conflict!
  const byName = conflict.type === 'name'
  const answer = (decision: 'keep' | 'replace' | 'skip') => resolveLibraryConflict(task.id, decision, applyToRest)

  return (
    <Dialog onOpenChange={next => !next && answer('skip')} open>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{byName ? dup.nameTitle : dup.contentTitle}</DialogTitle>
          <DialogDescription>
            {byName
              ? dup.nameBody(task.name, conflict.item.parent_title || copy.title)
              : dup.contentBody(task.name, conflict.item.title || copy.untitled)}
          </DialogDescription>
        </DialogHeader>
        {pending > 1 && (
          <button
            className="flex w-fit cursor-pointer items-center gap-2 text-xs text-(--ui-text-secondary)"
            onClick={() => setApplyToRest(value => !value)}
            type="button"
          >
            <CheckboxMark checked={applyToRest} />
            {dup.applyToAll(pending - 1)}
          </button>
        )}
        <DialogFooter>
          <Button onClick={() => answer('skip')} size="sm" variant="ghost">
            {dup.skip}
          </Button>
          <Button onClick={() => answer('keep')} size="sm" variant={byName ? 'secondary' : 'default'}>
            {dup.keepBoth}
          </Button>
          {byName && (
            <Button onClick={() => answer('replace')} size="sm">
              {dup.replace}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Uploads in flight and just finished, in a quiet card at the Library's corner. */
export function LibraryUploadPanel() {
  const { t } = useI18n()
  const up = t.library.workspace.uploads
  const tasks = useStore($libraryUploads)
  const [collapsed, setCollapsed] = useState(false)

  if (tasks.length === 0) {
    return null
  }

  const conflicts = tasks.filter(task => task.status === 'conflict')
  const moving = tasks.filter(task => !isUploadSettled(task.status)).length
  const done = tasks.filter(task => task.status === 'done').length

  return (
    <>
      <section
        aria-label={up.title}
        className="absolute bottom-5 right-5 z-20 w-80 overflow-hidden rounded-2xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) shadow-[0_0.75rem_2rem_-0.5rem_color-mix(in_srgb,#000_22%,transparent)]"
        data-slot="library-uploads"
      >
        <header className="flex items-center gap-2 border-b border-(--ui-stroke-quaternary) py-2 pl-3.5 pr-2">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-(--ui-text-primary)">
            {moving > 0 ? up.active(moving) : up.done(done)}
          </span>
          <Button
            aria-label={collapsed ? up.expand : up.collapse}
            onClick={() => setCollapsed(value => !value)}
            size="icon-xs"
            variant="ghost"
          >
            <Codicon name={collapsed ? 'chevron-up' : 'chevron-down'} size="0.75rem" />
          </Button>
          {moving === 0 && (
            <Button aria-label={up.dismiss} onClick={dismissLibraryUploads} size="icon-xs" variant="ghost">
              <Codicon name="close" size="0.75rem" />
            </Button>
          )}
        </header>
        {!collapsed && (
          <ul className="m-0 max-h-64 list-none overflow-y-auto p-0 py-1">
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </section>
      {conflicts[0] && <DuplicateDialog key={conflicts[0].id} pending={conflicts.length} task={conflicts[0]} />}
    </>
  )
}
