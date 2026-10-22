/**
 * The lists side of the Watchlist: the owner's named lists as tabs, the selected list's rows with
 * their prices, and everything that changes them — a new list (name and kind), rename, delete
 * (confirmed by name), add and remove a symbol. Every change saves the whole set through one callback.
 */

import {
  Button,
  cn,
  Codicon,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FIGURE_CARD_CLASS,
  Tip
} from '@hermes/plugin-sdk'
import { type FormEvent, useState } from 'react'

import type { WatchKind, WatchList } from './api'
import { AssetIcon } from './asset-icon'
import { COPY } from './copy'
import { percent, quotePrice, toneClass } from './format'
import type { Ticker } from './market-feed'
import { Segmented } from './segmented'

const FIELD =
  'h-8 min-w-0 flex-1 rounded-full bg-(--card-well) px-3.5 text-[0.8125rem] text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:ring-1 focus-visible:ring-(--ui-text-tertiary)'

/** A name typed by the owner, or the next free "Lista mea N" when left empty. */
function nameOrDefault(name: string, lists: WatchList[]) {
  const typed = name.trim()

  if (typed) {
    return typed
  }

  let index = lists.length + 1

  while (lists.some(list => list.name === COPY.lists.defaultName(index))) {
    index += 1
  }

  return COPY.lists.defaultName(index)
}

function NewListForm({
  lists,
  onCancel,
  onCreate
}: {
  lists: WatchList[]
  onCancel: () => void
  onCreate: (list: WatchList) => void
}) {
  const copy = COPY.lists
  const [name, setName] = useState('')
  const [kind, setKind] = useState<WatchKind>('crypto')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onCreate({ id: crypto.randomUUID().slice(0, 8), kind, name: nameOrDefault(name, lists), symbols: [] })
  }

  return (
    <form className="flex flex-col gap-2.5 rounded-xl bg-(--card-well) p-3" onSubmit={submit}>
      <div className="text-[0.8125rem] font-medium text-(--ui-text-primary)">{copy.newTitle}</div>
      <input
        aria-label={copy.nameLabel}
        autoFocus
        className={cn(FIELD, 'bg-(--card-surface)')}
        maxLength={40}
        onChange={event => setName(event.target.value)}
        onKeyDown={event => event.key === 'Escape' && onCancel()}
        placeholder={copy.namePlaceholder}
        value={name}
      />
      <Segmented
        label={copy.kindLabel}
        onSelect={setKind}
        options={[
          { id: 'crypto', text: copy.kinds.crypto },
          { id: 'stocks', text: copy.kinds.stocks }
        ]}
        value={kind}
      />
      <p className="text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">{copy.kindHint[kind]}</p>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          {copy.cancel}
        </Button>
        <Button size="sm" type="submit">
          {copy.create}
        </Button>
      </div>
    </form>
  )
}

function ListTabs({
  activeId,
  lists,
  onNew,
  onSelect
}: {
  activeId: string
  lists: WatchList[]
  onNew: () => void
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex items-start gap-1">
      <div className="flex min-w-0 flex-1 flex-wrap gap-1" role="tablist">
        {lists.map(list => (
          <button
            aria-selected={list.id === activeId}
            className={cn(
              'h-7 max-w-full cursor-pointer truncate rounded-full px-3 text-[0.75rem] font-medium transition-colors',
              list.id === activeId
                ? 'bg-(--card-well) text-(--ui-text-primary)'
                : 'text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
            )}
            key={list.id}
            onClick={() => onSelect(list.id)}
            role="tab"
            type="button"
          >
            {list.name}
          </button>
        ))}
      </div>
      <Tip label={COPY.lists.new}>
        <Button
          aria-label={COPY.lists.new}
          className="shrink-0 rounded-full"
          onClick={onNew}
          size="icon-xs"
          variant="ghost"
        >
          <Codicon name="add" />
        </Button>
      </Tip>
    </div>
  )
}

function ListHeader({
  list,
  onDelete,
  onRename
}: {
  list: WatchList
  onDelete: () => void
  onRename: (name: string) => void
}) {
  const copy = COPY.lists
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(list.name)

  if (editing) {
    const finish = () => {
      setEditing(false)

      if (draft.trim() && draft.trim() !== list.name) {
        onRename(draft.trim())
      }
    }

    return (
      <input
        aria-label={copy.nameLabel}
        autoFocus
        className={cn(FIELD, 'h-8 w-full text-[0.9375rem] font-semibold')}
        maxLength={40}
        onBlur={finish}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            finish()
          } else if (event.key === 'Escape') {
            setDraft(list.name)
            setEditing(false)
          }
        }}
        value={draft}
      />
    )
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)">
          {list.name}
        </div>
        <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.kinds[list.kind]}</div>
      </div>
      <DropdownMenu>
        <Tip label={copy.manage}>
          <DropdownMenuTrigger asChild>
            <Button aria-label={copy.manage} className="shrink-0 rounded-full" size="icon-xs" variant="ghost">
              <Codicon name="ellipsis" />
            </Button>
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(list.name)
              setEditing(true)
            }}
          >
            <Codicon className="mr-1.5" name="edit" />
            {copy.rename}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDelete} variant="destructive">
            <Codicon className="mr-1.5" name="trash" />
            {copy.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function SymbolRow({
  active,
  alerted,
  kind,
  onRemove,
  onSelect,
  symbol,
  ticker
}: {
  active: boolean
  /** A price alert waits on this symbol. */
  alerted: boolean
  kind: WatchKind
  onRemove: () => void
  onSelect: () => void
  symbol: string
  ticker?: Ticker
}) {
  return (
    <li className="group relative">
      <button
        aria-pressed={active}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
          active ? 'bg-(--card-well)' : 'hover:bg-(--card-well)'
        )}
        onClick={onSelect}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <AssetIcon kind={kind} size={26} symbol={symbol} />
          <span className="truncate text-[0.875rem] font-semibold text-(--ui-text-primary)">{symbol}</span>
          {alerted && (
            <>
              <Codicon className="shrink-0 text-(--ui-yellow)" name="bell" size="0.75rem" />
              <span className="sr-only">{COPY.alerts.title}</span>
            </>
          )}
        </span>
        <span className="shrink-0 text-right tabular-nums">
          <span className="block text-[0.875rem] font-medium text-(--ui-text-primary)">
            {ticker ? quotePrice(ticker.price) : '—'}
          </span>
          <span
            className={cn('block text-[0.75rem]', ticker ? toneClass(ticker.changePct) : 'text-(--ui-text-tertiary)')}
          >
            {ticker ? percent(ticker.changePct, true) : ''}
          </span>
        </span>
      </button>
      <button
        aria-label={COPY.watchlist.remove(symbol)}
        className="absolute top-1.5 left-1.5 hidden size-5 cursor-pointer place-items-center rounded-full bg-(--card-surface) text-(--ui-text-tertiary) shadow-(--card-shadow) group-hover:grid group-focus-within:grid hover:text-(--ui-red)"
        onClick={onRemove}
        type="button"
      >
        <Codicon name="close" size="0.625rem" />
      </button>
    </li>
  )
}

function AddSymbol({
  kind,
  onAdd,
  taken,
  validate
}: {
  kind: WatchKind
  onAdd: (symbol: string) => void
  taken: string[]
  validate: (symbol: string) => Promise<null | string>
}) {
  const copy = COPY.watchlist
  const [value, setValue] = useState('')
  const [problem, setProblem] = useState('')
  const [checking, setChecking] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const symbol = value.trim().toUpperCase()

    if (!symbol) {
      return
    }

    if (taken.includes(symbol)) {
      return setProblem(copy.already(symbol))
    }

    setChecking(true)
    const failure = await validate(symbol)
    setChecking(false)

    if (failure) {
      return setProblem(failure)
    }

    setProblem('')
    setValue('')
    onAdd(symbol)
  }

  return (
    <form className="mt-1" onSubmit={submit}>
      <div className="flex gap-2">
        <input
          aria-label={copy.addLabel}
          className={cn(FIELD, 'uppercase placeholder:normal-case')}
          maxLength={15}
          onChange={event => {
            setValue(event.target.value)
            setProblem('')
          }}
          placeholder={kind === 'crypto' ? copy.addPlaceholder : copy.addStockPlaceholder}
          value={value}
        />
        <Button disabled={checking || !value.trim()} size="sm" type="submit" variant="secondary">
          {copy.add}
        </Button>
      </div>
      {problem && <p className="mt-1.5 px-1 text-[0.75rem] text-(--ui-red)">{problem}</p>}
    </form>
  )
}

export interface WatchListsProps {
  active: WatchList
  /** Symbols with a waiting price alert. */
  alerted: string[]
  lists: WatchList[]
  onChange: (lists: WatchList[]) => void
  onSelectList: (id: string) => void
  onSelectSymbol: (symbol: string) => void
  selected: null | string
  tickers: Record<string, Ticker>
  validate: (kind: WatchKind, symbol: string) => Promise<null | string>
}

export function WatchLists({
  active,
  alerted,
  lists,
  onChange,
  onSelectList,
  onSelectSymbol,
  selected,
  tickers,
  validate
}: WatchListsProps) {
  const copy = COPY.lists
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const update = (next: WatchList) => onChange(lists.map(list => (list.id === next.id ? next : list)))

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'gap-3')} data-portfolio-lists="">
      <ListTabs activeId={active.id} lists={lists} onNew={() => setCreating(true)} onSelect={onSelectList} />
      {creating ? (
        <NewListForm
          lists={lists}
          onCancel={() => setCreating(false)}
          onCreate={list => {
            setCreating(false)
            onChange([...lists, list])
            onSelectList(list.id)
          }}
        />
      ) : (
        <>
          <ListHeader
            key={active.id}
            list={active}
            onDelete={() => setDeleting(true)}
            onRename={name => update({ ...active, name })}
          />
          {active.symbols.length ? (
            <ul className="-mx-1 flex flex-col gap-0.5">
              {active.symbols.map(symbol => (
                <SymbolRow
                  active={symbol === selected}
                  alerted={alerted.includes(symbol)}
                  key={symbol}
                  kind={active.kind}
                  onRemove={() => update({ ...active, symbols: active.symbols.filter(item => item !== symbol) })}
                  onSelect={() => onSelectSymbol(symbol)}
                  symbol={symbol}
                  ticker={tickers[symbol]}
                />
              ))}
            </ul>
          ) : (
            <p className="px-1 py-3 text-[0.8125rem] text-(--ui-text-tertiary)">{copy.emptyList}</p>
          )}
          <AddSymbol
            key={`add-${active.id}`}
            kind={active.kind}
            onAdd={symbol => update({ ...active, symbols: [...active.symbols, symbol] })}
            taken={active.symbols}
            validate={symbol => validate(active.kind, symbol)}
          />
          <p className="px-1 text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">{copy.footer[active.kind]}</p>
        </>
      )}
      {deleting && (
        <ConfirmDialog
          cancelLabel={copy.cancel}
          confirmLabel={copy.deleteConfirm}
          description={copy.deleteDescription(active.name, active.symbols.length)}
          destructive
          onClose={() => setDeleting(false)}
          onConfirm={() => {
            setDeleting(false)
            onChange(lists.filter(list => list.id !== active.id))
          }}
          open
          title={copy.deleteTitle(active.name)}
        />
      )}
    </div>
  )
}
