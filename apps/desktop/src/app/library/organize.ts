import { atom } from 'nanostores'

import {
  type LibraryItem,
  type LibrarySavedQuery,
  type LibrarySavedSearch,
  type LibraryTagColor,
  type LibraryTagInfo,
  listLibraryTags,
  listSavedSearches
} from './data'

/** The seven Finder colours, on the theme's own hues. */
export const TAG_COLORS: Record<LibraryTagColor, string> = {
  blue: 'var(--ui-blue)',
  gray: 'var(--ui-text-tertiary)',
  green: 'var(--ui-green)',
  orange: 'var(--ui-orange)',
  purple: 'var(--ui-purple)',
  red: 'var(--ui-red)',
  yellow: 'var(--ui-yellow)'
}

export const TAG_ORDER: readonly LibraryTagColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']

/** The tag registry (backend truth), refreshed once per Library change by the Library view. */
export const $libraryTags = atom<readonly LibraryTagInfo[]>([])

export const refreshLibraryTags = () =>
  listLibraryTags().then(
    tags => $libraryTags.set(tags),
    () => undefined
  )

/** Saved searches ("smart folders"), and the one the listing is showing. */
export const $savedSearches = atom<readonly LibrarySavedSearch[]>([])
export const $activeSavedSearch = atom<null | string>(null)

export const refreshSavedSearches = () =>
  listSavedSearches().then(
    searches => $savedSearches.set(searches),
    () => undefined
  )

export type OrganizeDialog =
  | { kind: 'manageTags' }
  | { ids: readonly string[]; kind: 'newTag' }
  | { kind: 'saveSearch'; query: LibrarySavedQuery }
  | { item: LibraryItem; kind: 'versions'; onRestored?: (item: LibraryItem) => void }

/** The organizing dialog open over the Library, if any (one host renders them all). */
export const $organizeDialog = atom<null | OrganizeDialog>(null)
