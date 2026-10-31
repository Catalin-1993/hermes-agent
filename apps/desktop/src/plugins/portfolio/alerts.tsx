/**
 * Price alerts on the Watchlist: the bell beside a symbol's price sets one, the chart draws each waiting
 * level, and a card under the lists shows every alert and whether it was reached. The backend keeps them
 * per profile and has Hermes check them on a schedule with no model (`core/alerts.py`), so an alert
 * reaches the owner's main channel even with the app closed; while this page is open, a reached alert is
 * also announced here.
 */

import {
  cn,
  Codicon,
  host,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useMutation,
  useQuery,
  useQueryClient
} from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'

import { describeAlert, directionFor, newlyReached, startingLevel } from './alert-rules'
import {
  addAlert,
  type AlertOp,
  alertsKey,
  type AlertState,
  deleteAlert,
  fetchAlerts,
  type PriceAlert,
  type WatchKind
} from './api'
import { AssetIcon } from './asset-icon'
import { COPY } from './copy'
import { quotePrice } from './format'
import { Segmented } from './segmented'
import { TOP_BTN } from './studio-toolbar'
import { BTN, CARD, CARD_PAD, CountPill, FIELD as DESIGN_FIELD, H2, MUTED } from './ui'

const FIELD = cn(DESIGN_FIELD, 'tabular-nums')

const when = (iso: string) =>
  new Intl.DateTimeFormat('ro-RO', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' }).format(
    new Date(iso)
  )

/** The alerts, refreshed every half minute: often enough to see a check land, cheap (a small file read). */
export function useAlerts() {
  return useQuery({ queryFn: fetchAlerts, queryKey: alertsKey, refetchInterval: 30_000 })
}

/** Announces, once, each alert that is reached while the Portfolio page is open. */
export function useAlertNotices() {
  const { data } = useAlerts()
  const seen = useRef<null | PriceAlert[]>(null)

  // Compares each answer with the previous one; the first answer only sets the baseline.
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!data) {
      return
    }

    for (const alert of seen.current ? newlyReached(seen.current, data.alerts) : []) {
      host.notify({
        kind: 'success',
        message: COPY.alerts.reachedToast(describeAlert(alert), quotePrice(alert.triggered_price ?? alert.price))
      })
    }

    seen.current = data.alerts
  }, [data])
}

function useAlertChanges() {
  const queryClient = useQueryClient()
  const settle = (state: AlertState) => queryClient.setQueryData(alertsKey, state)

  return {
    add: useMutation({ mutationFn: addAlert, onSuccess: settle }),
    remove: useMutation({ mutationFn: deleteAlert, onSuccess: settle })
  }
}

function AlertForm({
  current,
  currency,
  kind,
  onDone,
  symbol
}: {
  current: null | number
  currency: string
  kind: WatchKind
  onDone: () => void
  symbol: string
}) {
  const copy = COPY.alerts
  const { add } = useAlertChanges()
  const [level, setLevel] = useState(current ? String(startingLevel(current)) : '')
  const [chosen, setChosen] = useState<AlertOp>('above')
  const [note, setNote] = useState('')
  const price = Number(level.replace(',', '.'))
  const valid = Number.isFinite(price) && price > 0
  // With a live price the direction follows from the level; without one (a stock while the service is off) the owner picks it.
  const op = current && valid ? directionFor(price, current) : chosen

  const submit = () =>
    add.mutate(
      { kind, note, op, price, symbol },
      {
        onError: error => host.notify({ kind: 'error', message: `${copy.failed} ${error.message}` }),
        onSuccess: state => {
          if (state.error) {
            host.notify({ kind: 'error', message: copy.errors[state.error] })

            return
          }

          host.notify({ kind: 'success', message: copy.added(describeAlert({ currency, op, price, symbol })) })
          onDone()
        }
      }
    )

  return (
    <form
      className="flex flex-col gap-2.5 p-1"
      onSubmit={event => {
        event.preventDefault()

        if (valid) {
          submit()
        }
      }}
    >
      <label className="flex flex-col gap-1.5 text-[0.75rem] text-(--ui-text-secondary)">
        {copy.formTitle(symbol)}
        <span className="flex items-center gap-2">
          <input
            aria-label={copy.level}
            autoFocus
            className={FIELD}
            inputMode="decimal"
            onChange={event => setLevel(event.target.value)}
            value={level}
          />
          <span className="shrink-0 text-(--ui-text-tertiary)">{currency}</span>
        </span>
      </label>
      {current ? (
        <p className="text-[0.75rem] leading-relaxed text-(--ui-text-tertiary)">
          {copy.now(quotePrice(current))} <span className="font-medium text-(--ui-text-primary)">{copy.ops[op]}</span>{' '}
          {valid ? quotePrice(price) : '…'}
        </p>
      ) : (
        <Segmented
          label={copy.direction}
          onSelect={setChosen}
          options={[
            { id: 'above', text: copy.ops.above },
            { id: 'below', text: copy.ops.below }
          ]}
          value={chosen}
        />
      )}
      <input
        aria-label={copy.noteLabel}
        className={FIELD}
        maxLength={120}
        onChange={event => setNote(event.target.value)}
        placeholder={copy.notePlaceholder}
        value={note}
      />
      <button className={BTN} disabled={!valid || add.isPending} type="submit">
        <Codicon name="bell" size="0.9375rem" />
        {add.isPending ? copy.saving : copy.set}
      </button>
    </form>
  )
}

/** The bell beside a symbol's price; its count says how many alerts wait on this symbol. */
export function AlertButton({
  current,
  currency,
  flat = false,
  kind,
  symbol
}: {
  current: null | number
  currency: string
  /** The flat look of a button on the chart's top bar, instead of a bordered one. */
  flat?: boolean
  kind: WatchKind
  symbol: string
}) {
  const copy = COPY.alerts
  const [open, setOpen] = useState(false)
  const { data } = useAlerts()
  const waiting = (data?.alerts ?? []).filter(alert => alert.active && alert.symbol === symbol).length

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={copy.buttonLabel(symbol)}
          className={flat ? TOP_BTN : cn(BTN, 'h-[38px] px-4 text-[0.84375rem]')}
          type="button"
        >
          <Codicon name={waiting ? 'bell-dot' : 'bell'} size="1rem" />
          {waiting ? copy.buttonCount(waiting) : copy.button}
        </button>
      </PopoverTrigger>
      <PopoverContent align={flat ? 'start' : 'end'} className="w-72">
        {open && (
          <AlertForm currency={currency} current={current} kind={kind} onDone={() => setOpen(false)} symbol={symbol} />
        )}
      </PopoverContent>
    </Popover>
  )
}

function AlertRow({ alert, onDelete }: { alert: PriceAlert; onDelete: () => void }) {
  const copy = COPY.alerts
  const text = describeAlert(alert)

  return (
    <li className="group relative flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-(--card-well)">
      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-(--card-well)">
        <AssetIcon kind={alert.kind} size={20} symbol={alert.symbol} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">{text}</span>
        <span
          className={cn(
            'block text-[0.6875rem]',
            alert.active ? 'text-(--ui-text-tertiary)' : 'font-medium text-(--ui-green)'
          )}
        >
          {alert.active || !alert.triggered_at
            ? copy.waiting
            : copy.reachedAt(when(alert.triggered_at), quotePrice(alert.triggered_price ?? alert.price))}
          {alert.note && <span className="font-normal text-(--ui-text-tertiary)"> · {alert.note}</span>}
        </span>
      </span>
      <button
        aria-label={copy.delete(text)}
        className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full text-(--ui-text-tertiary) opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-(--ui-red)"
        onClick={onDelete}
        type="button"
      >
        <Codicon name="trash" size="0.75rem" />
      </button>
    </li>
  )
}

/** Every alert, waiting first, with when the last check ran and how the owner hears about a hit. */
export function AlertsCard() {
  const copy = COPY.alerts
  const { data } = useAlerts()
  const { remove } = useAlertChanges()
  const alerts = [...(data?.alerts ?? [])].sort((a, b) => Number(b.active) - Number(a.active))

  return (
    <section className={cn(CARD, CARD_PAD, 'gap-3.5')} data-portfolio-alerts="">
      <div className="flex items-center justify-between gap-2">
        <h2 className={cn(H2, 'flex items-center gap-2.5')}>
          <Codicon name="bell" size="1rem" />
          {copy.title}
        </h2>
        <CountPill>{alerts.length}</CountPill>
      </div>
      {alerts.length ? (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {alerts.map(alert => (
            <AlertRow alert={alert} key={alert.id} onDelete={() => remove.mutate(alert.id)} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2.5 px-3 py-5 text-center">
          <span className="grid size-11 place-items-center rounded-[14px] border border-(--card-well-stroke) bg-(--card-well) text-(--ui-text-secondary)">
            <Codicon name="bell" size="1.125rem" />
          </span>
          <span className="text-sm font-medium text-(--ui-text-primary)">{copy.emptyTitle}</span>
          <span className="max-w-70 text-[0.8125rem] text-(--ui-text-secondary)">{copy.emptyHint}</span>
        </div>
      )}
      {data && alerts.some(alert => alert.active) && (
        <p className="m-0 px-1 text-[0.75rem] text-(--ui-text-secondary)">
          {data.checked_at ? copy.checked(when(data.checked_at)) : copy.notChecked}
          {data.unpriced.length > 0 && ` ${copy.unpriced(data.unpriced.join(', '))}`}
        </p>
      )}
      <div className="flex flex-col gap-1.5 rounded-xl bg-(--card-well) p-3.5">
        <span className="text-[0.78125rem] font-medium text-(--ui-text-secondary)">{copy.howTitle}</span>
        <span className={cn('text-[0.78125rem] leading-relaxed', MUTED)}>{copy.how(data?.every_minutes ?? 5)}</span>
      </div>
    </section>
  )
}
