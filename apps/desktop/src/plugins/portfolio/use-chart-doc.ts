/** The owner's chart of one symbol, cached by the query layer and saved to the backend on every change:
 *  painted at once, rolled back with a toast if the save fails. */

import { host, useQuery, useQueryClient } from '@hermes/plugin-sdk'

import { chartKey, fetchChart, saveChart, type WatchKind } from './api'
import type { ChartDoc } from './studio-model'

const EMPTY: ChartDoc = { compare: [], drawings: [], indicators: [], notes: [] }

export function useChartDoc(kind: WatchKind, symbol: string) {
  const queryClient = useQueryClient()
  const key = chartKey(kind, symbol)
  const { data } = useQuery({ queryFn: () => fetchChart(kind, symbol), queryKey: key, staleTime: 60_000 })
  const doc: ChartDoc = data ?? EMPTY

  const update = async (change: (current: ChartDoc) => ChartDoc) => {
    const before = queryClient.getQueryData<ChartDoc>(key) ?? EMPTY
    const next = change(before)
    queryClient.setQueryData(key, { ...before, ...next })

    try {
      queryClient.setQueryData(key, await saveChart(kind, symbol, next))
    } catch (error) {
      queryClient.setQueryData(key, before)
      host.notify({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return { doc, ready: Boolean(data), update }
}

/** A short id for a new indicator, drawing or note (the backend keeps it as given). */
export const newId = () => Math.random().toString(36).slice(2, 10)
