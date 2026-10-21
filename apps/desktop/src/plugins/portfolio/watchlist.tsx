/**
 * Watchlist: the coins the owner follows with live prices (Binance), and a TradingView-style chart
 * for the one selected. The followed list is kept by the backend per profile; prices and candles
 * come straight from the exchange's public feed (`market-feed.ts`).
 */

import {
  Button,
  cn,
  Codicon,
  EmptyState,
  FIGURE_CARD_CLASS,
  useMutation,
  useQuery,
  useQueryClient
} from '@hermes/plugin-sdk'
import { type FormEvent, useState } from 'react'

import { fetchWatchlist, saveWatchlist, watchlistKey } from './api'
import { COPY } from './copy'
import { percent, quotePrice, shortAmount, toneClass } from './format'
import { type ChartMode, LiveChart } from './live-chart'
import { fetchBars, type Interval, INTERVALS, isListed, type Ticker } from './market-feed'
import { Segmented } from './segmented'
import { type FeedStatus, useMarketFeed } from './use-market-feed'

const TITLE = 'text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)'

function StatusDot({ onRetry, status }: { onRetry: () => void; status: FeedStatus }) {
  const copy = COPY.watchlist.status

  return (
    <span className="flex items-center gap-1.5 text-[0.75rem] text-(--ui-text-tertiary)">
      <span
        className={cn(
          'size-1.5 rounded-full',
          status === 'live' && 'bg-(--ui-green)',
          status === 'connecting' && 'animate-pulse bg-(--ui-yellow)',
          status === 'offline' && 'bg-(--ui-red)'
        )}
      />
      {copy[status]}
      {status === 'offline' && (
        <button className="cursor-pointer text-(--ui-text-primary) underline" onClick={onRetry} type="button">
          {copy.retry}
        </button>
      )}
    </span>
  )
}

function AddCoin({ onAdd, taken }: { onAdd: (symbol: string) => void; taken: string[] }) {
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
    const listed = await isListed(symbol)
    setChecking(false)

    if (!listed) {
      return setProblem(copy.unknown(symbol))
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
          className="h-8 min-w-0 flex-1 rounded-full bg-(--card-well) px-3.5 text-[0.8125rem] text-(--ui-text-primary) uppercase placeholder:normal-case placeholder:text-(--ui-text-tertiary) focus:outline-none"
          maxLength={12}
          onChange={event => {
            setValue(event.target.value)
            setProblem('')
          }}
          placeholder={copy.addPlaceholder}
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

function CoinRow({
  active,
  onRemove,
  onSelect,
  symbol,
  ticker
}: {
  active: boolean
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
        <span className="text-[0.875rem] font-semibold text-(--ui-text-primary)">{symbol}</span>
        <span className="text-right tabular-nums">
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
        className="absolute top-1.5 right-1.5 hidden size-5 cursor-pointer place-items-center rounded-full bg-(--card-surface) text-(--ui-text-tertiary) hover:text-(--ui-red) group-hover:grid"
        onClick={onRemove}
        type="button"
      >
        <Codicon name="close" size="0.625rem" />
      </button>
    </li>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{label}</div>
      <div className="mt-0.5 text-[0.8125rem] font-medium tabular-nums text-(--ui-text-primary)">{value}</div>
    </div>
  )
}

function CoinPanel({ feed, symbol }: { feed: ReturnType<typeof useMarketFeed>; symbol: string }) {
  const copy = COPY.watchlist
  const [interval, setInterval] = useState<Interval>('1h')
  const [mode, setMode] = useState<ChartMode>('candles')
  const ticker = feed.tickers[symbol]

  const { data: bars, isError } = useQuery({
    queryFn: ({ signal }) => fetchBars(symbol, interval, signal),
    queryKey: ['portfolio', 'bars', symbol, interval],
    retry: 1,
    staleTime: 30_000
  })

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'min-h-[32rem] gap-3')} data-portfolio-coin={symbol}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={TITLE}>{symbol} / USDT</div>
          <div className="mt-1 flex items-baseline gap-3 tabular-nums">
            <span className="text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-(--ui-text-primary)">
              {ticker ? quotePrice(ticker.price) : '—'}
            </span>
            {ticker && (
              <span className={cn('text-[0.875rem] font-medium', toneClass(ticker.changePct))}>
                {percent(ticker.changePct, true)}{' '}
                <span className="font-normal text-(--ui-text-tertiary)">{copy.day}</span>
              </span>
            )}
          </div>
        </div>
        <StatusDot onRetry={feed.retry} status={feed.status} />
      </div>
      {ticker && (
        <div className="grid grid-cols-3 gap-4">
          <Stat label={copy.high} value={quotePrice(ticker.high)} />
          <Stat label={copy.low} value={quotePrice(ticker.low)} />
          <Stat label={copy.volume} value={`${shortAmount(ticker.volume)} USDT`} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label={copy.interval}
          onSelect={setInterval}
          options={INTERVALS.map(id => ({ id, text: id }))}
          value={interval}
        />
        <Segmented
          label={COPY.chart.mode}
          onSelect={setMode}
          options={[
            { id: 'candles', text: COPY.chart.candles },
            { id: 'line', text: COPY.chart.line }
          ]}
          value={mode}
        />
      </div>
      {isError ? (
        <div className="grid min-h-80 flex-1 place-items-center text-center text-[0.8125rem] text-(--ui-text-tertiary)">
          {copy.barsFailed}
        </div>
      ) : bars ? (
        <LiveChart bars={bars} live={feed.bar} mode={mode} />
      ) : (
        <div className="grid min-h-80 flex-1 place-items-center text-[0.8125rem] text-(--ui-text-tertiary)">
          {copy.loadingChart}
        </div>
      )}
    </div>
  )
}

export function WatchlistSection() {
  const copy = COPY.watchlist
  const queryClient = useQueryClient()
  const { data, error, isLoading } = useQuery({ queryFn: fetchWatchlist, queryKey: watchlistKey })
  const [chosen, setChosen] = useState<null | string>(null)
  const symbols = data?.symbols ?? []
  const selected = chosen && symbols.includes(chosen) ? chosen : (symbols[0] ?? null)
  const feed = useMarketFeed(symbols, selected, '1h')

  const save = useMutation({
    mutationFn: saveWatchlist,
    onMutate: async (next: string[]) => {
      await queryClient.cancelQueries({ queryKey: watchlistKey })
      const previous = queryClient.getQueryData(watchlistKey)
      queryClient.setQueryData(watchlistKey, { saved: true, symbols: next })

      return { previous }
    },
    onError: (_error, _next, context) => queryClient.setQueryData(watchlistKey, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: watchlistKey })
  })

  if (isLoading) {
    return <EmptyState className="min-h-[60vh]" title={copy.loading} />
  }

  if (error || !data) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        description={error instanceof Error ? error.message : undefined}
        title={copy.loadFailed}
      />
    )
  }

  return (
    <div className="grid items-start gap-4 pt-2 lg:grid-cols-[19rem_minmax(0,1fr)]" data-portfolio-watchlist="">
      <div className={cn(FIGURE_CARD_CLASS, 'gap-2')}>
        <div className={TITLE}>{copy.title}</div>
        <ul className="-mx-1 flex flex-col gap-0.5">
          {symbols.map(symbol => (
            <CoinRow
              active={symbol === selected}
              key={symbol}
              onRemove={() => save.mutate(symbols.filter(item => item !== symbol))}
              onSelect={() => setChosen(symbol)}
              symbol={symbol}
              ticker={feed.tickers[symbol]}
            />
          ))}
        </ul>
        <AddCoin onAdd={symbol => save.mutate([...symbols, symbol])} taken={symbols} />
        <p className="px-1 pt-1 text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">{copy.footer}</p>
      </div>
      {selected ? (
        <CoinPanel feed={feed} key={selected} symbol={selected} />
      ) : (
        <EmptyState className="min-h-[40vh]" description={copy.emptyHint} title={copy.empty} />
      )}
    </div>
  )
}
