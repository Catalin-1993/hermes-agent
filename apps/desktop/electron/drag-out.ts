import fs from 'node:fs'
import path from 'node:path'

/**
 * Library files dragged out to Finder / other apps (⌥-drag in the Library). Stored files carry
 * internal names (`fl_….pdf`), so each goes out as a hard link (a copy across volumes) named as the
 * user knows it, in a private temp folder swept on later drags.
 */

export interface DragOutItem {
  name: string
  path: string
}

export interface DragOutDeps {
  /** The audited reader's resolver: a readable, non-sensitive local file, or a throw. */
  resolveFile: (rawPath: string) => Promise<string>
  tempRoot: string
}

const MAX_ITEMS = 200
// Drags finish in seconds; anything older is a leftover.
const STALE_MS = 10 * 60 * 1000

/** A display name safe as one path segment. */
export function dragOutName(name: unknown, fallback: string): string {
  const cleaned = path
    .basename(String(name ?? ''))
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:\u0000-\u001f]/g, '_')
    .trim()

  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : fallback
}

async function sweep(root: string): Promise<void> {
  const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])
  const now = Date.now()

  await Promise.all(
    entries.map(async entry => {
      const full = path.join(root, entry.name)
      const stat = await fs.promises.stat(full).catch(() => null)

      if (stat && now - stat.mtimeMs > STALE_MS) {
        await fs.promises.rm(full, { force: true, recursive: true })
      }
    })
  )
}

/** The files to hand to `webContents.startDrag`, named for the user; unreadable entries are skipped. */
export async function prepareDragOut(items: unknown, deps: DragOutDeps): Promise<string[]> {
  const list = (Array.isArray(items) ? items : []).slice(0, MAX_ITEMS) as Partial<DragOutItem>[]

  if (!list.length) {
    return []
  }

  await fs.promises.mkdir(deps.tempRoot, { recursive: true })
  await sweep(deps.tempRoot)

  const batch = await fs.promises.mkdtemp(path.join(deps.tempRoot, 'drag-'))
  const files: string[] = []

  for (const item of list) {
    let source: string

    try {
      source = await deps.resolveFile(String(item?.path ?? ''))
    } catch {
      continue
    }

    // One folder per file: two items may share a display name.
    const slot = await fs.promises.mkdtemp(path.join(batch, 'f-'))
    const target = path.join(slot, dragOutName(item?.name, path.basename(source)))

    try {
      await fs.promises.link(source, target)
    } catch {
      await fs.promises.copyFile(source, target)
    }

    files.push(target)
  }

  return files
}
