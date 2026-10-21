/**
 * "Ask the team": prepares the request for an agent of the owner's choosing in a new chat — the
 * request is written into the chat's input and the owner reviews and sends it. The page never sends
 * on its own: the agent's work (and its cost) starts only when the owner presses Send.
 */

import {
  Button,
  cn,
  Codicon,
  FIGURE_CARD_CLASS,
  host,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useQuery
} from '@hermes/plugin-sdk'
import { useState } from 'react'

import type { ResearchSheet } from './api'
import { COPY } from './copy'
import { ANALYSIS_KINDS, type AnalysisKind, researchPrompt } from './research-prompt'
import { Segmented } from './segmented'
import { readPreference, writePreference } from './storage'

const AGENT_KEY = 'research.agent'
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

export function AskTeamCard({ dir, sheet }: { dir: string; sheet: ResearchSheet }) {
  const copy = COPY.research.ask

  const { data: agents = [] } = useQuery({
    queryFn: agentNames,
    queryKey: ['portfolio', 'research', 'agents'],
    staleTime: 60_000
  })

  const remembered = readPreference<string>(AGENT_KEY, '')
  const [chosen, setChosen] = useState('')

  const agent =
    [chosen, remembered].find(name => name && agents.includes(name)) ??
    agents.find(name => TEAM_HINT.test(name)) ??
    agents[0] ??
    ''

  const [kind, setKind] = useState<AnalysisKind>('full')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const prepare = async () => {
    setBusy(true)
    writePreference(AGENT_KEY, agent)
    const text = researchPrompt({ dir, kind, note, sheet, today: new Date().toISOString().slice(0, 10) })
    host.newChat(agent)

    if (!(await fillNewChat(text))) {
      await navigator.clipboard?.writeText(text).catch(() => undefined)
      host.notify({ kind: 'info', message: copy.copied })
    }

    setBusy(false)
  }

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'gap-3')} data-portfolio-ask="">
      <div>
        <div className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)">
          {copy.title(sheet.symbol)}
        </div>
        <div className="mt-0.5 text-[0.75rem] leading-relaxed text-(--ui-text-tertiary)">{copy.subtitle}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[0.75rem] text-(--ui-text-tertiary)">
          {copy.agent}
          <Select
            onValueChange={value => {
              setChosen(value)
              writePreference(AGENT_KEY, value)
            }}
            value={agent}
          >
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
        <Segmented
          label={copy.kind}
          onSelect={setKind}
          options={ANALYSIS_KINDS.map(id => ({ id, text: copy.kinds[id] }))}
          value={kind}
        />
      </div>
      <p className="text-[0.75rem] leading-relaxed text-(--ui-text-tertiary)">{copy.kindHint[kind]}</p>
      <textarea
        aria-label={copy.noteLabel}
        className="min-h-16 resize-y rounded-xl bg-(--card-well) px-3.5 py-2.5 text-[0.8125rem] text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:ring-1 focus-visible:ring-(--ui-text-tertiary)"
        maxLength={600}
        onChange={event => setNote(event.target.value)}
        placeholder={copy.notePlaceholder}
        value={note}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.howItWorks(agent || copy.noAgent)}</p>
        <Button disabled={busy || !agent} onClick={() => void prepare()} size="sm">
          <Codicon className="mr-1.5" name="comment-discussion" />
          {copy.prepare}
        </Button>
      </div>
    </div>
  )
}
