import type { ChatGroup } from './chats-view'
import type { LibraryOrder, LibrarySort } from './data'
import { itemTypeOf } from './file-types'
import { type LibraryFilters, naturalOrder } from './library-prefs'

export interface ChatsArrangement {
  filters: LibraryFilters
  /** null: the sort's natural direction. */
  order: LibraryOrder | null
  query: string
  sort: LibrarySort
}

type Row = ChatGroup['items'][number]

const BY: Record<LibrarySort, (a: Row, b: Row) => number> = {
  created: (a, b) => a.created_at - b.created_at,
  kind: (a, b) => itemTypeOf(a).localeCompare(itemTypeOf(b)),
  name: (a, b) =>
    (a.title || a.file_name || '').localeCompare(b.title || b.file_name || '', undefined, { sensitivity: 'base' }),
  size: (a, b) => (a.size ?? 0) - (b.size ?? 0),
  updated: (a, b) => a.updated_at - b.updated_at
}

const matches = (item: Row, filters: LibraryFilters) =>
  (!filters.types.length || filters.types.includes(itemTypeOf(item))) &&
  (!filters.access.length || filters.access.includes(item.visibility)) &&
  (!filters.createdBy.length || filters.createdBy.includes(item.created_by === 'agent' ? 'agent' : 'user')) &&
  (!filters.tag || (item.tags ?? []).includes(filters.tag))

/** The chats view as the owner asked to see it: items filtered and sorted inside each chat, a chat kept
 *  when its own title or any item matches the search, and the chats themselves ordered by their newest
 *  (or, sorted by name, by title) remaining item. */
export function arrangeChats(
  groups: readonly ChatGroup[],
  { filters, order, query, sort }: ChatsArrangement,
  titleOf: (group: ChatGroup) => string
): ChatGroup[] {
  const direction = (order ?? naturalOrder(sort)) === 'asc' ? 1 : -1
  const needle = query.trim().toLowerCase()

  const kept = groups
    .map(group => {
      const chatMatches = needle !== '' && titleOf(group).toLowerCase().includes(needle)

      const items = group.items
        .filter(item => matches(item, filters))
        .filter(
          item =>
            !needle ||
            chatMatches ||
            `${item.title} ${item.file_name ?? ''} ${item.excerpt ?? ''}`.toLowerCase().includes(needle)
        )
        .sort((a, b) => direction * BY[sort](a, b))

      return { ...group, items }
    })
    .filter(group => group.items.length > 0)

  const newest = (group: ChatGroup) => group.items.reduce((latest, item) => Math.max(latest, item.updated_at), 0)

  return kept.sort((a, b) =>
    sort === 'name'
      ? direction * titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: 'base' })
      : direction * (newest(a) - newest(b))
  )
}
