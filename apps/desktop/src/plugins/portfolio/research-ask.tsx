/**
 * "Ask the team" for an analysis of the open asset: the kind of analysis and the owner's own question,
 * handed to the chosen agent through `team-chat.tsx`.
 */

import { cn, Codicon } from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import type { ResearchSheet } from './api'
import { COPY } from './copy'
import { ANALYSIS_KINDS, type AnalysisKind, researchPrompt } from './research-prompt'
import { Segmented } from './segmented'
import { AgentSelect, CommitteeHint, handToAgent, PanelChoice, usePanel, useTeamAgent } from './team-chat'
import { BTN_PRIMARY, CARD, CARD_PAD, FIELD, H2_LARGE, MUTED } from './ui'

export function AskTeamCard({ dir, sheet }: { dir: string; sheet: ResearchSheet }) {
  const copy = COPY.research.ask
  const { agent, agents, choose } = useTeamAgent()
  const [kind, setKind] = useState<AnalysisKind>('full')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = usePanel()

  const prepare = async () => {
    setBusy(true)
    await handToAgent(
      agent,
      researchPrompt({ dir, kind, note, panel, sheet, today: new Date().toISOString().slice(0, 10) })
    )
    setBusy(false)
  }

  return (
    <section className={cn(CARD, CARD_PAD, 'gap-4')} data-portfolio-ask="">
      <div className="flex flex-col gap-1.5">
        <h2 className={H2_LARGE}>{copy.title(sheet.symbol)}</h2>
        <p className="m-0 text-[0.84375rem] text-(--ui-text-secondary)">{copy.subtitle}</p>
      </div>
      <div className="flex flex-col gap-3.5">
        <Step n={1}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4">
            <AgentSelect agent={agent} agents={agents} onChoose={choose} />
            <PanelChoice onChoose={setPanel} panel={panel} />
          </div>
        </Step>
        <Step n={2}>
          <div className="flex flex-col gap-2.5">
            <span className="text-[0.8125rem] font-medium text-(--ui-text-secondary)">{copy.kind}</span>
            <div className="self-start">
              <Segmented
                label={copy.kind}
                onSelect={setKind}
                options={ANALYSIS_KINDS.map(id => ({ id, text: copy.kinds[id] }))}
                value={kind}
              />
            </div>
            <span className="text-[0.8125rem] text-(--ui-text-secondary)">{copy.kindHint[kind]}</span>
            <CommitteeHint panel={panel} />
          </div>
        </Step>
        <Step n={3}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium text-(--ui-text-secondary)">
              {copy.noteLabel} <span className={cn('font-normal', MUTED)}>{copy.optional}</span>
            </span>
            <textarea
              className={cn(FIELD, 'h-auto min-h-20 resize-y py-3')}
              maxLength={600}
              onChange={event => setNote(event.target.value)}
              placeholder={copy.notePlaceholder}
              rows={3}
              value={note}
            />
          </label>
        </Step>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-(--card-well-stroke) pt-[18px]">
        <span className={cn('text-[0.78125rem]', MUTED)}>{copy.howItWorks(agent || COPY.team.noAgent)}</span>
        <button className={BTN_PRIMARY} disabled={busy || !agent} onClick={() => void prepare()} type="button">
          <Codicon name="comment" size="1rem" />
          {copy.prepare}
        </button>
      </div>
    </section>
  )
}

/** A numbered step of the request: a round number at the left, its controls beside it. */
export function Step({ children, n }: { children: ReactNode; n: number }) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3.5">
      <span className="mt-0.5 grid size-[26px] place-items-center rounded-full bg-(--card-well) text-xs font-semibold tabular-nums text-(--ui-text-secondary)">
        {n}
      </span>
      {children}
    </div>
  )
}
