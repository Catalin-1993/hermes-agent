import { atom } from 'nanostores'

import {
  abandonStagedUpload,
  bumpLibraryRevision,
  importLibraryFolder,
  type LibraryItem,
  type LibraryOnDuplicate,
  uploadLibraryFile
} from './data'

export type LibraryUploadStatus = 'cancelled' | 'conflict' | 'done' | 'failed' | 'queued' | 'skipped' | 'uploading'

/** One row of the upload panel. Files and abort handles live beside the store, not in it. */
export interface LibraryUploadTask {
  id: string
  name: string
  kind: 'file' | 'folder'
  parentId: null | string
  status: LibraryUploadStatus
  /** 0–1; a local copy reports nothing until it lands (shown indeterminate). */
  progress: number
  conflict?: { item: LibraryItem; type: 'content' | 'name' }
  error?: string
  /** A folder import's file count once it lands. */
  imported?: number
}

export const $libraryUploads = atom<LibraryUploadTask[]>([])

const files = new Map<string, File>()
const folders = new Map<string, string>()
const aborts = new Map<string, AbortController>()
const staged = new Map<string, string>()
const decisions = new Map<string, LibraryOnDuplicate>()
// An "apply to the rest" answer, standing until the queue runs dry.
let standing: LibraryOnDuplicate | null = null

const CONCURRENCY = 2
let running = 0
let seq = 0

const patch = (id: string, next: Partial<LibraryUploadTask>) =>
  $libraryUploads.set($libraryUploads.get().map(task => (task.id === id ? { ...task, ...next } : task)))

const taskOf = (id: string) => $libraryUploads.get().find(task => task.id === id)

const settled = (status: LibraryUploadStatus) =>
  status === 'cancelled' || status === 'done' || status === 'failed' || status === 'skipped'

function release(id: string) {
  files.delete(id)
  folders.delete(id)
  aborts.delete(id)
  decisions.delete(id)
  staged.delete(id)
}

async function run(task: LibraryUploadTask) {
  const controller = new AbortController()

  aborts.set(task.id, controller)
  patch(task.id, { error: undefined, status: 'uploading' })

  try {
    const folderPath = folders.get(task.id)

    if (folderPath) {
      const result = await importLibraryFolder(folderPath, task.parentId)

      patch(task.id, { imported: result.imported, progress: 1, status: 'done' })
      release(task.id)
      bumpLibraryRevision()

      return
    }

    const file = files.get(task.id)

    if (!file) {
      return
    }

    const outcome = await uploadLibraryFile(file, {
      onDuplicate: decisions.get(task.id) ?? standing ?? 'ask',
      onProgress: progress => patch(task.id, { progress }),
      parentId: task.parentId,
      signal: controller.signal,
      stagedId: staged.get(task.id)
    })

    if (taskOf(task.id)?.status === 'cancelled') {
      return
    }

    if (outcome.conflict) {
      if (outcome.stagedId) {
        staged.set(task.id, outcome.stagedId)
      }

      patch(task.id, { conflict: outcome.conflict, status: 'conflict' })

      return
    }

    patch(task.id, { conflict: undefined, progress: 1, status: outcome.skipped ? 'skipped' : 'done' })
    release(task.id)
    bumpLibraryRevision()
  } catch (error) {
    if (taskOf(task.id)?.status !== 'cancelled') {
      patch(task.id, { error: error instanceof Error ? error.message : String(error), status: 'failed' })
    }
  } finally {
    aborts.delete(task.id)
  }
}

function pump() {
  while (running < CONCURRENCY) {
    const next = $libraryUploads.get().find(task => task.status === 'queued')

    if (!next) {
      break
    }

    running += 1
    patch(next.id, { status: 'uploading' })
    void run(next).finally(() => {
      running -= 1
      pump()
    })
  }

  if (running === 0 && !$libraryUploads.get().some(task => task.status === 'queued' || task.status === 'conflict')) {
    standing = null
  }
}

const newId = () => `up_${Date.now().toString(36)}_${(seq += 1)}`

/** Queue files for a folder (`null` = the root). Duplicates come back as conflicts to answer. */
export function enqueueLibraryFiles(list: readonly File[], parentId: null | string) {
  const tasks = list.map(file => {
    const id = newId()

    files.set(id, file)

    return { id, kind: 'file', name: file.name, parentId, progress: 0, status: 'queued' } satisfies LibraryUploadTask
  })

  $libraryUploads.set([...$libraryUploads.get(), ...tasks])
  pump()
}

/** Queue a whole folder on the backend host, mirrored as a folder tree. */
export function enqueueLibraryFolder(path: string, name: string, parentId: null | string) {
  const id = newId()

  folders.set(id, path)
  $libraryUploads.set([...$libraryUploads.get(), { id, kind: 'folder', name, parentId, progress: 0, status: 'queued' }])
  pump()
}

export function cancelLibraryUpload(id: string) {
  aborts.get(id)?.abort()

  const uploadId = staged.get(id)

  if (uploadId) {
    void abandonStagedUpload(uploadId)
  }

  patch(id, { status: 'cancelled' })
  release(id)
}

export function retryLibraryUpload(id: string) {
  if (taskOf(id)?.status === 'failed') {
    patch(id, { error: undefined, progress: 0, status: 'queued' })
    pump()
  }
}

/** Answer a duplicate; with `applyToRest` the answer settles every waiting conflict and the ones
 *  still to come in this batch. */
export function resolveLibraryConflict(id: string, decision: LibraryOnDuplicate, applyToRest = false) {
  const ids = applyToRest
    ? $libraryUploads
        .get()
        .filter(task => task.status === 'conflict')
        .map(task => task.id)
    : [id]

  if (applyToRest) {
    standing = decision
  }

  for (const taskId of ids) {
    decisions.set(taskId, decision)
    patch(taskId, { conflict: undefined, status: 'queued' })
  }

  pump()
}

/** Drop the finished rows; anything still moving stays. */
export function dismissLibraryUploads() {
  $libraryUploads.set($libraryUploads.get().filter(task => !settled(task.status)))
}

export const isUploadSettled = settled
