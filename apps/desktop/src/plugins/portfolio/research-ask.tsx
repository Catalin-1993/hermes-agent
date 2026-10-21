/**
 * "Ask the team" for an analysis of the open asset: the kind of analysis and the owner's own question,
 * handed to the chosen agent through `team-chat.tsx`.
 */

import { Button, cn, Codicon, FIGURE_CARD_CLASS } from '@hermes/plugin-sdk'
import { useState } from 'react'

import type { ResearchSheet } from './api'
import { COPY } from './copy'
import { ANALYSIS_KINDS, type AnalysisKind, researchPrompt } from './research-prompt'
import { Segmented } from './segmented'
import { AgentSelect, handToAgent, useTeamAgent } from './team-chat'

export function AskTeamCard({ dir, sheet }: { dir: string; sheet: ResearchSheet }) {
  const copy = COPY.research.ask
  const { agent, agents, choose } = useTeamAgent()
  const [kind, setKind] = useState<AnalysisKind>('full')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const prepare = async () => {
    setBusy(true)
    await handToAgent(agent, researchPrompt({ dir, kind, note, sheet, today: new Date().toISOString().slice(0, 10) }))
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
        <AgentSelect agent={agent} agents={agents} onChoose={choose} />
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
        <p className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.howItWorks(agent || COPY.team.noAgent)}</p>
        <Button disabled={busy || !agent} onClick={() => void prepare()} size="sm">
          <Codicon className="mr-1.5" name="comment-discussion" />
          {copy.prepare}
        </Button>
      </div>
    </div>
  )
}
