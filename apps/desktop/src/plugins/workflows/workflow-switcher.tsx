/**
 * "Workflows ▾" at the start of the top bar: a small list of every workflow (search, recent or by
 * name, last run of each), each with duplicate and delete, and New / Import at the bottom. It takes
 * the place of the column the page used to keep on the left, so the canvas gets the whole width.
 */

import {
  cn,
  Codicon,
  ConfirmDialog,
  host,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useQueryClient
} from '@hermes/plugin-sdk'
import { type KeyboardEvent, useMemo, useState } from 'react'

import { MenuItem } from './add-menu'
import { deleteWorkflow, duplicateWorkflow, keys, type WorkflowDetail, type WorkflowSummary } from './api'
import { COPY } from './copy'
import { ImportButton } from './import-button'
import { TRIGGER_ICON } from './kinds'
import { ago, DISPLAY, HINT, StatusMark } from './ui'

type Sort = 'name' | 'recent'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const SMALL_BTN =
  'inline-flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] text-[0.75rem] font-medium text-(--ui-text-secondary) transition-colors hover:bg-(--card-well) hover:text-(--ui-text-primary)'

const recency = (w: WorkflowSummary) => Math.max(w.updated_at ?? 0, w.last_run?.created_at ?? 0)

function Row({
  active,
  onDelete,
  onDuplicate,
  onOpen,
  workflow
}: {
  active: boolean
  onDelete: () => void
  onDuplicate: () => void
  onOpen: () => void
  workflow: WorkflowSummary
}) {
  const [menu, setMenu] = useState(false)

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-[9px] pr-1 transition-colors',
        active ? 'bg-(--card-well)' : 'hover:bg-(--card-well)'
      )}
    >
      <button
        aria-current={active || undefined}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-2 py-1.5 text-left"
        onClick={onOpen}
        type="button"
      >
        <Codicon
          className="shrink-0 text-(--ui-yellow)"
          name={TRIGGER_ICON[workflow.trigger] ?? 'zap'}
          size="0.8125rem"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[0.8125rem] text-(--ui-text-primary)">{workflow.name || COPY.untitled}</span>
          <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
            {COPY.list.steps(workflow.steps)} ·{' '}
            {workflow.last_run ? ago(workflow.last_run.created_at) : COPY.list.never}
          </span>
        </span>
        {workflow.last_run && <StatusMark size="0.75rem" status={workflow.last_run.status} />}
      </button>
      <Popover onOpenChange={setMenu} open={menu}>
        <PopoverTrigger asChild>
          <button
            aria-label={COPY.page.actions(workflow.name)}
            className={cn(
              'grid size-6 shrink-0 cursor-pointer place-items-center rounded-[7px] text-(--ui-text-tertiary) transition-opacity hover:bg-(--card-surface) hover:text-(--ui-text-primary) focus-visible:opacity-100',
              menu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
            type="button"
          >
            <Codicon name="ellipsis" size="0.8125rem" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1" side="right">
          <MenuItem
            icon={<Codicon name="copy" size="0.875rem" />}
            onClick={() => {
              setMenu(false)
              onDuplicate()
            }}
          >
            {COPY.toolbar.duplicate}
          </MenuItem>
          <MenuItem
            danger
            icon={<Codicon name="trash" size="0.875rem" />}
            onClick={() => {
              setMenu(false)
              onDelete()
            }}
          >
            {COPY.toolbar.delete}
          </MenuItem>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** The open workflow's name in the title, and how a double-click renames it. */
export interface SwitcherTitle {
  name: string
  onRename: (name: string) => void
}

function RenameField({ name, onDone }: { name: string; onDone: (name: null | string) => void }) {
  const [value, setValue] = useState(name)

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onDone(value.trim() || name)
    } else if (event.key === 'Escape') {
      onDone(null)
    }
  }

  return (
    <input
      aria-label={COPY.toolbar.rename}
      autoFocus
      className={cn(
        DISPLAY,
        'h-7 w-[min(22rem,32vw)] rounded-[8px] border border-(--card-stroke) bg-(--card-well) px-2 text-[1rem] text-(--ui-text-primary) outline-none'
      )}
      onBlur={() => onDone(value.trim() || name)}
      onChange={e => setValue(e.target.value)}
      onFocus={e => e.currentTarget.select()}
      onKeyDown={onKeyDown}
      value={value}
    />
  )
}

export function WorkflowSwitcher({
  currentId,
  onCreate,
  onDeleted,
  onOpen,
  title,
  workflows
}: {
  currentId: null | string
  onCreate: () => void
  /** A deleted workflow was the open one: the page opens another. */
  onDeleted: (id: string) => void
  onOpen: (detail: WorkflowDetail | WorkflowSummary) => void
  /** The open workflow: its name follows "Workflows /" in the title. */
  title?: null | SwitcherTitle
  workflows: readonly WorkflowSummary[]
}) {
  const [renaming, setRenaming] = useState(false)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [deleting, setDeleting] = useState<null | WorkflowSummary>(null)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = workflows.filter(w => w.name.toLowerCase().includes(q))

    return sort === 'name'
      ? [...list].sort((a, b) => a.name.localeCompare(b.name))
      : [...list].sort((a, b) => recency(b) - recency(a))
  }, [search, sort, workflows])

  const pick = (workflow: WorkflowDetail | WorkflowSummary) => {
    setOpen(false)
    setSearch('')
    onOpen(workflow)
  }

  const duplicate = async (workflow: WorkflowSummary) => {
    try {
      const copy = await duplicateWorkflow(workflow.id)
      await queryClient.invalidateQueries({ queryKey: keys.list })
      pick(copy)
    } catch (e) {
      host.notify({ kind: 'error', message: errorText(e) })
    }
  }

  return (
    <>
      <Popover onOpenChange={setOpen} open={open}>
        {renaming && title ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn(DISPLAY, 'shrink-0 pl-2 text-[1rem] text-(--ui-text-tertiary)')}>{COPY.page.title} /</span>
            <RenameField
              name={title.name}
              onDone={name => {
                setRenaming(false)

                if (name !== null && name !== title.name) {
                  title.onRename(name)
                }
              }}
            />
          </span>
        ) : (
          <PopoverTrigger asChild>
            <button
              aria-label={COPY.page.openList}
              className="group/title inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] border border-(--card-stroke) bg-[color-mix(in_srgb,var(--card-well)_55%,transparent)] pr-1 pl-2 text-(--ui-text-primary) transition-colors hover:bg-(--card-well) data-[state=open]:bg-(--card-well)"
              onDoubleClick={() => title && setRenaming(true)}
              title={title ? COPY.page.titleHint : COPY.page.openList}
              type="button"
            >
              <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="list-unordered" size="0.75rem" />
              <span
                className={cn(DISPLAY, 'shrink-0 text-[1rem] leading-none', title && 'wf-prefix text-(--ui-text-tertiary)')}
              >
                {COPY.page.title}
                {title && ' /'}
              </span>
              {title && (
                <span className={cn(DISPLAY, 'max-w-[min(18rem,30cqw)] min-w-12 truncate text-[1rem] leading-none')}>
                  {title.name || COPY.untitled}
                </span>
              )}
              {/* The list behind the title: a small boxed chevron, a little brighter on hover. */}
              <span className="grid size-5 shrink-0 place-items-center rounded-[6px] text-(--ui-text-tertiary) transition-colors group-hover/title:bg-(--card-surface) group-hover/title:text-(--ui-text-primary) group-data-[state=open]/title:bg-(--card-surface)">
                <Codicon name="chevron-down" size="0.6875rem" />
              </span>
            </button>
          </PopoverTrigger>
        )}
        <PopoverContent align="start" className="flex w-80 flex-col p-0" sideOffset={6}>
          <div className="flex items-center gap-1 border-b border-(--card-well-stroke) p-1.5">
            <label className="relative flex-1">
              <Codicon
                className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-(--ui-text-tertiary)"
                name="search"
                size="0.75rem"
              />
              <input
                autoFocus
                className="h-7 w-full rounded-[7px] bg-transparent pr-2 pl-7 text-[0.8125rem] text-(--ui-text-primary) outline-none placeholder:text-(--ui-text-tertiary)"
                onChange={e => setSearch(e.target.value)}
                placeholder={COPY.page.search}
                value={search}
              />
            </label>
            {(['recent', 'name'] as const).map(id => (
              <button
                aria-pressed={sort === id}
                className={cn(
                  'h-6 cursor-pointer rounded-[6px] px-2 text-[0.6875rem] font-medium transition-colors',
                  sort === id
                    ? 'bg-(--card-well) text-(--ui-text-primary)'
                    : 'text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
                )}
                key={id}
                onClick={() => setSort(id)}
                type="button"
              >
                {id === 'recent' ? COPY.page.sortRecent : COPY.page.sortName}
              </button>
            ))}
          </div>
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-1">
            {shown.map(workflow => (
              <Row
                active={workflow.id === currentId}
                key={workflow.id}
                onDelete={() => {
                  setOpen(false)
                  setDeleting(workflow)
                }}
                onDuplicate={() => void duplicate(workflow)}
                onOpen={() => pick(workflow)}
                workflow={workflow}
              />
            ))}
            {!shown.length && <p className={cn(HINT, 'px-2 py-3')}>{COPY.page.noMatch}</p>}
          </div>
          <div className="flex items-center gap-1 border-t border-(--card-well-stroke) p-1">
            <button
              className={SMALL_BTN}
              onClick={() => {
                setOpen(false)
                onCreate()
              }}
              type="button"
            >
              <Codicon name="add" size="0.75rem" />
              {COPY.newWorkflow}
            </button>
            <ImportButton className={SMALL_BTN} onImported={pick}>
              <Codicon name="cloud-upload" size="0.75rem" />
              {COPY.files.import}
            </ImportButton>
          </div>
        </PopoverContent>
      </Popover>
      <ConfirmDialog
        busyLabel={COPY.confirmDelete.busy}
        confirmLabel={COPY.confirmDelete.confirm}
        description={COPY.confirmDelete.description}
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) {
            return
          }

          await deleteWorkflow(deleting.id)
          queryClient.removeQueries({ queryKey: keys.workflow(deleting.id) })
          await queryClient.invalidateQueries({ queryKey: keys.list })
          onDeleted(deleting.id)
        }}
        open={deleting !== null}
        title={COPY.confirmDelete.title(deleting?.name ?? '')}
      />
    </>
  )
}
