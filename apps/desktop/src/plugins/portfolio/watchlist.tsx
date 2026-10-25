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
import { isListed } from './market-feed'
import { PageHeader } from './ui'
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
      <div className="flex flex-wrap items-start gap-5" data-portfolio-watchlist="">
        <div className="flex min-w-0 flex-[999_1_620px] flex-col gap-5">
          {selected ? (
            <CoinPanel feed={feed} key={`${active.id}:${selected}`} kind={active.kind} symbol={selected} />
          ) : (
            <EmptyState className="min-h-[40vh]" description={copy.emptyHint[active.kind]} title={copy.empty} />
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <WatchLists
            active={active}
            alerted={alerted}
            lists={lists}
            onChange={next => save.mutate(next)}
            onSelectList={setOpenList}
            onSelectSymbol={symbol => setOpenSymbol(current => ({ ...current, [active.id]: symbol }))}
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
