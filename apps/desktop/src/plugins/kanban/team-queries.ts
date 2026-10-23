/** The Team-mode reads several faces share: the board's approval rules (and the cards they hold),
 *  the watchdog's findings, the board's goals and the agents' check-in rhythms. */

import { useQuery, useValue } from '@hermes/plugin-sdk'

import {
  $boardSlug,
  fetchGoals,
  fetchRhythms,
  fetchRules,
  fetchWatchdog,
  goalsKey,
  rhythmKey,
  rulesKey,
  useKanbanScope,
  watchdogKey
} from './api'

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

export function useGoals() {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  return useQuery({ queryFn: fetchGoals, queryKey: goalsKey(scope, slug), refetchInterval: 30_000 })
}

export function useRhythms() {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  return useQuery({ queryFn: fetchRhythms, queryKey: rhythmKey(scope, slug), refetchInterval: 60_000 })
}
