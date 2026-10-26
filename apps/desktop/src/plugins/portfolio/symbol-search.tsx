/**
 * The symbol search, TradingView style: a box that finds any coin Binance quotes in USDT as you type, your
 * watched symbols first, and offers to open any other symbol typed in as a stock or ETF. Opens from the
 * symbol's name at the top left of the chart, and from Compare. Arrow keys move, Enter picks, Esc closes.
 */

import { cn, Codicon, Popover, PopoverContent, PopoverTrigger, useQuery } from '@hermes/plugin-sdk'
import { type KeyboardEvent, type ReactNode, useMemo, useState } from 'react'

import { type WatchKind } from './api'
import { AssetIcon } from './asset-icon'
import { COPY } from './copy'
import { fetchCryptoSymbols } from './market-feed'
import { Segmented } from './segmented'
import { type Pick, useWatchedSymbols } from './symbol-picker'

type Filter = 'all' | WatchKind

interface Row {
  pick: Pick
  /** Where it came from: a symbol the owner watches, any listed coin, or one typed in. */
  source: 'listed' | 'typed' | 'watched'
}

const MAX_LISTED = 40

const samePick = (a: null | Pick | undefined, b: Pick) => a?.symbol === b.symbol && a.kind === b.kind

/** The rows for a search: watched symbols that match, then listed coins (names starting with it first),
 *  then — for something that looks like a ticker — "open it as a stock". Pure, so it is tested. */
export function searchRows(watched: Pick[], coins: string[] | undefined, query: string, filter: Filter): Row[] {
  const needle = query.trim().toUpperCase().replace(/\s+/g, '')
  const wants = (kind: WatchKind) => filter === 'all' || filter === kind

  const mine = watched
    .filter(pick => wants(pick.kind) && pick.symbol.includes(needle))
    .map((pick): Row => ({ pick, source: 'watched' }))

  const has = (kind: WatchKind, symbol: string) =>
    mine.some(row => row.pick.kind === kind && row.pick.symbol === symbol)

  const listed =
    wants('crypto') && needle && coins
      ? coins
          .filter(symbol => symbol.includes(needle) && !has('crypto', symbol))
          .sort((a, b) => Number(b.startsWith(needle)) - Number(a.startsWith(needle)) || a.length - b.length)
          .slice(0, MAX_LISTED)
          .map((symbol): Row => ({ pick: { kind: 'crypto', symbol }, source: 'listed' }))
      : []

  const valid = /^[A-Z0-9.\-=^]{1,15}$/.test(needle)
  const typed: Row[] = []

  if (valid && wants('stocks') && !has('stocks', needle)) {
    typed.push({ pick: { kind: 'stocks', symbol: needle }, source: 'typed' })
  }

  // With no coin list (offline) a typed ticker can still be tried as a coin.
  if (valid && wants('crypto') && !coins && !has('crypto', needle)) {
    typed.push({ pick: { kind: 'crypto', symbol: needle }, source: 'typed' })
  }

  return [...mine, ...listed, ...typed]
}

const KIND_LABEL: Record<WatchKind, string> = { crypto: COPY.research.sheet.crypto, stocks: COPY.research.sheet.stock }

export function SymbolSearch({
  align = 'start',
  children,
  current,
  onPick,
  title
}: {
  align?: 'center' | 'end' | 'start'
  /** The button that opens it. */
  children: ReactNode
  current?: null | Pick
  onPick: (pick: Pick) => void
  title: string
}) {
  const copy = COPY.studio.symbolSearch
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [cursor, setCursor] = useState(0)
  const watched = useWatchedSymbols()

  const { data: coins } = useQuery({
    enabled: open,
    queryFn: ({ signal }) => fetchCryptoSymbols(signal),
    queryKey: ['portfolio', 'crypto-symbols'],
    retry: 1,
    staleTime: 3_600_000
  })

  const rows = useMemo(() => searchRows(watched, coins, query, filter), [watched, coins, query, filter])
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
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="flex w-[min(26rem,94vw)] flex-col gap-2.5 p-3" data-portfolio-search="">
        <div className="text-[0.9375rem] font-medium text-(--ui-text-primary)">{title}</div>
        <div className="flex items-center gap-2 rounded-lg bg-(--card-well) px-2.5">
          <Codicon className="text-(--ui-text-tertiary)" name="search" size="0.9rem" />
          <input
            aria-label={copy.label}
            autoFocus
            className="h-10 min-w-0 flex-1 bg-transparent text-[0.875rem] text-(--ui-text-primary) uppercase placeholder:normal-case placeholder:text-(--ui-text-tertiary) focus:outline-none"
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
            { id: 'all', text: COPY.research.picker.all },
            { id: 'crypto', text: COPY.lists.kinds.crypto },
            { id: 'stocks', text: COPY.lists.kinds.stocks }
          ]}
          value={filter}
        />
        <ul className="-mx-1 flex max-h-80 flex-col overflow-y-auto" role="listbox">
          {rows.map(({ pick, source }, index) => (
            <li aria-selected={index === at} key={`${source}:${pick.kind}:${pick.symbol}`} role="option">
              <button
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left',
                  index === at ? 'bg-(--card-well)' : 'hover:bg-(--card-well)'
                )}
                onClick={() => choose(pick)}
                onMouseEnter={() => setCursor(index)}
                type="button"
              >
                <AssetIcon kind={pick.kind} size={28} symbol={pick.symbol} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.875rem] font-semibold text-(--ui-text-primary)">
                    {pick.kind === 'crypto' ? `${pick.symbol} / USDT` : pick.symbol}
                  </span>
                  <span className="block text-[0.71875rem] text-(--ui-text-tertiary)">
                    {source === 'typed' ? copy.openAs(KIND_LABEL[pick.kind]) : copy.exchange[pick.kind]}
                  </span>
                </span>
                {source === 'watched' && (
                  <Codicon
                    aria-label={copy.watched}
                    className="text-(--ui-text-quaternary)"
                    name="star-full"
                    size="0.8rem"
                  />
                )}
                {samePick(current, pick) && (
                  <Codicon className="text-(--ui-text-secondary)" name="check" size="0.9rem" />
                )}
              </button>
            </li>
          ))}
          {!rows.length && (
            <li className="px-2 py-8 text-center text-[0.8125rem] text-(--ui-text-tertiary)">
              {query ? copy.none : copy.start}
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
