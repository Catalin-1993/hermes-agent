/**
 * The composer's "+" menu, one row per agent ("Agent: Setter"): picking one writes `@setter` into the message, which
 * the Bots plugin's mention handling turns into "ask that agent" for the main agent. Rows are contributed to the
 * composer's own `composer.attachments` area and follow the roster as agents are created or removed.
 */

import { COMPOSER_AREAS, useQuery } from '@hermes/plugin-sdk'
import { useEffect } from 'react'

import { fetchProfiles, profilesKey, useKanbanScope } from './api'
import type { KanbanProfile } from './types'

const MAX_ROWS = 8

type Register = (contribution: { area: string; data: unknown; id: string; order?: number }) => () => void

/** The `@` form the mention handling resolves: the profile's name, `hermes` for the default profile. */
export const mentionOf = (agent: Pick<KanbanProfile, 'is_default' | 'name'>) =>
  agent.is_default || agent.name.toLowerCase() === 'default' ? 'hermes' : agent.name

export function AgentMenuRows({ register }: { register: Register }) {
  const scope = useKanbanScope()
  const { data } = useQuery({ queryFn: fetchProfiles, queryKey: profilesKey(scope), staleTime: 30_000 })
  const agents = (data?.profiles ?? []).filter(agent => !agent.is_default).slice(0, MAX_ROWS)
  const signature = agents.map(agent => `${agent.name}:${agent.display_name ?? ''}`).join('|')

  useEffect(() => {
    const disposers = agents.map(agent =>
      register({
        area: COMPOSER_AREAS.attachments,
        data: {
          icon: 'account',
          label: `Agent: ${agent.display_name || agent.name}`,
          run: ({ insertText }: { insertText: (text: string) => void }) => insertText(`@${mentionOf(agent)} `)
        },
        id: `agent-${agent.name}`
      })
    )

    return () => disposers.forEach(dispose => dispose())
    // The rows depend on the roster's names, not on the array identity a refetch hands back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, signature])

  return null
}
