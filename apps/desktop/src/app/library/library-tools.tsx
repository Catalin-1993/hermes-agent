import { createContext, type RefObject, useContext } from 'react'

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

/**
 * All shown as the agent's memory (its graph and the memory at a glance) instead of the items. Each Library
 * view holds its own (the page and a split tile never flip each other), and it is a look on request, never
 * remembered: the Library always opens on its items, in the grid or list last chosen.
 */
export const LibraryMemoryContext = createContext<{ on: boolean; set: (on: boolean) => void } | null>(null)

/** All as the agent's memory: its graph beside the memory at a glance. Pressed while it shows. */
export function MemoryViewToggle() {
  const copy = useI18n().t.library
  const memory = useContext(LibraryMemoryContext)
  const on = Boolean(memory?.on)

  if (!memory) {
    return null
  }

  return (
    <Tip label={copy.view.memory}>
      <Button
        aria-label={copy.view.memory}
        aria-pressed={on}
        className={on ? 'bg-(--ui-control-hover-background) text-(--ui-text-primary)' : undefined}
        onClick={() => memory.set(!on)}
        size="icon-sm"
        variant="ghost"
      >
        <Codicon name="graph-scatter" size="0.9375rem" />
      </Button>
    </Tip>
  )
}

/** A view switch shows the view it would switch to. */
const VIEW_ICON = { grid: 'layout', list: 'list-flat' } as const

export function ViewToggle({ view }: { view: 'grid' | 'list' }) {
  const copy = useI18n().t.library
  const memory = useContext(LibraryMemoryContext)
  // From the memory view it goes back to the items, in the view they were last shown in.
  const other = memory?.on ? view : view === 'grid' ? 'list' : 'grid'

  return (
    <Tip label={copy.view[other]}>
      <Button
        aria-label={copy.view[other]}
        onClick={() => {
          memory?.set(false)
          setLibraryViewPrefs({ view: other })
        }}
        size="icon-sm"
        variant="ghost"
      >
        <Codicon name={VIEW_ICON[other]} size="0.9375rem" />
      </Button>
    </Tip>
  )
}
