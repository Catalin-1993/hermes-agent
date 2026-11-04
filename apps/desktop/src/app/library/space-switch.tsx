import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { relativeTime } from '@/lib/time'

import {
  $librarySpace,
  bumpLibraryRevision,
  ensureNotebook,
  type LibraryItem,
  type LibrarySpace,
  notebookStatus,
  type NotebookStatus,
  runNotebook,
  setLibrarySpace
} from './data'

const SPACE_ICON: Record<LibrarySpace, string> = { agent: 'sparkle', user: 'library' }

/** Which library the window shows: the owner's own, or the notebook Brain writes itself. `title` is the
 *  Library's heading made switchable; `icon` is the small button beside an open page's breadcrumb. */
export function SpaceSwitch({ variant }: { variant: 'icon' | 'title' }) {
  const copy = useI18n().t.library.space
  const space = useStore($librarySpace)
  const names: Record<LibrarySpace, string> = { agent: copy.brain, user: copy.mine }

  const menu = (
    <DropdownMenuContent align="start" className="min-w-44">
      {(['user', 'agent'] as const).map(id => (
        <DropdownMenuItem key={id} onSelect={() => setLibrarySpace(id)}>
          <Codicon name={SPACE_ICON[id]} size="0.875rem" />
          <span className="flex-1">{names[id]}</span>
          {space === id && <Codicon className="text-(--ui-accent)" name="check" size="0.8125rem" />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  )

  if (variant === 'title') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={copy.switch}
            className="-ml-1.5 flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-0.5 text-inherit transition-colors hover:bg-(--ui-row-hover-background)"
            data-library-space={space}
            type="button"
          >
            {names[space]}
            <Codicon className="mt-1 text-(--ui-text-tertiary)" name="chevron-down" size="0.875rem" />
          </button>
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <Tip label={copy.switch}>
        <DropdownMenuTrigger asChild>
          <Button aria-label={copy.switch} data-library-space={space} size="icon-sm" variant="ghost">
            <Codicon name={SPACE_ICON[space]} size="0.9375rem" />
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      {menu}
    </DropdownMenu>
  )
}

/** On a page Brain wrote: who wrote it, and that the owner's edits stay. */
export function NotebookBadge({ item }: { item: LibraryItem }) {
  const copy = useI18n().t.library.notebook

  if (item.space !== 'agent') {
    return null
  }

  return (
    <Tip label={copy.editHint}>
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ui-accent)_9%,transparent)] px-2.5 py-0.5 text-[0.6875rem] font-medium text-(--ui-accent)">
        <Codicon name="sparkle" size="0.6875rem" />
        {copy.writtenBy}
      </span>
    </Tip>
  )
}

/** The line under the heading in Brain's notebook: what it is, when Brain last wrote, and the two ways to
 *  ask for an update now. Brain writes by itself; these are only for when the owner does not want to wait. */
export function NotebookBar() {
  const copy = useI18n().t.library.notebook
  const space = useStore($librarySpace)
  const [status, setStatus] = useState<NotebookStatus | null>(null)
  const running = Boolean(status?.running)

  // Opening the notebook makes its fixed pages if they are missing and brings "About you" up to date.
  useEffect(() => {
    if (space !== 'agent') {
      return
    }

    let live = true

    void ensureNotebook().then(
      next => {
        if (live) {
          setStatus(next)
          bumpLibraryRevision()
        }
      },
      () => undefined
    )

    return () => {
      live = false
    }
  }, [space])

  // While Brain is writing, look again every few seconds; when it is done the page list is read afresh.
  useEffect(() => {
    if (space !== 'agent' || !running) {
      return
    }

    const timer = window.setInterval(() => {
      void notebookStatus().then(
        next => {
          setStatus(next)

          if (!next.running) {
            bumpLibraryRevision()
          }
        },
        () => undefined
      )
    }, 4000)

    return () => window.clearInterval(timer)
  }, [running, space])

  if (space !== 'agent') {
    return null
  }

  const run = (days?: number) => {
    setStatus(current => (current ? { ...current, running: true } : current))
    void runNotebook(days).then(
      () => notebookStatus().then(setStatus, () => undefined),
      () => undefined
    )
  }

  const last = status?.last_run ? copy.lastRun(relativeTime(status.last_run * 1000)) : copy.never

  return (
    <div
      className="mt-1 mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-(--ui-text-tertiary)"
      data-slot="notebook-bar"
    >
      <span>{copy.intro}</span>
      <span aria-live="polite" className="text-(--ui-text-quaternary)">
        {running ? copy.running : status && !status.enabled ? copy.off : last}
      </span>
      <span className="ml-auto flex items-center gap-1">
        <Button disabled={running} onClick={() => run()} size="sm" variant="ghost">
          <Codicon name="refresh" size="0.75rem" />
          {copy.updateNow}
        </Button>
        <Button disabled={running} onClick={() => run(30)} size="sm" variant="ghost">
          {copy.catchUp}
        </Button>
      </span>
    </div>
  )
}
