/**
 * The composer's "+" menu, one row per agent ("Agent: Setter"): picking one writes `@setter` into the message, which
 * the Bots plugin's mention handling turns into "ask that agent" for the main agent. Rows are contributed to the
 * composer's own `composer.attachments` area and follow the profile list as agents are created or removed.
 */

import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { COMPOSER_AREAS } from '@/app/chat/composer/contrib'
import { registry } from '@/contrib/registry'
import { $profiles, profileLabel } from '@/store/profile'
import type { ProfileInfo } from '@/types/hermes'

const MAX_ROWS = 8

/** The `@` form the mention handling resolves: the profile's name, `hermes` for the default profile. */
export const mentionOf = (agent: Pick<ProfileInfo, 'is_default' | 'name'>) =>
  agent.is_default || agent.name.toLowerCase() === 'default' ? 'hermes' : agent.name

export function AgentMenuRows() {
  const profiles = useStore($profiles)
  const agents = profiles.filter(profile => !profile.is_default).slice(0, MAX_ROWS)
  const signature = agents.map(agent => `${agent.name}:${profileLabel(agent)}`).join('|')

  useEffect(() => {
    const disposers = agents.map(agent =>
      registry.register({
        area: COMPOSER_AREAS.attachments,
        data: {
          icon: 'account',
          label: `Agent: ${profileLabel(agent)}`,
          run: ({ insertText }: { insertText: (text: string) => void }) => insertText(`@${mentionOf(agent)} `)
        },
        id: `agent-${agent.name}`
      })
    )

    return () => disposers.forEach(dispose => dispose())
    // The rows depend on the agents' names, not on the array identity a refresh hands back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return null
}
