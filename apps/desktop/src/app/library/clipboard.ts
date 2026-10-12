import { atom } from 'nanostores'

export interface LibraryClipboard {
  ids: readonly string[]
  /** `cut` moves on paste (and empties the clipboard); `copy` duplicates, as often as pasted. */
  mode: 'copy' | 'cut'
}

/** Items taken with ⌘C / ⌘X, waiting for ⌘V — this window's Library clipboard, not the OS one. */
export const $libraryClipboard = atom<LibraryClipboard | null>(null)
