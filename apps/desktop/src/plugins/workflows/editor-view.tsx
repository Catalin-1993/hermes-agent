/**
 * One open workflow: the toolbar (name, save state, undo/redo, Add, Run, more), the canvas, and the
 * right panel (Settings or Runs). Starting a run opens it in Runs and shows its progress on the
 * canvas; the run itself goes on in its own process whether or not this page stays open.
 */

import {
  cn,
  Codicon,
  ConfirmDialog,
  host,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useQuery,
  useQueryClient,
  WorkspacePageHeaderControl
} from '@hermes/plugin-sdk'
import { type KeyboardEvent, type ReactNode, useCallback, useMemo, useRef, useState } from 'react'

import { AddMenuBody, FloatingAddMenu, MenuItem } from './add-menu'
import {
  deleteWorkflow,
  duplicateWorkflow,
  exportWorkflow,
  fetchRun,
  keys,
  type NodeKind,
  type RunSummary,
  runWorkflow,
  type StepStatus,
  type WorkflowDetail,
  type WorkflowEdge
} from './api'
import { WorkflowCanvas } from './canvas'
import { COPY } from './copy'
import { addNode, duplicateNode, findNode, newNodeId, removeEdge, removeNodes } from './doc'
import { type Editor, useWorkflowEditor } from './editor-state'
import { Inspector } from './inspector'
import { isVisual, nodeLabel } from './kinds'
import { RunsPanel } from './runs-panel'
import { BTN, BTN_PRIMARY, DISPLAY, IconButton, Kbd } from './ui'
import { VersionsPanel } from './versions-panel'

type Tab = 'runs' | 'settings' | 'versions'

const TABS: { icon: string; id: Tab; label: string }[] = [
  { icon: 'settings-gear', id: 'settings', label: COPY.toolbar.settings },
  { icon: 'play-circle', id: 'runs', label: COPY.toolbar.runs },
  { icon: 'history', id: 'versions', label: COPY.toolbar.versions }
]

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

function SaveBadge({ state }: { state: Editor['saveState'] }) {
  if (state === 'idle') {
    return null
  }

  const view = {
    failed: { icon: 'warning', text: COPY.toolbar.saveFailed, tone: 'text-(--ui-red)' },
    saved: { icon: 'check', text: COPY.toolbar.saved, tone: 'text-(--ui-text-tertiary)' },
    saving: { icon: 'sync', text: COPY.toolbar.saving, tone: 'text-(--ui-text-tertiary)' }
  }[state]

  return (
    <span className={cn('flex items-center gap-1 text-[0.71875rem]', view.tone)}>
      <Codicon name={view.icon} size="0.75rem" spinning={state === 'saving'} />
      {view.text}
    </span>
  )
}

function NameField({ editor }: { editor: Editor }) {
  const recorded = useRef(false)

  return (
    <input
      aria-label={COPY.toolbar.rename}
      className={cn(
        DISPLAY,
        'w-[min(22rem,32vw)] min-w-24 truncate rounded-[7px] border border-transparent bg-transparent px-1.5 py-0.5 text-[0.9375rem] leading-tight tracking-[-0.01em] text-(--ui-text-primary) outline-none hover:border-(--card-stroke) focus:border-(--card-stroke) focus:bg-(--card-well)'
      )}
      onBlur={() => {
        recorded.current = false
      }}
      onChange={event => {
        const name = event.target.value
        const record = !recorded.current
        recorded.current = true
        editor.edit(doc => ({ ...doc, name }), { record })
      }}
      onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()}
      value={editor.doc.name}
    />
  )
}

function RunMenu({ editor, onRun }: { editor: Editor; onRun: (mode: RunSummary['mode'], nodeId?: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = editor.selection?.type === 'node' ? findNode(editor.doc, editor.selection.id) : undefined
  const runnable = selected && !isVisual(selected.kind) ? selected : undefined

  const pick = (mode: RunSummary['mode'], nodeId?: string) => {
    setOpen(false)
    onRun(mode, nodeId)
  }

  return (
    <div className="flex items-center">
      <button className={cn(BTN_PRIMARY, 'rounded-r-none')} onClick={() => onRun('all')} type="button">
        <Codicon name="play" size="0.8125rem" />
        {COPY.toolbar.run}
      </button>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <button
            aria-label={COPY.toolbar.more}
            className={cn(
              BTN_PRIMARY,
              'rounded-l-none border-l border-[color-mix(in_srgb,var(--card-surface)_25%,transparent)] px-2'
            )}
            type="button"
          >
            <Codicon name="chevron-down" size="0.75rem" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-1">
          <MenuItem icon={<Codicon name="run-all" size="0.875rem" />} onClick={() => pick('all')}>
            {COPY.toolbar.runAll}
          </MenuItem>
          <MenuItem
            icon={<Codicon name="debug-continue" size="0.875rem" />}
            onClick={() => runnable && pick('from', runnable.id)}
          >
            <span className={cn(!runnable && 'opacity-50')}>
              {COPY.toolbar.runFrom}
              <span className="block text-[0.6875rem] text-(--ui-text-tertiary)">
                {runnable ? nodeLabel(runnable) : COPY.toolbar.pickStep}
              </span>
            </span>
          </MenuItem>
          <MenuItem
            icon={<Codicon name="debug-step-over" size="0.875rem" />}
            onClick={() => runnable && runnable.kind !== 'trigger' && pick('step', runnable.id)}
          >
            <span className={cn((!runnable || runnable.kind === 'trigger') && 'opacity-50')}>
              {COPY.toolbar.runStep}
              <span className="block text-[0.6875rem] text-(--ui-text-tertiary)">
                {runnable ? nodeLabel(runnable) : COPY.toolbar.pickStep}
              </span>
            </span>
          </MenuItem>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'workflow'}.workflow.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function MoreMenu({
  editor,
  id,
  onDeleted,
  onReload,
  onVersions
}: {
  editor: Editor
  id: string
  onDeleted: () => void
  onReload: (detail: WorkflowDetail) => void
  onVersions: () => void
}) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const queryClient = useQueryClient()

  const duplicate = async () => {
    setOpen(false)

    try {
      const copy = await duplicateWorkflow(id)
      await queryClient.invalidateQueries({ queryKey: keys.list })
      onReload(copy)
    } catch (error) {
      host.notify({ kind: 'error', message: errorText(error) })
    }
  }

  const exportFile = async () => {
    setOpen(false)

    try {
      download(editor.doc.name, await exportWorkflow(id))
      host.notify({ kind: 'success', message: COPY.files.exported })
    } catch (error) {
      host.notify({ kind: 'error', message: errorText(error) })
    }
  }

  return (
    <>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <IconButton icon="ellipsis" label={COPY.toolbar.more} />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-1">
          <MenuItem icon={<Codicon name="copy" size="0.875rem" />} onClick={() => void duplicate()}>
            {COPY.toolbar.duplicate}
          </MenuItem>
          <MenuItem icon={<Codicon name="desktop-download" size="0.875rem" />} onClick={() => void exportFile()}>
            {COPY.files.export}
          </MenuItem>
          <MenuItem
            icon={<Codicon name="history" size="0.875rem" />}
            onClick={() => {
              setOpen(false)
              onVersions()
            }}
          >
            {COPY.toolbar.versions} · v{editor.meta.version}
          </MenuItem>
          <MenuItem
            danger
            icon={<Codicon name="trash" size="0.875rem" />}
            onClick={() => {
              setOpen(false)
              setConfirm(true)
            }}
          >
            {COPY.toolbar.delete}
          </MenuItem>
        </PopoverContent>
      </Popover>
      <ConfirmDialog
        busyLabel={COPY.confirmDelete.busy}
        confirmLabel={COPY.confirmDelete.confirm}
        description={COPY.confirmDelete.description}
        destructive
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteWorkflow(id)
          queryClient.removeQueries({ queryKey: keys.workflow(id) })
          await queryClient.invalidateQueries({ queryKey: keys.list })
          onDeleted()
        }}
        open={confirm}
        title={COPY.confirmDelete.title(editor.doc.name)}
      />
    </>
  )
}

function useRunOverlay(runId: null | string, on: boolean) {
  const { data: run } = useQuery({
    enabled: Boolean(runId && on),
    queryFn: () => fetchRun(runId!),
    queryKey: keys.run(runId ?? '-'),
    refetchInterval: query =>
      query.state.data && ['queued', 'running', 'waiting'].includes(query.state.data.status) ? 1_500 : false
  })

  return useMemo(
    () => (run && on ? new Map<string, StepStatus>(run.steps.map(s => [s.node_id, s.status])) : undefined),
    [on, run]
  )
}

function useShortcuts(editor: Editor) {
  return useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement

      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) {
        return
      }

      const mod = event.metaKey || event.ctrlKey
      const sel = editor.selection
      const key = event.key.toLowerCase()

      const actions: Record<string, () => void> = {
        backspace: () => sel && remove(),
        d: () => {
          const node = sel?.type === 'node' ? findNode(editor.doc, sel.id) : undefined

          if (mod && node && node.kind !== 'trigger') {
            // The id is chosen here: the edit runs later, inside React's state update.
            const id = newNodeId()
            editor.edit(doc => duplicateNode(doc, node.id, id).doc)
            editor.select({ id, type: 'node' })
          }
        },
        delete: () => sel && remove(),
        escape: () => editor.select(null),
        z: () => mod && (event.shiftKey ? editor.redo() : editor.undo()),
        y: () => mod && editor.redo()
      }

      function remove() {
        if (!sel) {
          return
        }

        editor.edit(doc => (sel.type === 'edge' ? removeEdge(doc, sel.id) : removeNodes(doc, [sel.id])))
        editor.select(null)
      }

      const action = actions[key]

      if (action && (mod || !['d', 'z', 'y'].includes(key))) {
        event.preventDefault()
        action()
      }
    },
    [editor]
  )
}

export function EditorView({
  detail,
  onDeleted,
  onOpen,
  switcher
}: {
  detail: WorkflowDetail
  onDeleted: () => void
  onOpen: (detail: WorkflowDetail) => void
  /** "Workflows ▾": every workflow, at the start of the toolbar. */
  switcher: ReactNode
}) {
  const editor = useWorkflowEditor(detail)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('settings')
  const [openRun, setOpenRun] = useState<null | string>(null)
  const [overlay, setOverlay] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const [quick, setQuick] = useState<null | {
    at: { x: number; y: number }
    branch: WorkflowEdge['branch']
    nodeId: string
  }>(null)

  const viewportRef = useRef<{ center: () => { x: number; y: number } } | null>(null)
  const runStatus = useRunOverlay(openRun, overlay)
  const onKeyDown = useShortcuts(editor)

  const agentLabel = useCallback((name: string) => name || COPY.inspector.defaultAgent, [])

  const add = (kind: Exclude<NodeKind, 'trigger'>, after?: string, branch?: WorkflowEdge['branch']) => {
    const at = viewportRef.current?.center() ?? { x: 0, y: 0 }
    // The id is chosen here: the edit runs later, inside React's state update.
    const id = newNodeId()
    editor.edit(doc => addNode(doc, kind, { after, at, branch, id }).doc)
    editor.select({ id, type: 'node' })
    setTab('settings')
  }

  const run = async (mode: RunSummary['mode'], nodeId?: string) => {
    try {
      const { run_id } = await runWorkflow(detail.id, mode, nodeId)
      setTab('runs')
      setOpenRun(run_id)
      setOverlay(true)
      host.notify({ kind: 'info', message: COPY.runs.started })
      void queryClient.invalidateQueries({ queryKey: keys.runs(detail.id) })
      void queryClient.invalidateQueries({ queryKey: keys.list })
    } catch (error) {
      host.notify({ kind: 'error', message: errorText(error) })
    }
  }

  const selected = editor.selection?.type === 'node' ? findNode(editor.doc, editor.selection.id) : undefined
  const addAfter = selected && !isVisual(selected.kind) ? selected : undefined
  const quickNode = quick ? findNode(editor.doc, quick.nodeId) : undefined

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      {/* Brain: the toolbar stands in the app's top bar (the workspace page header), so the canvas starts
          right under it; in a split route tile it renders in place as the page's first row. */}
      <WorkspacePageHeaderControl bare id="workflows:topbar">
      <header className="wf-top" data-nodrag="">
        {switcher}
        <Codicon className="shrink-0 text-(--ui-text-quaternary)" name="chevron-right" size="0.6875rem" />
        <NameField editor={editor} />
        <SaveBadge state={editor.saveState} />
        <span className="flex-1" />
        <IconButton
          disabled={!editor.canUndo}
          icon="discard"
          label={`${COPY.toolbar.undo} (⌘Z)`}
          onClick={editor.undo}
        />
        <IconButton disabled={!editor.canRedo} icon="redo" label={`${COPY.toolbar.redo} (⇧⌘Z)`} onClick={editor.redo} />
        <Popover onOpenChange={setAddOpen} open={addOpen}>
          <PopoverTrigger asChild>
            <button className={BTN} type="button">
              <Codicon name="add" size="0.8125rem" />
              {COPY.toolbar.add}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <AddMenuBody
              after={addAfter ? nodeLabel(addAfter) : undefined}
              onPick={kind => {
                setAddOpen(false)
                add(kind, addAfter?.id, null)
              }}
            />
          </PopoverContent>
        </Popover>
        <RunMenu editor={editor} onRun={(mode, nodeId) => void run(mode, nodeId)} />
        <MoreMenu
          editor={editor}
          id={detail.id}
          onDeleted={onDeleted}
          onReload={onOpen}
          onVersions={() => setTab('versions')}
        />
      </header>
      </WorkspacePageHeaderControl>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <WorkflowCanvas
            agentLabel={agentLabel}
            editor={editor}
            onQuickAdd={(nodeId, branch, at) => setQuick({ at, branch, nodeId })}
            runStatus={runStatus}
            viewportRef={viewportRef}
          />
          <div className="pointer-events-none absolute right-4 bottom-4 flex items-center gap-2 text-[0.6875rem] text-(--ui-text-tertiary)">
            <Kbd>⌘Z</Kbd> anulează · <Kbd>⌫</Kbd> șterge · <Kbd>⌘D</Kbd> duplică · <Kbd>⌘</Kbd>+scroll zoom
          </div>
        </div>

        <aside className="flex w-[22.5rem] shrink-0 flex-col border-l border-(--card-well-stroke) bg-(--card-surface)">
          <div className="flex h-11 shrink-0 items-center gap-1 border-b border-(--card-well-stroke) px-2">
            {TABS.map(t => (
              <button
                aria-pressed={tab === t.id}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[0.8125rem] font-medium transition-colors',
                  tab === t.id
                    ? 'bg-(--card-well) text-(--ui-text-primary)'
                    : 'text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
                )}
                key={t.id}
                onClick={() => setTab(t.id)}
                type="button"
              >
                <Codicon name={t.icon} size="0.8125rem" />
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'settings' && <Inspector editor={editor} onRun={(mode, nodeId) => void run(mode, nodeId)} />}
            {tab === 'runs' && (
              <RunsPanel
                onOpenRun={setOpenRun}
                openRun={openRun}
                overlay={overlay}
                setOverlay={setOverlay}
                workflowId={detail.id}
              />
            )}
            {tab === 'versions' && <VersionsPanel editor={editor} onRestored={onOpen} />}
          </div>
        </aside>
      </div>

      {quick && quickNode && (
        <FloatingAddMenu
          after={nodeLabel(quickNode)}
          at={quick.at}
          onClose={() => setQuick(null)}
          onPick={kind => {
            setQuick(null)
            add(kind, quick.nodeId, quick.branch)
          }}
        />
      )}
    </div>
  )
}
