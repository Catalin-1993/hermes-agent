import { useEffect, useState } from 'react'

import { type LibraryItem, listLibrary } from '@/app/library/data'
import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'

const SEARCH_DEBOUNCE_MS = 160
const MAX_PAGES = 60

interface WidgetPagePickerProps {
  /** `null` is "a new page". */
  onPick: (page: LibraryItem | null) => void
}

const ROW =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-(--ui-text-primary) transition-colors hover:bg-(--ui-row-hover-background)'

/** Where a widget goes in the Library: a new page, or the end of one of the owner's pages (newest first). */
export function WidgetPagePicker({ onPick }: WidgetPagePickerProps) {
  const { t } = useI18n()
  const copy = t.inlineWidget
  const [query, setQuery] = useState('')
  const [pages, setPages] = useState<LibraryItem[] | null>(null)

  useEffect(() => {
    let live = true

    const timer = window.setTimeout(
      () =>
        listLibrary({ kind: 'page', query: query.trim() || undefined, sort: 'updated' }).then(
          ({ items }) => live && setPages(items.slice(0, MAX_PAGES)),
          () => live && setPages([])
        ),
      query ? SEARCH_DEBOUNCE_MS : 0
    )

    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [query])

  return (
    <div className="flex flex-col gap-1 p-1.5">
      <input
        aria-label={copy.pickerSearch}
        autoFocus
        className="h-8 rounded-lg border border-(--ui-stroke-tertiary) bg-transparent px-2.5 text-sm outline-none focus:border-(--ui-accent)"
        onChange={event => setQuery(event.target.value)}
        placeholder={copy.pickerSearch}
        value={query}
      />
      <button className={ROW} onClick={() => onPick(null)} type="button">
        <Codicon className="text-(--ui-accent)" name="add" size="0.875rem" />
        {copy.pickerNew}
      </button>
      <ul className="m-0 max-h-56 list-none overflow-y-auto p-0">
        {pages === null ? (
          <li className="grid place-items-center py-4">
            <Loader />
          </li>
        ) : pages.length === 0 ? (
          <li className="py-3 text-center text-[0.8125rem] text-(--ui-text-tertiary)">{copy.pickerEmpty}</li>
        ) : (
          pages.map(page => (
            <li key={page.id}>
              <button className={ROW} onClick={() => onPick(page)} type="button">
                <Codicon className="text-(--ui-text-tertiary)" name="file" size="0.875rem" />
                <span className="min-w-0 flex-1 truncate">{page.title || t.library.untitled}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
