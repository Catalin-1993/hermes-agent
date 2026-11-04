/**
 * The files of a project's Knowledge: copied into `<project folder>/knowledge/` so the project owns them (they
 * travel with the folder and stay if the original moves). Copying goes through the managed-files API of the backend,
 * which writes bytes and creates the folder, on this computer or the connected one alike.
 */

import { hermesApi } from '@/api/client'
import {
  isDesktopFsRemoteMode,
  readDesktopDir,
  readDesktopFileDataUrlLocalFirst,
  trashDesktopPath
} from '@/lib/desktop-fs'

import { joinPath, KNOWLEDGE_DIR, uniqueName } from './project-notes-model'

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path

/** Names of the files on the project's knowledge shelf, sorted; none when the folder is not there yet. */
export async function listKnowledgeFiles(folder: string): Promise<string[]> {
  try {
    const { entries } = await readDesktopDir(joinPath(folder, KNOWLEDGE_DIR))

    return entries
      .filter(entry => !entry.isDirectory && !entry.name.startsWith('.'))
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

export interface AddFilesResult {
  added: string[]
  failed: { error: string; name: string }[]
}

/** Copies each picked file onto the shelf under a free name; one that fails does not stop the others. */
export async function addKnowledgeFiles(
  folder: string,
  picked: readonly string[],
  existing: readonly string[],
  onProgress?: (done: number, total: number) => void
): Promise<AddFilesResult> {
  const taken = new Set(existing)
  const result: AddFilesResult = { added: [], failed: [] }

  for (const [at, path] of picked.entries()) {
    onProgress?.(at, picked.length)

    const source = baseName(path)
    const name = uniqueName(source, taken)

    try {
      const dataUrl = await readDesktopFileDataUrlLocalFirst(path)

      await hermesApi({
        body: { data_url: dataUrl, overwrite: false, path: joinPath(joinPath(folder, KNOWLEDGE_DIR), name) },
        method: 'POST',
        path: '/api/files/upload'
      })
      taken.add(name)
      result.added.push(name)
    } catch (error) {
      result.failed.push({ error: error instanceof Error ? error.message : String(error), name: source })
    }
  }

  onProgress?.(picked.length, picked.length)

  return result
}

/** Takes a file off the shelf: to the trash on this computer (recoverable), deleted on a connected backend. */
export async function removeKnowledgeFile(folder: string, name: string): Promise<void> {
  const path = joinPath(joinPath(folder, KNOWLEDGE_DIR), name)

  if (isDesktopFsRemoteMode()) {
    await hermesApi({ body: { path }, method: 'DELETE', path: '/api/files' })

    return
  }

  await trashDesktopPath(path)
}
