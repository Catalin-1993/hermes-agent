/** What a key does in the Library listing — Finder's keys, as data. */
export type LibraryKeyAction =
  | 'clearSelection'
  | 'copy'
  | 'cut'
  | 'duplicate'
  | 'info'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'moveUp'
  | 'open'
  | 'parent'
  | 'paste'
  | 'quickLook'
  | 'rename'
  | 'selectAll'
  | 'trash'

const WITH_COMMAND: Record<string, LibraryKeyAction> = {
  a: 'selectAll',
  arrowdown: 'open',
  arrowup: 'parent',
  backspace: 'trash',
  c: 'copy',
  i: 'info',
  v: 'paste',
  x: 'cut'
}

// ⌘D is the app's "default profile" chord (global, captured first), so Duplicate takes ⇧⌘D.
const WITH_COMMAND_SHIFT: Record<string, LibraryKeyAction> = { d: 'duplicate' }

const PLAIN: Record<string, LibraryKeyAction> = {
  ' ': 'quickLook',
  arrowdown: 'moveDown',
  arrowleft: 'moveLeft',
  arrowright: 'moveRight',
  arrowup: 'moveUp',
  backspace: 'trash',
  delete: 'trash',
  enter: 'open',
  escape: 'clearSelection',
  f2: 'rename'
}

export function libraryKeyAction(
  event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>
): LibraryKeyAction | null {
  if (event.altKey) {
    return null
  }

  const key = event.key.toLowerCase()

  if (event.metaKey || event.ctrlKey) {
    return (event.shiftKey ? WITH_COMMAND_SHIFT : WITH_COMMAND)[key] ?? null
  }

  return PLAIN[key] ?? null
}

/** How many cards share the gallery's first row — what ↑ / ↓ step by. */
export function gridColumns(root: null | ParentNode): number {
  const cards = root ? Array.from(root.querySelectorAll<HTMLElement>('[data-library-card]')) : []
  const top = cards[0]?.offsetTop
  const wrap = cards.findIndex(card => card.offsetTop !== top)

  return wrap < 0 ? Math.max(1, cards.length) : wrap
}
