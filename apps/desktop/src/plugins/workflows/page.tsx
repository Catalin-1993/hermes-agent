/**
 * The Workflows page: the owner's workflows in a column on the left (search, new, last run of each),
 * the open one on the right. With none yet, the page explains what a workflow is and makes the first.
 */

import './workflows.css'

import { cn, Codicon, host, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { type ReactNode, useMemo, useRef, useState } from 'react'

import {
  createWorkflow,
  fetchWorkflow,
  fetchWorkflows,
  importWorkflow,
  keys,
  type WorkflowDetail,
  type WorkflowSummary
} from './api'
import { COPY } from './copy'
import { EditorView } from './editor-view'
import { TRIGGER_ICON } from './kinds'
import { ago, BTN, BTN_GHOST, BTN_PRIMARY, DISPLAY, FIELD, HINT, KindTile, StatusMark } from './ui'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

function WorkflowRow({ active, onOpen, workflow }: { active: boolean; onOpen: () => void; workflow: WorkflowSummary }) {
  return (
    <button
      aria-current={active || undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition-colors',
        active ? 'bg-(--card-well) shadow-[inset_0_0_0_1px_var(--card-stroke)]' : 'hover:bg-(--card-well)'
      )}
      onClick={onOpen}
      type="button"
    >
      <KindTile icon={TRIGGER_ICON[workflow.trigger] ?? 'zap'} size="sm" tone="var(--ui-yellow)" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">{workflow.name}</span>
        <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
          {COPY.triggers[workflow.trigger]} · {COPY.list.steps(workflow.steps)} ·{' '}
          {workflow.last_run ? ago(workflow.last_run.created_at) : COPY.list.never}
        </span>
      </span>
      {workflow.last_run && <StatusMark size="0.8125rem" status={workflow.last_run.status} />}
    </button>
  )
}

/** A file picker for an exported workflow; `children` is what the owner clicks. */
function ImportButton({
  children,
  className,
  onImported
}: {
  children: ReactNode
  className: string
  onImported: (detail: WorkflowDetail) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const read = async (file: File) => {
    let data: unknown

    try {
      data = JSON.parse(await file.text())
    } catch {
      host.notify({ kind: 'error', message: COPY.files.importFailed })

      return
    }

    try {
      const detail = await importWorkflow(data)
      await queryClient.invalidateQueries({ queryKey: keys.list })
      host.notify({ kind: 'success', message: COPY.files.imported(detail.name) })
      onImported(detail)
    } catch (e) {
      host.notify({ kind: 'error', message: errorText(e) })
    }
  }

  return (
    <>
      <button
        aria-label={COPY.files.importHint}
        className={className}
        onClick={() => input.current?.click()}
        title={COPY.files.importHint}
        type="button"
      >
        {children}
      </button>
      <input
        accept=".json,application/json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''

          if (file) {
            void read(file)
          }
        }}
        ref={input}
        type="file"
      />
    </>
  )
}

function Intro({ onCreate, onImported }: { onCreate: () => void; onImported: (detail: WorkflowDetail) => void }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-lg flex-col items-center gap-5 text-center">
        <div className="relative flex items-center gap-2">
          <KindTile icon="zap" size="lg" tone="var(--ui-yellow)" />
          <span className="h-px w-8 bg-(--card-stroke)" />
          <KindTile icon="hubot" size="lg" tone="var(--ui-blue)" />
          <span className="h-px w-8 bg-(--card-stroke)" />
          <KindTile icon="repo-forked" size="lg" tone="var(--ui-purple)" />
          <span className="h-px w-8 bg-(--card-stroke)" />
          <KindTile icon="send" size="lg" tone="var(--ui-green)" />
        </div>
        <h1 className={cn(DISPLAY, 'm-0 text-[2.125rem] leading-[1.05] text-(--ui-text-primary)')}>
          {COPY.page.empty}
        </h1>
        <p className="m-0 text-[0.875rem] leading-relaxed text-(--ui-text-secondary)">{COPY.page.emptyHint}</p>
        <div className="flex items-center gap-2">
          <button className={cn(BTN_PRIMARY, 'h-9 px-4')} onClick={onCreate} type="button">
            <Codicon name="add" size="0.875rem" />
            {COPY.page.create}
          </button>
          <ImportButton className={cn(BTN, 'h-9 px-4')} onImported={onImported}>
            <Codicon name="cloud-upload" size="0.875rem" />
            {COPY.files.import}
          </ImportButton>
        </div>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-left">
          {COPY.page.when.map(line => (
            <li className="flex gap-2 text-[0.75rem] leading-relaxed text-(--ui-text-tertiary)" key={line}>
              <Codicon className="mt-0.5 shrink-0" name="lightbulb" size="0.75rem" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function OpenWorkflow({
  id,
  onDeleted,
  onOpen
}: {
  id: string
  onDeleted: () => void
  onOpen: (detail: WorkflowDetail) => void
}) {
  const { data, error } = useQuery({
    queryFn: () => fetchWorkflow(id),
    queryKey: keys.workflow(id),
    staleTime: Infinity
  })

  // A restored version comes back as a new document: the editor starts again from it.
  const [generation, setGeneration] = useState(0)

  if (error) {
    return <p className="m-auto text-[0.8125rem] text-(--ui-red)">{errorText(error)}</p>
  }

  if (!data) {
    return <div className="flex-1" />
  }

  return (
    <EditorView
      detail={data}
      key={`${id}:${generation}`}
      onDeleted={onDeleted}
      onOpen={detail => {
        if (detail.id === id) {
          setGeneration(g => g + 1)
        }

        onOpen(detail)
      }}
    />
  )
}

export function WorkflowsPage() {
  const queryClient = useQueryClient()

  const {
    data: workflows,
    error,
    isLoading
  } = useQuery({ queryFn: fetchWorkflows, queryKey: keys.list, refetchInterval: 30_000 })

  const [openId, setOpenId] = useState<null | string>(null)
  const [search, setSearch] = useState('')

  const shown = useMemo(
    () => (workflows ?? []).filter(w => w.name.toLowerCase().includes(search.trim().toLowerCase())),
    [search, workflows]
  )

  const current = openId && workflows?.some(w => w.id === openId) ? openId : (workflows?.[0]?.id ?? null)

  const open = (detail: WorkflowDetail) => {
    queryClient.setQueryData(keys.workflow(detail.id), detail)
    setOpenId(detail.id)
  }

  const create = async () => {
    try {
      const detail = await createWorkflow(COPY.newWorkflow)
      await queryClient.invalidateQueries({ queryKey: keys.list })
      open(detail)
    } catch (e) {
      host.notify({ kind: 'error', message: errorText(e) })
    }
  }

  if (!isLoading && !error && !workflows?.length) {
    return (
      <div className="h-full bg-(--ui-surface-background)" data-workflows="">
        <Intro onCreate={() => void create()} onImported={open} />
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden bg-(--ui-surface-background)" data-workflows="">
      <nav className="flex w-64 shrink-0 flex-col border-r border-(--card-well-stroke) bg-(--card-surface)">
        <div className="flex flex-col gap-3 px-3 pt-4 pb-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <h1 className={cn(DISPLAY, 'm-0 text-[1.5rem] leading-none text-(--ui-text-primary)')}>
              {COPY.page.title}
            </h1>
            <span className="flex-1" />
            <ImportButton className={BTN_GHOST} onImported={open}>
              <Codicon name="cloud-upload" size="0.9375rem" />
            </ImportButton>
            <button
              aria-label={COPY.newWorkflow}
              className={cn(BTN_PRIMARY, 'size-8 px-0')}
              onClick={() => void create()}
              title={COPY.newWorkflow}
              type="button"
            >
              <Codicon name="add" size="0.875rem" />
            </button>
          </div>
          <p className={cn(HINT, 'px-1')}>{COPY.page.subtitle}</p>
          <label className="relative">
            <Codicon
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-(--ui-text-tertiary)"
              name="search"
              size="0.8125rem"
            />
            <input
              className={cn(FIELD, 'h-8 pl-8 text-[0.8125rem]')}
              onChange={e => setSearch(e.target.value)}
              placeholder={COPY.page.search}
              value={search}
            />
          </label>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
          {error && <p className="m-0 px-2 text-[0.75rem] text-(--ui-red)">{COPY.page.loadFailed}</p>}
          {shown.map(workflow => (
            <WorkflowRow
              active={workflow.id === current}
              key={workflow.id}
              onOpen={() => setOpenId(workflow.id)}
              workflow={workflow}
            />
          ))}
          {workflows && workflows.length > 0 && !shown.length && (
            <p className={cn(HINT, 'px-2')}>{COPY.page.noMatch}</p>
          )}
        </div>
      </nav>
      <main className="flex min-w-0 flex-1">
        {current ? (
          <OpenWorkflow id={current} key={current} onDeleted={() => setOpenId(null)} onOpen={open} />
        ) : (
          <p className="m-auto text-[0.8125rem] text-(--ui-text-tertiary)">{COPY.page.pick}</p>
        )}
      </main>
    </div>
  )
}
