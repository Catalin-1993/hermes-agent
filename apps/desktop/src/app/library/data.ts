import type {
  LibraryItemInfo,
  LibraryPreviewResult,
  LibrarySmart,
  LibrarySmartQuery,
  LibraryTag,
  LibraryVersion
} from '@hermes/shared'
import { atom } from 'nanostores'

import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { persistentAtom } from '@/lib/persisted'
import { requestGatewayForProfile } from '@/store/gateway'
import { $activeGatewayProfile } from '@/store/profile'

export type LibraryItem = LibraryItemInfo
export type LibraryPreview = LibraryPreviewResult
export type LibraryTagInfo = LibraryTag
export type LibraryTagColor = LibraryTag['color']
export type LibrarySavedSearch = LibrarySmart
export type LibrarySavedQuery = LibrarySmartQuery
export type LibraryVersionInfo = LibraryVersion
export type LibraryScope = 'all' | 'favorites' | 'trash'
export type LibraryVisibility = LibraryItemInfo['visibility']
export type LibrarySort = 'created' | 'kind' | 'name' | 'size' | 'updated'
export type LibraryOrder = 'asc' | 'desc'
export type LibraryOnDuplicate = 'ask' | 'keep' | 'replace' | 'skip'

/** Two libraries in one store: the owner's own, and the notebook Brain keeps itself. */
export type LibrarySpace = 'agent' | 'user'

/** Which one the window is showing. Every listing and every new item follows it; one choice for the window, remembered. */
export const $librarySpace = persistentAtom<LibrarySpace>('hermes.desktop.library.space.v1', 'user', {
  decode: raw => (raw === 'agent' ? 'agent' : 'user'),
  encode: value => value
})

/** The Library lives in the active profile's home; every call names it. */
const rpc = <T>(method: string, params: Record<string, unknown> = {}) =>
  requestGatewayForProfile<T>($activeGatewayProfile.get(), method, params)

export interface LibraryListQuery {
  kind?: LibraryItem['kind']
  order?: LibraryOrder
  /** Absent: across the whole tree. `''`: the root. An id: that folder or page. */
  parentId?: string
  query?: string
  scope?: LibraryScope
  /** Absent: the library the window is showing. */
  space?: LibrarySpace
  sort?: LibrarySort
  /** Only items wearing this tag. */
  tag?: string
}

// The backend's ceiling for one listing; the views render it progressively.
const LIST_LIMIT = 5000

export const listLibrary = ({ parentId, space, ...params }: LibraryListQuery = {}) =>
  rpc<{ items: LibraryItem[]; trail: LibraryItem[] }>('library.list', {
    ...params,
    limit: LIST_LIMIT,
    parent_id: parentId,
    space: space ?? $librarySpace.get()
  })

export const getLibraryItem = (id: string) => rpc<{ item: LibraryItem; trail: LibraryItem[] }>('library.get', { id })

export const createLibraryPage = (params: {
  icon?: string
  markdown?: string
  parent_id?: string
  title?: string
  visibility?: LibraryVisibility
}) => rpc<{ item: LibraryItem }>('library.create_page', { space: $librarySpace.get(), ...params }).then(r => r.item)

/** Duplicate items with everything below them — into a folder, or each beside itself (⌘D). */
export const copyLibraryItems = (ids: readonly string[], target: { inPlace: true } | { parentId: null | string }) =>
  rpc<{ items: LibraryItem[] }>(
    'library.copy',
    'inPlace' in target ? { ids, in_place: true } : { ids, parent_id: target.parentId ?? '' }
  ).then(r => r.items)

/** Unpack an archive into a new folder beside it. */
export const extractLibraryArchive = (id: string) =>
  rpc<{ folder: LibraryItem; imported: number; truncated: boolean }>('library.extract', { id })

/** A path naming a file or page as the user knows it, to attach to a chat. */
export const exportLibraryItem = (id: string) => rpc<{ path: string }>('library.export', { id }).then(r => r.path)

export const listLibraryVersions = (id: string) =>
  rpc<{ versions: LibraryVersion[] }>('library.versions', { id }).then(r => r.versions)

/** Bring an earlier version back; the current state becomes a version first. */
export const restoreLibraryVersion = (id: string, versionId: string) =>
  rpc<{ item: LibraryItem }>('library.restore_version', { id, version_id: versionId }).then(r => r.item)

export const listLibraryTags = () => rpc<{ tags: LibraryTag[] }>('library.tags').then(r => r.tags)

export const tagLibraryItems = (ids: readonly string[], name: string, on: boolean, color?: LibraryTagColor) =>
  rpc<{ color: LibraryTagColor; name: string }>('library.tag', { color, ids, name, on })

export const updateLibraryTag = (name: string, patch: { color?: LibraryTagColor; new_name?: string }) =>
  rpc<{ color: LibraryTagColor; name: string }>('library.tag_update', { name, ...patch })

export const deleteLibraryTag = (name: string) => rpc<{ ok: boolean }>('library.tag_delete', { name })

export const listSavedSearches = () => rpc<{ searches: LibrarySmart[] }>('library.smart_list').then(r => r.searches)

export const createSavedSearch = (title: string, query: LibrarySmartQuery) =>
  rpc<LibrarySmart>('library.smart_create', { query, title })

export const deleteSavedSearch = (id: string) => rpc<{ ok: boolean }>('library.smart_delete', { id })

export const createLibraryFolder = (title: string, parentId?: null | string) =>
  rpc<{ item: LibraryItem }>('library.create_folder', {
    parent_id: parentId || undefined,
    space: $librarySpace.get(),
    title
  }).then(r => r.item)

export const moveLibraryItems = (ids: readonly string[], parentId: null | string) =>
  rpc<{ items: LibraryItem[] }>('library.move', { ids, parent_id: parentId ?? '' }).then(r => r.items)

export interface LibraryPatch {
  content?: string
  cover?: string
  favorite?: boolean
  icon?: string
  markdown?: string
  parent_id?: string
  title?: string
  visibility?: LibraryVisibility
}

export const updateLibraryItem = (id: string, patch: LibraryPatch) =>
  rpc<{ item: LibraryItem }>('library.update', { id, ...patch }).then(r => r.item)

export const trashLibraryItem = (id: string, restore = false) =>
  rpc<{ item: LibraryItem }>('library.trash', { id, restore }).then(r => r.item)

export const purgeLibraryItem = (id: string) => rpc<{ removed: number }>('library.purge', { id })

export const emptyLibraryTrash = () => rpc<{ removed: number }>('library.empty_trash', { space: $librarySpace.get() })

/** Brain's notebook: whether it is on, when it last wrote, how many pages it holds. */
export interface NotebookStatus {
  enabled: boolean
  language: string
  last_documented: number
  last_run: null | number
  pages: Record<string, number>
  running: boolean
}

/** Make the notebook's fixed pages if they are missing and bring "About you" up to date with memory. */
export const ensureNotebook = () => rpc<NotebookStatus>('library.notebook_ensure')

export const notebookStatus = () => rpc<NotebookStatus>('library.notebook_status')

/** Document the conversations that are waiting, in the background; `days` also reaches back over older ones. */
export const runNotebook = (days?: number) => rpc<{ started: boolean }>('library.notebook_run', days ? { days } : {})

/** One thing Brain wrote in its notebook, and whether it can still be put back. */
export interface NotebookChange {
  action: 'created' | 'updated'
  at: number
  can_undo: boolean
  id: number
  item_id: string
  key: string
  title: string
  undone: boolean
}

export const notebookChanges = (limit = 30) =>
  rpc<{ changes: NotebookChange[] }>('library.notebook_changes', { limit }).then(r => r.changes)

/** Put a page back as it was before the change (a page Brain made goes to the Trash). */
export const undoNotebookChange = (id: number) =>
  rpc<{ undone: boolean }>('library.notebook_undo', { id }).then(r => r.undone)

export function setLibrarySpace(space: LibrarySpace) {
  if ($librarySpace.get() !== space) {
    $librarySpace.set(space)
    bumpLibraryRevision()
  }
}

/** How to show a file the renderer cannot show by itself (sheets, text, archives, renditions). */
export const previewLibraryItem = (id: string) => rpc<LibraryPreview>('library.preview', { id })

export interface LibraryReadOptions {
  /** Fraction of the bytes arrived so far, 0–1. */
  onProgress?: (fraction: number) => void
  /** The derived file instead: a HEIC's JPEG, an office document's PDF. */
  rendition?: boolean
}

const bytesOf = (base64: string) => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

/** A file's bytes for in-app viewers, in slices (`library.read`) — so any size arrives, with progress,
 *  locally and from a remote backend alike. */
export async function readLibraryBlob(id: string, { onProgress, rendition }: LibraryReadOptions = {}): Promise<Blob> {
  const parts: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  let size = 1
  let mime = ''

  while (offset < size) {
    const slice = await rpc<{ data: string; mime?: null | string; size: number }>('library.read', {
      id,
      offset,
      rendition
    })

    const bytes = bytesOf(slice.data)

    size = slice.size
    mime = slice.mime ?? ''

    if (bytes.length === 0) {
      break
    }

    parts.push(bytes)
    offset += bytes.length
    onProgress?.(size ? offset / size : 1)
  }

  return new Blob(parts, { type: mime })
}

export const writeLibraryText = (id: string, text: string) =>
  rpc<{ item: LibraryItem }>('library.write_text', { id, text }).then(r => r.item)

const asDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** New bytes for a saved file — an edited image. The earlier bytes stay in the file's versions. */
export const writeLibraryFile = async (id: string, blob: Blob) =>
  rpc<{ item: LibraryItem }>('library.write_file', { data_url: await asDataUrl(blob), id }).then(r => r.item)

/** One incoming file's answer: stored, already there (`skipped`), or waiting on a decision. */
export interface LibraryImportOutcome {
  conflict?: { item: LibraryItem; type: 'content' | 'name' } | null
  item?: LibraryItem | null
  skipped?: boolean
}

/** A local backend reads the file straight from disk; '' when the bytes must cross the socket. */
export const localPathOf = (file: File) =>
  !isDesktopFsRemoteMode() ? (window.hermesDesktop?.getPathForFile?.(file) ?? '') : ''

const UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024

function base64Of(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let text = ''

  for (let i = 0; i < view.length; i += 0x8000) {
    text += String.fromCharCode(...view.subarray(i, i + 0x8000))
  }

  return btoa(text)
}

export interface LibraryUploadOptions {
  onDuplicate?: LibraryOnDuplicate
  onProgress?: (fraction: number) => void
  parentId?: null | string
  signal?: AbortSignal
  /** A staged upload waiting on a duplicate answer: finish it instead of sending again. */
  stagedId?: string
}

/** Save a file into the Library. A local backend copies it by path; otherwise it crosses the socket
 *  in chunks (progress per chunk, abortable, retried chunks land once). With `onDuplicate: 'ask'` a
 *  collision comes back as `conflict` — and a staged upload keeps its bytes (`stagedId`) until the
 *  answer finishes it. */
export async function uploadLibraryFile(
  file: File,
  { onDuplicate = 'keep', onProgress, parentId, signal, stagedId }: LibraryUploadOptions = {}
): Promise<LibraryImportOutcome & { stagedId?: string }> {
  const target = { mime: file.type || undefined, on_duplicate: onDuplicate, parent_id: parentId || undefined }
  const path = localPathOf(file)

  if (path) {
    onProgress?.(0)
    const outcome = await rpc<LibraryImportOutcome>('library.import', { ...target, file_name: file.name, path })
    onProgress?.(1)

    return outcome
  }

  let uploadId = stagedId

  if (!uploadId) {
    uploadId = (
      await rpc<{ upload_id: string }>('library.upload_begin', {
        file_name: file.name,
        mime: file.type || undefined,
        size: file.size
      })
    ).upload_id

    try {
      for (let offset = 0; offset < file.size; offset += UPLOAD_CHUNK_BYTES) {
        signal?.throwIfAborted()
        const chunk = await file.slice(offset, offset + UPLOAD_CHUNK_BYTES).arrayBuffer()

        await rpc('library.upload_chunk', { data: base64Of(chunk), offset, upload_id: uploadId })
        onProgress?.(Math.min(1, (offset + chunk.byteLength) / Math.max(1, file.size)))
      }
    } catch (error) {
      void rpc('library.upload_abort', { upload_id: uploadId }).catch(() => undefined)
      throw error
    }
  }

  const outcome = await rpc<LibraryImportOutcome>('library.upload_finish', {
    ...target,
    file_name: file.name,
    upload_id: uploadId
  })

  return outcome.conflict ? { ...outcome, stagedId: uploadId } : outcome
}

export const abandonStagedUpload = (uploadId: string) =>
  rpc('library.upload_abort', { upload_id: uploadId }).catch(() => undefined)

/** Mirror a folder on the backend host (a local backend's disk) as a Library folder tree. */
export const importLibraryFolder = (path: string, parentId?: null | string) =>
  rpc<{ failed: string[]; folder: LibraryItem; imported: number; truncated: boolean }>('library.import_folder', {
    parent_id: parentId || undefined,
    path
  })

/** The page editor's embeds: stored beside whatever else shares the name, never asked about. */
export async function importLibraryFile(file: File, parentId?: string): Promise<LibraryItem> {
  const outcome = await uploadLibraryFile(file, { onDuplicate: 'keep', parentId })

  if (!outcome.item) {
    throw new Error('upload failed')
  }

  return outcome.item
}

/** Bumped whenever a Library write lands, so every mounted list refetches once. */
export const $libraryRevision = atom(0)

export const bumpLibraryRevision = () => $libraryRevision.set($libraryRevision.get() + 1)

export function formatBytes(size: null | number | undefined): string {
  if (!size) {
    return ''
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
