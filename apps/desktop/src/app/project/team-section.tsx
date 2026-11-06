/**
 * The Team section of the project hub: the agents you have (the app's own profile list, the same everywhere, so an
 * agent made once is there in every project), a button that starts a chat in the project with one of them, and New
 * agent, the five-step New agent wizard.
 */

import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { NewAgentDialog } from '@/app/agent-wizard/wizard'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { profileColor, profileColorSoft } from '@/lib/profile-color'
import { $profiles, profileLabel } from '@/store/profile'
import { requestStartWorkSession } from '@/store/projects'

import { mentionOf } from './agent-menu-rows'

export const TEAM = {
  addToChat: (name: string) => `Start a chat with ${name}`,
  empty: 'No agents yet.',
  hint: 'The agents you can work with, the same in every project. Start a chat with one here, or add one from the + menu in a chat.',
  newAgent: 'New agent',
  title: 'Team'
}

export function TeamSection({ folder, listOpen = true }: { folder: null | string; listOpen?: boolean }) {
  const profiles = useStore($profiles)
  const [creating, setCreating] = useState(false)
  const agents = profiles.filter(profile => !profile.is_default)

  return (
    <div className="flex flex-col gap-2">
      {agents.length === 0 && <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{TEAM.empty}</p>}
      {listOpen && (
        <ul className="flex flex-col gap-1.5">
          {agents.map(agent => {
            const name = profileLabel(agent)

            return (
              <li
                className="flex items-center gap-2.5 rounded-lg border border-(--ui-stroke-tertiary) px-3 py-2"
                key={agent.name}
              >
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold uppercase"
                  style={{
                    backgroundColor: profileColorSoft(agent.name) ?? undefined,
                    color: profileColor(agent.name) ?? undefined
                  }}
                >
                  {name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-foreground">{name}</div>
                {folder && (
                  <Tip label={TEAM.addToChat(name)}>
                    <Button
                      aria-label={TEAM.addToChat(name)}
                      onClick={() => requestStartWorkSession(folder, `@${mentionOf(agent)} `, { openTab: true })}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <Codicon name="comment-add" size="0.8125rem" />
                    </Button>
                  </Tip>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Button className="self-start" onClick={() => setCreating(true)} size="sm" variant="outline">
        <Codicon name="person-add" size="0.8rem" />
        {TEAM.newAgent}
      </Button>
      <NewAgentDialog onClose={() => setCreating(false)} open={creating} profiles={profiles} />
    </div>
  )
}
