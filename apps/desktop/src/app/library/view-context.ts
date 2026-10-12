import { requestGatewayForProfile } from '@/store/gateway'
import { $activeGatewayProfile } from '@/store/profile'

/** What the owner has on screen in the Library — the item, the slide in it, a selection — told to the
 *  backend as it changes, so Hermes can look at the same thing ("this slide") without guessing. The
 *  agent reads it fresh through the library tool's `view`; nothing is added to what it is sent. */

interface LibraryView {
  itemId: null | string
  selection: null | string
  slide: null | number
}

const IDLE_MS = 250

let view: LibraryView = { itemId: null, selection: null, slide: null }
let timer: null | number = null

const send = () => {
  timer = null

  void requestGatewayForProfile($activeGatewayProfile.get(), 'library.set_view', {
    item_id: view.itemId,
    selection: view.selection,
    slide: view.slide
  }).catch(() => undefined)
}

/** Change part of what is on screen; the whole is sent a moment after the last change. */
export function setLibraryView(patch: Partial<LibraryView>) {
  view = { ...view, ...patch }

  if (timer !== null) {
    window.clearTimeout(timer)
  }

  timer = window.setTimeout(send, IDLE_MS)
}

/** Nothing of the Library is on screen any more. */
export function clearLibraryView() {
  setLibraryView({ itemId: null, selection: null, slide: null })
}
