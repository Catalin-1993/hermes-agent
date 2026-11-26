/**
 * The open workflow while the owner edits it: the document, its undo history, the selection, and
 * the autosave (half a second after the last edit, and at once when the page closes). The canvas
 * owns the document while it is open; the server's answer only brings back what the server knows
 * (problems, version, next run), never a document that would undo a later keystroke.
 */

import { useQueryClient } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'

import { keys, saveWorkflow, type WorkflowDetail, type WorkflowDoc } from './api'

const SAVE_DELAY_MS = 500
const HISTORY_LIMIT = 100

export type SaveState = 'failed' | 'idle' | 'saved' | 'saving'

export type Selection = { id: string; type: 'edge' } | { id: string; type: 'node' } | null

interface History {
  doc: WorkflowDoc
  future: WorkflowDoc[]
  past: WorkflowDoc[]
}

const docOf = (detail: WorkflowDetail): WorkflowDoc => ({
  description: detail.description,
  edges: detail.edges,
  name: detail.name,
  nodes: detail.nodes,
  viewport: detail.viewport
})

type Meta = Pick<WorkflowDetail, 'hook' | 'next_run' | 'problems' | 'version'>

const metaOf = (detail: WorkflowDetail): Meta => ({
  hook: detail.hook,
  next_run: detail.next_run,
  problems: detail.problems,
  version: detail.version
})

export interface Editor {
  canRedo: boolean
  canUndo: boolean
  /** Remember the document as it is now, before a gesture that edits it many times (a drag). */
  checkpoint: () => void
  doc: WorkflowDoc
  /** Apply an edit. `record: false` for the many small edits of one gesture after a checkpoint. */
  edit: (change: (doc: WorkflowDoc) => WorkflowDoc, options?: { record?: boolean }) => void
  id: string
  meta: Meta
  /** Take what the server says about the workflow (a new secret) without touching the document. */
  refresh: (detail: WorkflowDetail) => void
  redo: () => void
  saveState: SaveState
  select: (selection: Selection) => void
  selection: Selection
  setViewport: (viewport: WorkflowDoc['viewport']) => void
  undo: () => void
}

export function useWorkflowEditor(detail: WorkflowDetail): Editor {
  const queryClient = useQueryClient()
  const [history, setHistory] = useState<History>(() => ({ doc: docOf(detail), future: [], past: [] }))
  const [selection, select] = useState<Selection>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [meta, setMeta] = useState(() => metaOf(detail))

  const pending = useRef<null | WorkflowDoc>(null)
  const timer = useRef<null | ReturnType<typeof setTimeout>>(null)
  const id = detail.id

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }

    const doc = pending.current

    if (!doc) {
      return
    }

    pending.current = null
    setSaveState('saving')
    saveWorkflow(id, doc)
      .then(saved => {
        setMeta(metaOf(saved))
        setSaveState(pending.current ? 'saving' : 'saved')
        queryClient.setQueryData(keys.workflow(id), saved)
        void queryClient.invalidateQueries({ queryKey: keys.list })
      })
      .catch(() => setSaveState('failed'))
  }, [id, queryClient])

  const schedule = useCallback(
    (doc: WorkflowDoc) => {
      pending.current = doc
      setSaveState('saving')

      if (timer.current) {
        clearTimeout(timer.current)
      }

      timer.current = setTimeout(flush, SAVE_DELAY_MS)
    },
    [flush]
  )

  useEffect(() => () => flush(), [flush])

  const edit = useCallback<Editor['edit']>(
    (change, options) => {
      setHistory(current => {
        const doc = change(current.doc)

        if (doc === current.doc) {
          return current
        }

        schedule(doc)

        if (options?.record === false) {
          return { ...current, doc }
        }

        return { doc, future: [], past: [...current.past, current.doc].slice(-HISTORY_LIMIT) }
      })
    },
    [schedule]
  )

  const checkpoint = useCallback(() => {
    setHistory(current => ({ ...current, future: [], past: [...current.past, current.doc].slice(-HISTORY_LIMIT) }))
  }, [])

  const undo = useCallback(() => {
    setHistory(current => {
      const previous = current.past.at(-1)

      if (!previous) {
        return current
      }

      const doc = { ...previous, viewport: current.doc.viewport }
      schedule(doc)

      return { doc, future: [current.doc, ...current.future], past: current.past.slice(0, -1) }
    })
  }, [schedule])

  const redo = useCallback(() => {
    setHistory(current => {
      const next = current.future[0]

      if (!next) {
        return current
      }

      const doc = { ...next, viewport: current.doc.viewport }
      schedule(doc)

      return { doc, future: current.future.slice(1), past: [...current.past, current.doc] }
    })
  }, [schedule])

  const setViewport = useCallback(
    (viewport: WorkflowDoc['viewport']) => {
      setHistory(current => {
        const doc = { ...current.doc, viewport }
        schedule(doc)

        return { ...current, doc }
      })
    },
    [schedule]
  )

  const refresh = useCallback(
    (next: WorkflowDetail) => {
      setMeta(metaOf(next))
      queryClient.setQueryData(keys.workflow(id), next)
    },
    [id, queryClient]
  )

  return {
    canRedo: history.future.length > 0,
    canUndo: history.past.length > 0,
    checkpoint,
    doc: history.doc,
    edit,
    id,
    meta,
    redo,
    refresh,
    saveState,
    select,
    selection,
    setViewport,
    undo
  }
}
