/** The Team-mode reads several faces share: the board's approval rules (and the cards they hold)
 *  and the watchdog's findings. */

import { useQuery, useValue } from '@hermes/plugin-sdk'

import { $boardSlug, fetchRules, fetchWatchdog, rulesKey, useKanbanScope, watchdogKey } from './api'

export function useRules() {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  return useQuery({ queryFn: fetchRules, queryKey: rulesKey(scope, slug), refetchInterval: 30_000 })
}

export function useWatchdog() {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  return useQuery({ queryFn: fetchWatchdog, queryKey: watchdogKey(scope, slug), refetchInterval: 60_000 })
}
