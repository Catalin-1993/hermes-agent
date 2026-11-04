/**
 * The Team section of a project's hub: the agents you have (the same roster as the Agents page) and a New agent
 * button that opens the Create agent page. Contributed to core's `project.hubSection` area by `plugin.tsx`.
 */

import {
  Button,
  Codicon,
  host,
  profileColor,
  profileColorSoft,
  type ProjectHubContext,
  Tip,
  useQuery
} from '@hermes/plugin-sdk'

import { mentionOf } from './agent-menu'
import { $agentWizard, $boardView, $projectsHome, fetchProfiles, profilesKey, useKanbanScope } from './api'

export const TEAM_COPY = {
  empty: 'No agents yet.',
  addToChat: (name: string) => `Start a chat with ${name}`,
  hint: 'The agents you can work with. Start a chat in this project with one, or add one from the + menu.',
  newAgent: 'New agent',
  title: 'Team'
}

const openWizard = () => {
  $projectsHome.set(false)
  $boardView.set('agents')
  $agentWizard.set(true)
  host.navigate('/kanban')
}

export function ProjectTeam({ hub }: { hub: ProjectHubContext }) {
  const scope = useKanbanScope()
  const { data } = useQuery({ queryFn: fetchProfiles, queryKey: profilesKey(scope), staleTime: 30_000 })
  const agents = data?.profiles ?? []

  return (
    <div className="flex flex-col gap-2">
      {data && agents.length === 0 && <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{TEAM_COPY.empty}</p>}
      <ul className="flex flex-col gap-1.5">
        {agents.map(agent => (
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
              {(agent.display_name || agent.name).slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.8125rem] font-medium text-foreground">
                {agent.display_name || agent.name}
              </div>
              {(agent.title || agent.description) && (
                <div className="truncate text-[0.75rem] text-(--ui-text-tertiary)">
                  {agent.title || agent.description}
                </div>
              )}
            </div>
            {hub.folder && (
              <Tip label={TEAM_COPY.addToChat(agent.display_name || agent.name)}>
                <Button
                  aria-label={TEAM_COPY.addToChat(agent.display_name || agent.name)}
                  onClick={() => hub.startChat(`@${mentionOf(agent)} `)}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Codicon name="comment-add" size="0.8125rem" />
                </Button>
              </Tip>
            )}
          </li>
        ))}
      </ul>
      <Button className="self-start" onClick={openWizard} size="sm" variant="outline">
        <Codicon name="person-add" size="0.8rem" />
        {TEAM_COPY.newAgent}
      </Button>
    </div>
  )
}
