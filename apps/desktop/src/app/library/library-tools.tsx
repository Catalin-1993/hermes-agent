import type { RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { SearchField } from '@/components/ui/search-field'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

import { setLibraryViewPrefs } from './library-prefs'

/** The Library header's tools that every view shares — search, and the list/grid switch — so a view
 *  added later cannot go without them. (Sort and filter are `SortFilterMenu`.) */

interface SearchToolProps {
  inputRef?: RefObject<HTMLInputElement | null>
  onOpenChange: (open: boolean) => void
  onQueryChange: (query: string) => void
  open: boolean
  query: string
}

/** A search icon that opens into a field, and folds back when it is left empty. */
export function SearchTool({ inputRef, onOpenChange, onQueryChange, open, query }: SearchToolProps) {
  const copy = useI18n().t.library

  if (open || query) {
    return (
      <div
        onBlur={event => {
          if (!query && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
            onOpenChange(false)
          }
        }}
      >
        <SearchField
          containerClassName="w-48"
          inputRef={inputRef}
          onChange={onQueryChange}
          onClear={() => onOpenChange(false)}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              onQueryChange('')
              onOpenChange(false)
            }
          }}
          placeholder={copy.searchPlaceholder}
          value={query}
        />
      </div>
    )
  }

  return (
    <Tip label={copy.searchPlaceholder}>
      <Button aria-label={copy.searchPlaceholder} onClick={() => onOpenChange(true)} size="icon-sm" variant="ghost">
        <Codicon name="search" size="0.9375rem" />
      </Button>
    </Tip>
  )
}

/** A view switch shows the view it would switch to. */
const VIEW_ICON = { grid: 'layout', list: 'list-flat' } as const

export function ViewToggle({ view }: { view: 'grid' | 'list' }) {
  const copy = useI18n().t.library
  const other = view === 'grid' ? 'list' : 'grid'

  return (
    <Tip label={copy.view[other]}>
      <Button
        aria-label={copy.view[other]}
        onClick={() => setLibraryViewPrefs({ view: other })}
        size="icon-sm"
        variant="ghost"
      >
        <Codicon name={VIEW_ICON[other]} size="0.9375rem" />
      </Button>
    </Tip>
  )
}
