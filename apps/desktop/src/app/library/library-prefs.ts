import { persistentAtom } from '@/lib/persisted'

import type { LibraryOrder, LibrarySort, LibraryVisibility } from './data'
import type { LibraryItemType } from './file-types'

export interface LibraryViewPrefs {
  /** null: the sort's natural direction (names A→Z, dates newest first). */
  order: LibraryOrder | null
  sort: LibrarySort
  view: 'grid' | 'list'
  /** The Info panel beside the listing (⌘I). */
  inspector?: boolean
}

/** How this person likes to look at the Library: one preference for the window, remembered. */
export const $libraryViewPrefs = persistentAtom<LibraryViewPrefs>('hermes.desktop.library.view.v1', {
  order: null,
  sort: 'updated',
  view: 'list'
})

export function setLibraryViewPrefs(patch: Partial<LibraryViewPrefs>) {
  $libraryViewPrefs.set({ ...$libraryViewPrefs.get(), ...patch })
}

export interface LibraryFilters {
  access: readonly LibraryVisibility[]
  createdBy: readonly ('agent' | 'user')[]
  /** One tag, Finder-style: everything wearing it, anywhere in the Library. */
  tag: null | string
  types: readonly LibraryItemType[]
}

export const NO_FILTERS: LibraryFilters = { access: [], createdBy: [], tag: null, types: [] }

export const activeFilterCount = (filters: LibraryFilters) =>
  filters.access.length + filters.createdBy.length + filters.types.length + (filters.tag ? 1 : 0)

export const naturalOrder = (sort: LibrarySort): LibraryOrder => (sort === 'name' || sort === 'kind' ? 'asc' : 'desc')
