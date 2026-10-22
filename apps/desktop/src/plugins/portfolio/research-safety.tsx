/**
 * The team's safety drill, beside the reports it produces: pick an agent, prepare the drill in a chat
 * (`safety-drill.ts`), and see that agent's last result. Like every hand-off, nothing runs until the
 * owner sends the request.
 */

import { Button, cn, Codicon, FIGURE_CARD_CLASS } from '@hermes/plugin-sdk'
import { useState } from 'react'

import type { ResearchReport } from './api'
import { COPY } from './copy'
import { dateLabel } from './format'
import { Verdict } from './research-reports'
import { SAFETY_KIND, safetyPrompt } from './safety-drill'
import { AgentSelect, handToAgent, useTeamAgent } from './team-chat'

export function SafetyCard({
  dir,
  onOpen,
  reports
}: {
  dir: string
  onOpen: (name: string) => void
  reports: ResearchReport[]
}) {
  const copy = COPY.research.safety
  const { agent, agents, choose } = useTeamAgent()
  const [busy, setBusy] = useState(false)
  // Reports come newest first, so the first drill by this agent is its latest.
  const last = reports.find(report => report.kind === SAFETY_KIND && report.author === agent)

  const prepare = async () => {
    setBusy(true)
    await handToAgent(agent, safetyPrompt({ agent, dir, today: new Date().toISOString().slice(0, 10) }))
    setBusy(false)
  }

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'gap-3')} data-portfolio-safety="">
      <div>
        <div className="flex items-center gap-2 text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)">
          <Codicon name="shield" />
          {copy.title}
        </div>
        <div className="mt-0.5 text-[0.75rem] leading-relaxed text-(--ui-text-tertiary)">{copy.subtitle}</div>
      </div>
      <AgentSelect agent={agent} agents={agents} onChoose={choose} />
      {last ? (
        <button
          className="flex cursor-pointer flex-wrap items-center gap-1.5 rounded-xl bg-(--card-well) px-3 py-2 text-left text-[0.75rem] text-(--ui-text-secondary) hover:text-(--ui-text-primary)"
          onClick={() => onOpen(last.name)}
          type="button"
        >
          {copy.last}
          <Verdict verdict={last.verdict} />
          <span className="text-(--ui-text-tertiary)">
            {Number.isNaN(Date.parse(last.date)) ? last.date : dateLabel(last.date)}
          </span>
        </button>
      ) : (
        <p className="text-[0.75rem] text-(--ui-text-tertiary)">{copy.never}</p>
      )}
      <p className="text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">{copy.honest}</p>
      <Button disabled={busy || !agent} onClick={() => void prepare()} size="sm" variant="secondary">
        <Codicon className="mr-1.5" name="checklist" />
        {copy.prepare}
      </Button>
    </div>
  )
}
