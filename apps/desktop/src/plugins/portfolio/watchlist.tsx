/**
 * Watchlist: the owner's named lists — crypto priced live by Binance, stocks and ETFs by the market-data
 * service — with a TradingView chart of the selected symbol on the left and the lists on the right.
 * The lists are kept by the backend per profile; which list and symbol are open is this page's own.
 */

import { EmptyState, useMutation, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { AlertsCard, useAlerts } from './alerts'
import { fetchStockQuotes, fetchWatchlists, saveWatchlists, type WatchKind, type WatchList, watchlistKey } from './api'
import { CoinPanel } from './coin-panel'
import { COPY } from './copy'
import { type Interval, INTERVALS, isListed } from './market-feed'
import type { Pick } from './symbol-picker'
import { PageHeader } from './ui'
import { defaultInterval, intervalsFor } from './use-bars'
import { useMarketFeed } from './use-market-feed'
import { serviceReady, useStockFeed } from './use-stock-feed'
import { WatchLists } from './watch-lists'

async function validate(kind: WatchKind, symbol: string): Promise<null | string> {
  const copy = COPY.watchlist

  if (kind === 'crypto') {
    return (await isListed(symbol)) ? null : copy.unknown(symbol)
  }

  try {
    const answer = await fetchStockQuotes([symbol])

    if (!serviceReady(answer.status)) {
      return copy.needsService
    }

    return answer.quotes[symbol] ? null : copy.unknownStock(symbol)
  } catch {
    return copy.unknownStock(symbol)
  }
}

function useSaveLists() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveWatchlists,
    onMutate: async (lists: WatchList[]) => {
      await queryClient.cancelQueries({ queryKey: watchlistKey })
      const previous = queryClient.getQueryData(watchlistKey)
      queryClient.setQueryData(watchlistKey, { lists, saved: true })

      return { previous }
    },
    onError: (_error, _lists, context) => queryClient.setQueryData(watchlistKey, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: watchlistKey })
  })
}

/** What the chart shows — a symbol found with its own search, else the list's selection — the interval it can
 *  take, and the feed of its kind (the other kind's feed is called with nothing: hooks cannot be conditional). */
function useOpenChart(active: undefined | WatchList, selected: null | string, searched: null | Pick, wanted: Interval) {
  const chart: null | Pick = searched ?? (active && selected ? { kind: active.kind, symbol: selected } : null)
  const kind = chart?.kind ?? 'crypto'
  const shownInterval = intervalsFor(kind, INTERVALS).includes(wanted) ? wanted : defaultInterval(kind)

  const symbolsOf = (of: WatchKind) => {
    const listed = active?.kind === of ? active.symbols : []

    return chart?.kind === of && !listed.includes(chart.symbol) ? [...listed, chart.symbol] : listed
  }

  const crypto = useMarketFeed(symbolsOf('crypto'), chart?.kind === 'crypto' ? chart.symbol : null, shownInterval)
  const stocks = useStockFeed(symbolsOf('stocks'))

  return { chart, feed: chart?.kind === 'stocks' ? stocks : crypto, shownInterval }
}

export function WatchlistSection() {
  const copy = COPY.watchlist
  const { data, error, isLoading } = useQuery({ queryFn: fetchWatchlists, queryKey: watchlistKey })
  const save = useSaveLists()
  const [openList, setOpenList] = useState<null | string>(null)
  const [openSymbol, setOpenSymbol] = useState<Record<string, string>>({})
  // A symbol found with the chart's own search, open without being in any list.
  const [searched, setSearched] = useState<null | Pick>(null)
  const [interval, setInterval] = useState<Interval>('1h')
  const lists = data?.lists ?? []
  const active = lists.find(list => list.id === openList) ?? lists[0]
  const symbols = active?.symbols ?? []
  const remembered = active ? openSymbol[active.id] : undefined
  const selected = remembered && symbols.includes(remembered) ? remembered : (symbols[0] ?? null)
  const { chart, feed, shownInterval } = useOpenChart(active, selected, searched, interval)
  const { data: alertState } = useAlerts()
  const alerted = (alertState?.alerts ?? []).filter(alert => alert.active).map(alert => alert.symbol)

  if (isLoading) {
    return <EmptyState className="min-h-[60vh]" title={copy.loading} />
  }

  if (error || !data || !active) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        description={error instanceof Error ? error.message : undefined}
        title={copy.loadFailed}
      />
    )
  }

  return (
    <>
      <PageHeader subtitle={copy.subtitle} title={copy.title} />
      <div className="flex flex-wrap items-start gap-4" data-portfolio-watchlist="">
        <div className="flex min-w-0 flex-[999_1_620px] flex-col gap-4">
          {chart ? (
            <CoinPanel
              feed={feed}
              interval={shownInterval}
              key={`${chart.kind}:${chart.symbol}`}
              kind={chart.kind}
              onInterval={setInterval}
              onPick={setSearched}
              symbol={chart.symbol}
            />
          ) : (
            <EmptyState className="min-h-[40vh]" description={copy.emptyHint[active.kind]} title={copy.empty} />
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <WatchLists
            active={active}
            alerted={alerted}
            lists={lists}
            onChange={next => save.mutate(next)}
            onSelectList={id => {
              setSearched(null)
              setOpenList(id)
            }}
            onSelectSymbol={symbol => {
              setSearched(null)
              setOpenSymbol(current => ({ ...current, [active.id]: symbol }))
            }}
            selected={selected}
            tickers={feed.tickers}
            validate={validate}
          />
          <AlertsCard />
        </div>
      </div>
    </>
  )
}
