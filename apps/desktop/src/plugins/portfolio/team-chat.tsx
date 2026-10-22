/**
 * The one way the Portfolio page hands work to the investment team: a new chat with the agent the
 * owner picked, the request written into its input. The owner reviews and sends it; the page never
 * sends on its own, so no agent work (or cost) starts without them. Used by Research, Plan and Backtesting.
 * Research and Backtesting can also ask the investment committee instead of one agent (`committee.ts`).
 */

import { host, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useQuery } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { type Panel, PANELS } from './committee'
import { COPY } from './copy'
import { Segmented } from './segmented'
import { readPreference, writePreference } from './storage'

const AGENT_KEY = 'research.agent'
const PANEL_KEY = 'team.panel'
const TEAM_HINT = /invest|portof|manager|finan/i

async function agentNames(): Promise<string[]> {
  try {
    const routes = await host.profileRoutes()

    return [...new Set(routes.map(route => route.profile))].sort()
  } catch {
    return ['default']
  }
}

/** The fresh chat's composer mounts a moment after navigation; ask it until it answers. */
async function fillNewChat(text: string): Promise<boolean> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (await host.composer.setDraft('new', text)) {
      return true
    }

    await new Promise(resolve => setTimeout(resolve, 200))
  }

  return false
}

/** Opens the chat and writes the request; when no composer answers, the request is copied instead. */
export async function handToAgent(agent: string, text: string): Promise<void> {
  writePreference(AGENT_KEY, agent)
  host.newChat(agent)

  if (!(await fillNewChat(text))) {
    await navigator.clipboard?.writeText(text).catch(() => undefined)
    host.notify({ kind: 'info', message: COPY.team.copied })
  }
}

/** The agents to choose from and the one chosen: the owner's last pick, else the likeliest team lead. */
export function useTeamAgent(): { agent: string; agents: string[]; choose: (name: string) => void } {
  const { data: agents = [] } = useQuery({
    queryFn: agentNames,
    queryKey: ['portfolio', 'team', 'agents'],
    staleTime: 60_000
  })

  const [chosen, setChosen] = useState('')
  const remembered = readPreference<string>(AGENT_KEY, '')

  const agent =
    [chosen, remembered].find(name => name && agents.includes(name)) ??
    agents.find(name => TEAM_HINT.test(name)) ??
    agents[0] ??
    ''

  return {
    agent,
    agents,
    choose: name => {
      setChosen(name)
      writePreference(AGENT_KEY, name)
    }
  }
}

export function AgentSelect({
  agent,
  agents,
  onChoose
}: {
  agent: string
  agents: string[]
  onChoose: (name: string) => void
}) {
  const copy = COPY.team

  return (
    <label className="flex items-center gap-2 text-[0.75rem] text-(--ui-text-tertiary)">
      {copy.agent}
      <Select onValueChange={onChoose} value={agent}>
        <SelectTrigger aria-label={copy.agent} className="h-7 min-w-36 rounded-full text-[0.75rem]">
          <SelectValue placeholder={copy.noAgent} />
        </SelectTrigger>
        <SelectContent>
          {agents.map(name => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

/** One agent or the committee, remembered between requests (the owner's habit, not per asset). */
export function usePanel(): [Panel, (panel: Panel) => void] {
  const [panel, setPanel] = useState<Panel>(() => {
    const remembered = readPreference<string>(PANEL_KEY, 'one')

    return PANELS.find(id => id === remembered) ?? 'one'
  })

  return [
    panel,
    next => {
      setPanel(next)
      writePreference(PANEL_KEY, next)
    }
  ]
}

/** "Cine răspunde: [Un agent | Comitetul]", with what the committee does once it is picked. */
export function PanelChoice({ onChoose, panel }: { onChoose: (panel: Panel) => void; panel: Panel }) {
  const copy = COPY.team

  return (
    <div className="flex items-center gap-2 text-[0.75rem] text-(--ui-text-tertiary)">
      {copy.panel}
      <Segmented
        label={copy.panel}
        onSelect={onChoose}
        options={PANELS.map(id => ({ id, text: copy.panels[id] }))}
        value={panel}
      />
    </div>
  )
}

export function CommitteeHint({ panel }: { panel: Panel }) {
  return panel === 'committee' ? (
    <p className="rounded-xl bg-(--card-well) px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-(--ui-text-secondary)">
      {COPY.team.committeeHint}
    </p>
  ) : null
}
