import { atom } from 'nanostores'

/** What the open Library item can show Hermes as a picture: a presentation's current slide. The open
 *  item registers it while it is on screen; the `library.snapshot` request (the agent's `view` with
 *  `look`) calls it. Null when nothing drawable is open. */
export interface LibrarySnapshotSource {
  itemId: string
  /** A PNG data URL of what is on screen; `slide` is a 1-based slide number when the agent named one. */
  take: (slide?: number) => Promise<null | string>
}

export const $librarySnapshot = atom<LibrarySnapshotSource | null>(null)
