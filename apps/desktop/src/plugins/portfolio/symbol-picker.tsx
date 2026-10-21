/** Choosing one coin or stock: typed with its kind, or picked from the symbols the owner's watchlists
 *  hold. Shared by Research and Backtesting. */

import { Button, cn, useQuery } from '@hermes/plugin-sdk'
import { type FormEvent, useState } from 'react'

import { fetchWatchlists, type WatchKind, watchlistKey } from './api'
import { COPY } from './copy'
import { Segmented } from './segmented'

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
  const [value, setValue] = useState('')
  const [kind, setKind] = useState<WatchKind>('crypto')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const symbol = value.trim().toUpperCase()

    if (symbol) {
      onPick({ kind, symbol })
      setValue('')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
        <input
          aria-label={copy.label}
          className="h-8 min-w-0 flex-1 basis-full rounded-full bg-(--card-well) px-3.5 sm:basis-0 text-[0.8125rem] text-(--ui-text-primary) uppercase placeholder:normal-case placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:ring-1 focus-visible:ring-(--ui-text-tertiary)"
          maxLength={15}
          onChange={event => setValue(event.target.value)}
          placeholder={copy.placeholder}
          value={value}
        />
        <Segmented
          label={copy.kind}
          onSelect={setKind}
          options={[
            { id: 'crypto', text: COPY.lists.kinds.crypto },
            { id: 'stocks', text: COPY.lists.kinds.stocks }
          ]}
          value={kind}
        />
        <Button disabled={!value.trim()} size="sm" type="submit" variant="secondary">
          {copy.open}
        </Button>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list">
          {suggestions.map(pick => {
            const active = current?.symbol === pick.symbol && current.kind === pick.kind

            return (
              <button
                aria-pressed={active}
                className={cn(
                  'h-7 cursor-pointer rounded-full px-3 text-[0.75rem] font-medium transition-colors',
                  active
                    ? 'bg-(--card-surface) text-(--ui-text-primary) shadow-(--card-shadow)'
                    : 'bg-(--card-well) text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
                )}
                key={`${pick.kind}:${pick.symbol}`}
                onClick={() => onPick(pick)}
                type="button"
              >
                {pick.symbol}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
