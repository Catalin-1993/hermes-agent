import { useStore } from '@nanostores/react'
import type { Dispatch, SetStateAction } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  dropdownMenuSectionLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

import { ACCESS_META, ACCESS_ORDER } from './access'
import type { LibraryOrder, LibrarySort } from './data'
import { FILTER_TYPES, ITEM_TYPE_ICON, ITEM_TYPE_TINT } from './file-types'
import {
  activeFilterCount,
  type LibraryFilters,
  type LibraryViewPrefs,
  NO_FILTERS,
  setLibraryViewPrefs
} from './library-prefs'
import { $libraryTags, TAG_COLORS } from './organize'

const SORTS = ['updated', 'created', 'name', 'size', 'kind'] as const

/** A menu's two halves, told apart: the heading is the larger step above the groups it holds. */
const HEADING_CLASS =
  'px-2.5 pt-1.5 pb-1 text-[0.6875rem] font-semibold tracking-[0.05em] text-(--ui-text-tertiary) uppercase'

interface SortFilterMenuProps {
  filters: LibraryFilters
  /** The direction in force: the chosen one, or the sort's natural one. */
  order: LibraryOrder
  prefs: LibraryViewPrefs
  setFilters: Dispatch<SetStateAction<LibraryFilters>>
  /** Recents are always newest first, so there is nothing to sort there. */
  sortable: boolean
}

/** One menu for what the listing shows and in what order: Sort first, then Filter. */
export function SortFilterMenu({ filters, order, prefs, setFilters, sortable }: SortFilterMenuProps) {
  const { t } = useI18n()
  const copy = t.library
  const ws = copy.workspace
  const tags = useStore($libraryTags)
  const count = activeFilterCount(filters)

  const toggle = <K extends 'access' | 'createdBy' | 'types'>(key: K, value: LibraryFilters[K][number]) =>
    setFilters(current => {
      const list = current[key] as readonly unknown[]

      return { ...current, [key]: list.includes(value) ? list.filter(entry => entry !== value) : [...list, value] }
    })

  return (
    <DropdownMenu>
      <Tip label={ws.sortAndFilter}>
        <DropdownMenuTrigger asChild>
          <Button aria-label={ws.sortAndFilter} className="relative" size="icon-sm" variant="ghost">
            <Codicon name="list-filter" size="0.9375rem" />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 grid size-3.5 place-items-center rounded-full bg-(--ui-accent) text-[0.5625rem] font-semibold text-white">
                {count}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="end" className="max-h-[70vh] min-w-56 overflow-y-auto">
        {sortable && (
          <>
            <DropdownMenuLabel className={HEADING_CLASS}>{ws.sort.label}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              onValueChange={value => setLibraryViewPrefs({ order: null, sort: value as LibrarySort })}
              value={prefs.sort}
            >
              {SORTS.map(sort => (
                <DropdownMenuRadioItem key={sort} value={sort}>
                  {ws.sort[sort]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              onValueChange={value => setLibraryViewPrefs({ order: value as LibraryOrder })}
              value={order}
            >
              <DropdownMenuRadioItem value="asc">{ws.sort.asc}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">{ws.sort.desc}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator className="my-1.5" />
          </>
        )}
        <DropdownMenuLabel className={HEADING_CLASS}>{ws.filter.label}</DropdownMenuLabel>
        <DropdownMenuLabel className={dropdownMenuSectionLabel}>{ws.filter.type}</DropdownMenuLabel>
        {FILTER_TYPES.map(type => (
          <DropdownMenuCheckboxItem
            checked={filters.types.includes(type)}
            key={type}
            onCheckedChange={() => toggle('types', type)}
            onSelect={event => event.preventDefault()}
          >
            <Codicon name={ITEM_TYPE_ICON[type]} size="0.8125rem" style={{ color: ITEM_TYPE_TINT[type] }} />
            {copy.types[type]}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className={dropdownMenuSectionLabel}>{ws.filter.access}</DropdownMenuLabel>
        {ACCESS_ORDER.map(level => (
          <DropdownMenuCheckboxItem
            checked={filters.access.includes(level)}
            key={level}
            onCheckedChange={() => toggle('access', level)}
            onSelect={event => event.preventDefault()}
          >
            <Codicon className={ACCESS_META[level].tone} name={ACCESS_META[level].icon} size="0.8125rem" />
            {copy.access[level]}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className={dropdownMenuSectionLabel}>{ws.filter.createdBy}</DropdownMenuLabel>
        {(['user', 'agent'] as const).map(who => (
          <DropdownMenuCheckboxItem
            checked={filters.createdBy.includes(who)}
            key={who}
            onCheckedChange={() => toggle('createdBy', who)}
            onSelect={event => event.preventDefault()}
          >
            <Codicon name={who === 'agent' ? 'robot' : 'account'} size="0.8125rem" />
            {who === 'agent' ? ws.filter.hermes : ws.filter.you}
          </DropdownMenuCheckboxItem>
        ))}
        {tags.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className={dropdownMenuSectionLabel}>{copy.organize.tag}</DropdownMenuLabel>
            {tags.map(tag => (
              <DropdownMenuCheckboxItem
                checked={filters.tag?.toLowerCase() === tag.name.toLowerCase()}
                key={tag.name}
                onCheckedChange={() =>
                  setFilters(current => ({
                    ...current,
                    tag: current.tag?.toLowerCase() === tag.name.toLowerCase() ? null : tag.name
                  }))
                }
                onSelect={event => event.preventDefault()}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: TAG_COLORS[tag.color] }} />
                {tag.name}
                <span className="ml-auto text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)">{tag.count}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setFilters(NO_FILTERS)}>
              <Codicon name="clear-all" size="0.8125rem" />
              {ws.filter.clear}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
