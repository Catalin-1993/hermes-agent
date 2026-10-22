/**
 * Watchlist: the owner's named lists — crypto priced live by Binance, stocks and ETFs by the market-data
 * service — with a TradingView chart of the selected symbol on the left and the lists on the right.
 * The lists are kept by the backend per profile; which list and symbol are open is this page's own.
 */

import { EmptyState, useMutation, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { fetchStockQuotes, fetchWatchlists, saveWatchlists, type WatchKind, type WatchList, watchlistKey } from './api'
import { CoinPanel } from './coin-panel'
import { COPY } from './copy'
import { isListed } from './market-feed'
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

export function WatchlistSection() {
  const copy = COPY.watchlist
  const { data, error, isLoading } = useQuery({ queryFn: fetchWatchlists, queryKey: watchlistKey })
  const save = useSaveLists()
  const [openList, setOpenList] = useState<null | string>(null)
  const [openSymbol, setOpenSymbol] = useState<Record<string, string>>({})
  const lists = data?.lists ?? []
  const active = lists.find(list => list.id === openList) ?? lists[0]
  const symbols = active?.symbols ?? []
  const remembered = active ? openSymbol[active.id] : undefined
  const selected = remembered && symbols.includes(remembered) ? remembered : (symbols[0] ?? null)
  // Both feeds are always called (hooks cannot be conditional); the one for the other kind gets no symbols.
  const crypto = useMarketFeed(active?.kind === 'crypto' ? symbols : [], selected, '1h')
  const stocks = useStockFeed(active?.kind === 'stocks' ? symbols : [])
  const feed = active?.kind === 'stocks' ? stocks : crypto

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
    <div
      className="grid items-start gap-4 pt-2 lg:h-full lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch"
      data-portfolio-watchlist=""
    >
      {selected ? (
        <CoinPanel feed={feed} key={`${active.id}:${selected}`} kind={active.kind} symbol={selected} />
      ) : (
        <EmptyState className="min-h-[40vh]" description={copy.emptyHint[active.kind]} title={copy.empty} />
      )}
      <div className="order-first lg:order-none lg:min-h-0 lg:self-start lg:overflow-y-auto lg:max-h-full">
        <WatchLists
          active={active}
          lists={lists}
          onChange={next => save.mutate(next)}
          onSelectList={setOpenList}
          onSelectSymbol={symbol => setOpenSymbol(current => ({ ...current, [active.id]: symbol }))}
          selected={selected}
          tickers={feed.tickers}
          validate={validate}
        />
      </div>
    </div>
  )
}
