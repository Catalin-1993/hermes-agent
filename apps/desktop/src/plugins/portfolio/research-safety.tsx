/**
 * The team's safety drill, beside the reports it produces: pick an agent, prepare the drill in a chat
 * (`safety-drill.ts`), and see that agent's last result. Like every hand-off, nothing runs until the
 * owner sends the request.
 */

import { cn, Codicon } from '@hermes/plugin-sdk'
import { useState } from 'react'

import type { ResearchReport } from './api'
import { COPY } from './copy'
import { dateLabel } from './format'
import { Verdict } from './research-reports'
import { SAFETY_KIND, safetyPrompt } from './safety-drill'
import { AgentSelect, handToAgent, useTeamAgent } from './team-chat'
import { BTN, CARD, CARD_PAD_SM, H2, MUTED } from './ui'

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
    <section className={cn(CARD, CARD_PAD_SM, 'gap-2.5')} data-portfolio-safety="">
      <div className="flex flex-col gap-1.5">
        <h2 className={cn(H2, 'flex items-center gap-2.5')}>
          <Codicon name="shield" size="1rem" />
          {copy.title}
        </h2>
        <p className="m-0 text-[0.78125rem] leading-snug text-(--ui-text-secondary)">{copy.subtitle}</p>
      </div>
      <AgentSelect agent={agent} agents={agents} onChoose={choose} />
      {last ? (
        <button
          className="flex cursor-pointer flex-wrap items-center gap-1.5 rounded-xl border border-(--card-well-stroke) bg-(--card-well) px-3.5 py-3 text-left text-[0.8125rem] text-(--ui-text-secondary) hover:text-(--ui-text-primary)"
          onClick={() => onOpen(last.name)}
          type="button"
        >
          {copy.last}
          <Verdict verdict={last.verdict} />
          <span className={MUTED}>{Number.isNaN(Date.parse(last.date)) ? last.date : dateLabel(last.date)}</span>
        </button>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-(--card-well-stroke) bg-(--card-well) px-3.5 py-3">
          <span className="size-2 shrink-0 rounded-full bg-(--ui-text-quaternary)" />
          <span className="text-[0.8125rem] text-(--ui-text-secondary)">{copy.never}</span>
        </div>
      )}
      <p className={cn('m-0 text-[0.71875rem] leading-snug', MUTED)}>{copy.honest}</p>
      <button
        className={cn(BTN, 'h-9 w-full rounded-xl text-[0.8125rem]')}
        disabled={busy || !agent}
        onClick={() => void prepare()}
        type="button"
      >
        <Codicon name="checklist" size="0.9375rem" />
        {copy.prepare}
      </button>
    </section>
  )
}
