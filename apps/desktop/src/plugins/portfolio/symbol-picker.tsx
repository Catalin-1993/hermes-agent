/**
 * Choosing one coin or stock, TradingView style: one compact button showing the current symbol, which
 * opens a search over the owner's watched symbols (all, coins, or stocks) and offers to open any other
 * symbol typed in, as a coin or as a stock. Arrow keys move, Enter opens, Esc closes. Shared by Research
 * and Backtesting.
 */

import { cn, Codicon, Popover, PopoverContent, PopoverTrigger, useQuery } from '@hermes/plugin-sdk'
import { type KeyboardEvent, useState } from 'react'

import { fetchWatchlists, type WatchKind, watchlistKey } from './api'
import { AssetIcon } from './asset-icon'
import { COPY } from './copy'
import { Segmented } from './segmented'
import { BTN } from './ui'

/** Every symbol in the watchlists, once each, in list order. */
export function useWatchedSymbols(): Pick[] {
  const { data } = useQuery({ queryFn: fetchWatchlists, queryKey: watchlistKey })
  const all = (data?.lists ?? []).flatMap(list => list.symbols.map(symbol => ({ kind: list.kind, symbol })))

  return all.filter(
    (pick, index) => all.findIndex(other => other.symbol === pick.symbol && other.kind === pick.kind) === index
  )
}

export interface Pick {
  kind: WatchKind
  symbol: string
}

type Filter = 'all' | WatchKind

const KIND_LABEL: Record<WatchKind, string> = { crypto: COPY.research.sheet.crypto, stocks: COPY.research.sheet.stock }

const samePick = (a: null | Pick, b: Pick) => a?.symbol === b.symbol && a.kind === b.kind

/** What the list shows for a search: the watched symbols that match, then "open it" rows for a new one. */
export function pickerRows(suggestions: Pick[], query: string, filter: Filter): { pick: Pick; typed: boolean }[] {
  const needle = query.trim().toUpperCase().replace(/\s+/g, '')
  const shown = suggestions.filter(pick => (filter === 'all' || pick.kind === filter) && pick.symbol.includes(needle))
  const valid = /^[A-Z0-9.\-=^]{1,15}$/.test(needle)
  const kinds: WatchKind[] = filter === 'all' ? ['crypto', 'stocks'] : [filter]

  const typed = valid
    ? kinds
        .filter(kind => !shown.some(pick => pick.symbol === needle && pick.kind === kind))
        .map(kind => ({ kind, symbol: needle }))
    : []

  return [...shown.map(pick => ({ pick, typed: false })), ...typed.map(pick => ({ pick, typed: true }))]
}

export function SymbolPicker({
  current,
  onPick,
  suggestions
}: {
  current: null | Pick
  onPick: (pick: Pick) => void
  suggestions: Pick[]
}) {
  const copy = COPY.research.picker
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [cursor, setCursor] = useState(0)
  const rows = pickerRows(suggestions, query, filter)
  const at = Math.min(cursor, Math.max(rows.length - 1, 0))

  const choose = (pick: Pick) => {
    onPick(pick)
    setOpen(false)
    setQuery('')
    setCursor(0)
  }

  const onKey = (event: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]

    if (step) {
      event.preventDefault()
      setCursor((at + step + rows.length) % Math.max(rows.length, 1))
    } else if (event.key === 'Enter' && rows[at]) {
      event.preventDefault()
      choose(rows[at].pick)
    }
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={copy.label}
          className={cn(BTN, 'h-[38px] w-fit gap-2 rounded-xl py-0 pr-3 pl-1')}
          data-portfolio-symbol-picker=""
          type="button"
        >
          {current ? (
            <>
              <span className="grid size-[28px] place-items-center rounded-[9px] bg-(--card-surface)">
                <AssetIcon kind={current.kind} size={18} symbol={current.symbol} />
              </span>
              <span className="text-[0.9375rem] font-semibold text-(--ui-text-primary)">{current.symbol}</span>
              <span className="text-[0.8125rem] font-normal text-(--ui-text-tertiary)">{KIND_LABEL[current.kind]}</span>
            </>
          ) : (
            <span className="pl-2 text-[0.8125rem] text-(--ui-text-tertiary)">{copy.choose}</span>
          )}
          <Codicon className="text-(--ui-text-tertiary)" name="chevron-down" size="1rem" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[min(22rem,92vw)] flex-col gap-2 p-2">
        <div className="flex items-center gap-2 rounded-lg bg-(--card-well) px-2.5">
          <Codicon className="text-(--ui-text-tertiary)" name="search" size="0.85rem" />
          <input
            aria-label={copy.search}
            autoFocus
            className="h-9 min-w-0 flex-1 bg-transparent text-[0.8125rem] text-(--ui-text-primary) uppercase placeholder:normal-case placeholder:text-(--ui-text-tertiary) focus:outline-none"
            maxLength={15}
            onChange={event => {
              setQuery(event.target.value)
              setCursor(0)
            }}
            onKeyDown={onKey}
            placeholder={copy.placeholder}
            value={query}
          />
        </div>
        <Segmented
          label={copy.kind}
          onSelect={next => {
            setFilter(next)
            setCursor(0)
          }}
          options={[
            { id: 'all', text: copy.all },
            { id: 'crypto', text: COPY.lists.kinds.crypto },
            { id: 'stocks', text: COPY.lists.kinds.stocks }
          ]}
          value={filter}
        />
        <ul className="-mx-0.5 flex max-h-72 flex-col overflow-y-auto" role="listbox">
          {rows.map(({ pick, typed }, index) => (
            <li
              aria-selected={index === at}
              key={`${typed ? 'new' : 'watched'}:${pick.kind}:${pick.symbol}`}
              role="option"
            >
              <button
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left',
                  index === at ? 'bg-(--card-well)' : 'hover:bg-(--card-well)'
                )}
                onClick={() => choose(pick)}
                onMouseEnter={() => setCursor(index)}
                type="button"
              >
                {typed ? (
                  <span className="grid size-7 place-items-center rounded-full bg-(--card-well) text-(--ui-text-tertiary)">
                    <Codicon name="add" size="0.8rem" />
                  </span>
                ) : (
                  <AssetIcon kind={pick.kind} size={28} symbol={pick.symbol} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">
                    {typed ? copy.open(pick.symbol) : pick.symbol}
                  </span>
                  <span className="block text-[0.6875rem] text-(--ui-text-tertiary)">{KIND_LABEL[pick.kind]}</span>
                </span>
                {samePick(current, pick) && !typed && (
                  <Codicon className="text-(--ui-text-secondary)" name="check" size="0.85rem" />
                )}
              </button>
            </li>
          ))}
          {!rows.length && (
            <li className="px-2 py-6 text-center text-[0.75rem] text-(--ui-text-tertiary)">{copy.none}</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
