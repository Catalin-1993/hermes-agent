/** How a click edits the selection: replace it, toggle one, or extend from the anchor. */
export type SelectionGesture = 'range' | 'single' | 'toggle'

export function selectionGesture(event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }): SelectionGesture {
  if (event.shiftKey) {
    return 'range'
  }

  return event.metaKey || event.ctrlKey ? 'toggle' : 'single'
}

/** The selection after a gesture on `id`, given the visible order `ids` and the last anchor. A range
 *  spans anchor→id in visible order and adds to what is already selected (Finder semantics). */
export function nextSelection(
  current: ReadonlySet<string>,
  ids: readonly string[],
  id: string,
  gesture: SelectionGesture,
  anchor: null | string
): Set<string> {
  if (gesture === 'single') {
    return new Set([id])
  }

  if (gesture === 'toggle') {
    const next = new Set(current)

    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }

    return next
  }

  const from = anchor ? ids.indexOf(anchor) : -1
  const to = ids.indexOf(id)

  if (from < 0 || to < 0) {
    return new Set([...current, id])
  }

  const [start, end] = from < to ? [from, to] : [to, from]

  return new Set([...current, ...ids.slice(start, end + 1)])
}
