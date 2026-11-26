/**
 * Brain: a page can lend itself the titlebar's back / forward arrows while it is on screen — the Whiteboard uses
 * them as Undo / Redo. Everywhere else, and the moment that page unmounts, the arrows walk the app's history again.
 * One claim at a time; the newest wins and only its own release clears it.
 */

import { atom } from 'nanostores'

export interface HistoryArrows {
  back: () => void
  backLabel?: string
  canBack: boolean
  canForward: boolean
  forward: () => void
  forwardLabel?: string
}

export const $historyArrows = atom<HistoryArrows | null>(null)

/** Claim the arrows; call again to update them (e.g. when undo becomes possible); the returned function releases. */
export function claimHistoryArrows(arrows: HistoryArrows): () => void {
  $historyArrows.set(arrows)

  return () => {
    if ($historyArrows.get() === arrows) {
      $historyArrows.set(null)
    }
  }
}
