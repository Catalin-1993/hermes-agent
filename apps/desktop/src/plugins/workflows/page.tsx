/**
 * The Workflows page: the open workflow across the whole page, its toolbar in the app's top bar, and
 * every other workflow behind "Workflows ▾" at the start of it (workflow-switcher.tsx). With none
 * yet, the page explains what a workflow is and makes the first.
 */

import './workflows.css'

import { cn, Codicon, host, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import { createWorkflow, fetchWorkflow, fetchWorkflows, keys, type WorkflowDetail, type WorkflowSummary } from './api'
import { COPY } from './copy'
import { EditorView } from './editor-view'
import { ImportButton } from './import-button'
import { BTN, BTN_PRIMARY, DISPLAY, KindTile } from './ui'
import { WorkflowSwitcher } from './workflow-switcher'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

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
  onOpen,
  switcher
}: {
  id: string
  onDeleted: () => void
  onOpen: (detail: WorkflowDetail) => void
  switcher: ReactNode
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
      switcher={switcher}
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

  const current = openId && workflows?.some(w => w.id === openId) ? openId : (workflows?.[0]?.id ?? null)

  const open = (workflow: WorkflowDetail | WorkflowSummary) => {
    if ('nodes' in workflow) {
      queryClient.setQueryData(keys.workflow(workflow.id), workflow)
    }

    setOpenId(workflow.id)
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

  const switcher = (
    <WorkflowSwitcher
      currentId={current}
      onCreate={() => void create()}
      onDeleted={id => id === current && setOpenId(null)}
      onOpen={open}
      workflows={workflows ?? []}
    />
  )

  return (
    <div className="flex h-full overflow-hidden bg-(--ui-surface-background)" data-workflows="">
      <main className="flex min-w-0 flex-1">
        {current ? (
          <OpenWorkflow
            id={current}
            key={current}
            onDeleted={() => setOpenId(null)}
            onOpen={open}
            switcher={switcher}
          />
        ) : (
          <div className="m-auto flex flex-col items-center gap-3">
            {switcher}
            <p className="m-0 text-[0.8125rem] text-(--ui-text-tertiary)">
              {error ? COPY.page.loadFailed : COPY.page.pick}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
