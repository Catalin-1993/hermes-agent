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
  randomUuid,
  Tip
} from '@hermes/plugin-sdk'
import { type FormEvent, useState } from 'react'

import type { WatchKind, WatchList } from './api'
import { AssetIcon } from './asset-icon'
import { COPY } from './copy'
import { percent, quotePrice, toneClass } from './format'
import type { Ticker } from './market-feed'
import { Segmented } from './segmented'
import { BTN, CARD, CARD_PAD_SM, FIELD, MUTED } from './ui'

/** A 36px square icon button, as the design's list header and "new list" use. */
const ICON_BUTTON =
  'grid size-9 shrink-0 cursor-pointer place-items-center rounded-[10px] text-(--ui-text-tertiary) transition-colors hover:bg-(--card-well) hover:text-(--ui-text-primary)'

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
    onCreate({ id: randomUuid().slice(0, 8), kind, name: nameOrDefault(name, lists), symbols: [] })
  }

  return (
    <form className="flex flex-col gap-3 rounded-xl bg-(--card-well) p-3.5" onSubmit={submit}>
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
    <div className="flex items-center gap-2">
      <div
        className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-[10px] border border-(--card-well-stroke) bg-(--card-well) p-[3px]"
        role="tablist"
      >
        {lists.map(list => (
          <button
            aria-selected={list.id === activeId}
            className={cn(
              'h-8 min-w-0 flex-auto cursor-pointer truncate rounded-lg px-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors',
              list.id === activeId
                ? 'bg-(--card-surface) text-(--ui-text-primary) shadow-(--card-shadow)'
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
        <button aria-label={COPY.lists.new} className={ICON_BUTTON} onClick={onNew} type="button">
          <Codicon name="add" size="1rem" />
        </button>
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
        className={cn(FIELD, 'text-[0.9375rem] font-medium')}
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
    <div className="flex items-center justify-between gap-2 px-1.5">
      <div className="flex min-w-0 flex-col gap-px">
        <div className="truncate text-[0.9375rem] font-medium text-(--ui-text-primary)">{list.name}</div>
        <div className={cn('text-[0.78125rem]', MUTED)}>
          {copy.kinds[list.kind]} · {copy.symbolCount(list.symbols.length)}
        </div>
      </div>
      <DropdownMenu>
        <Tip label={copy.manage}>
          <DropdownMenuTrigger asChild>
            <button aria-label={copy.manage} className={ICON_BUTTON} type="button">
              <Codicon name="ellipsis" size="1rem" />
            </button>
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
          'flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors',
          active ? 'border-(--card-well-stroke) bg-(--card-well)' : 'border-transparent hover:bg-(--card-well)'
        )}
        onClick={onSelect}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-(--card-well)">
            <AssetIcon kind={kind} size={22} symbol={symbol} />
          </span>
          <span className="truncate text-sm font-semibold text-(--ui-text-primary)">{symbol}</span>
          {alerted && (
            <>
              <Codicon className="shrink-0 text-(--ui-yellow)" name="bell" size="0.75rem" />
              <span className="sr-only">{COPY.alerts.title}</span>
            </>
          )}
        </span>
        <span className="shrink-0 text-right tabular-nums">
          <span className="block text-sm font-medium text-(--ui-text-primary)">
            {ticker ? quotePrice(ticker.price) : '—'}
          </span>
          <span className={cn('block text-xs', ticker ? toneClass(ticker.changePct) : 'text-(--ui-text-tertiary)')}>
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
    <form className="m-0" onSubmit={submit}>
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
        <button className={cn(BTN, 'h-10 px-3.5')} disabled={checking || !value.trim()} type="submit">
          {copy.add}
        </button>
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
    <section className={cn(CARD, CARD_PAD_SM, 'gap-3')} data-portfolio-lists="">
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
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
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
            <p className={cn('m-0 px-1.5 py-3 text-[0.8125rem]', MUTED)}>{copy.emptyList}</p>
          )}
          <AddSymbol
            key={`add-${active.id}`}
            kind={active.kind}
            onAdd={symbol => update({ ...active, symbols: [...active.symbols, symbol] })}
            taken={active.symbols}
            validate={symbol => validate(active.kind, symbol)}
          />
          <p className={cn('m-0 flex gap-2.5 rounded-xl bg-(--card-well) p-3 text-[0.78125rem] leading-normal', MUTED)}>
            <Codicon className="mt-0.5 shrink-0" name="info" size="0.9375rem" />
            <span>{copy.footer[active.kind]}</span>
          </p>
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
    </section>
  )
}
