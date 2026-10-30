/**
 * Plan: the investment plan of one portfolio variant held against the portfolio as it stands — target
 * allocation and what would restore it, the rules and whether they hold, the goals and how far each
 * is, and the strategy in words. The owner edits it here; the team can propose or review it through
 * a chat. The plan itself lives in the backend's plan file, beside the journal.
 */

import { Button, cn, Codicon, EmptyState, host, useMutation, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { useState } from 'react'

import {
  fetchDashboard,
  fetchPlan,
  fetchResearchReports,
  type InvestmentPlan,
  planKey,
  type PortfolioDashboard,
  portfolioKey,
  type PortfolioPlan,
  savePlan
} from './api'
import { COPY } from './copy'
import { dateLabel } from './format'
import { AllocationCard, type Editing, GoalsCard, RulesCard, ThesisCard } from './plan-cards'
import { type ClassRow, classRows, goalProgress, ruleChecks, targetSum } from './plan-math'
import { type PlanAsk, planPrompt } from './plan-prompt'
import { Segmented } from './segmented'
import { AgentSelect, handToAgent, useTeamAgent } from './team-chat'
import { BTN, BTN_PRIMARY, CARD, CARD_PAD, FIELD, H2_LARGE, MUTED, PageHeader } from './ui'

function PlanAskCard({ data, plan, rows }: { data: PortfolioDashboard; plan: PortfolioPlan; rows: ClassRow[] }) {
  const copy = COPY.plan.ask
  const { agent, agents, choose } = useTeamAgent()
  const { data: research } = useQuery({ queryFn: fetchResearchReports, queryKey: ['portfolio', 'research', 'reports'] })
  const [ask, setAsk] = useState<PlanAsk>(plan.saved ? 'review' : 'propose')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const prepare = async () => {
    setBusy(true)
    await handToAgent(
      agent,
      planPrompt({
        ask,
        classes: plan.classes,
        data,
        file: plan.file,
        note,
        plan: plan.plan,
        researchDir: research?.dir ?? '',
        rows,
        today: new Date().toISOString().slice(0, 10)
      })
    )
    setBusy(false)
  }

  return (
    <section className={cn(CARD, CARD_PAD, 'gap-3.5')} data-portfolio-plan-ask="" id="cere-echipei">
      <div className="flex flex-col gap-1.5">
        <h2 className={H2_LARGE}>{copy.title}</h2>
        <p className="m-0 text-[0.8125rem] leading-relaxed text-(--ui-text-secondary)">{copy.subtitle}</p>
      </div>
      <AgentSelect agent={agent} agents={agents} onChoose={choose} />
      <Segmented
        fill
        label={copy.kind}
        onSelect={setAsk}
        options={[
          { id: 'propose', text: copy.kinds.propose },
          { id: 'review', text: copy.kinds.review }
        ]}
        value={ask}
      />
      <p className="m-0 text-[0.8125rem] leading-relaxed text-(--ui-text-secondary)">{copy.hints[ask]}</p>
      <textarea
        aria-label={copy.noteLabel}
        className={cn(FIELD, 'h-auto min-h-16 resize-y py-3')}
        maxLength={600}
        onChange={event => setNote(event.target.value)}
        placeholder={copy.notePlaceholder}
        value={note}
      />
      <button className={BTN_PRIMARY} disabled={busy || !agent} onClick={() => void prepare()} type="button">
        <Codicon name="comment" size="1rem" />
        {COPY.research.ask.prepare}
      </button>
    </section>
  )
}

function VariantSwitch({
  onSelect,
  value,
  variants
}: {
  onSelect: (name: string) => void
  value: string
  variants: string[]
}) {
  return variants.length > 1 ? (
    <Segmented
      label={COPY.dashboard.variant}
      large
      onSelect={onSelect}
      options={variants.map(name => ({ id: name, text: COPY.dashboard.variantName(name) }))}
      value={value}
    />
  ) : null
}

function useSavePlan(variant: string, onSaved: () => void) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (next: InvestmentPlan) => savePlan(variant, next),
    onError: error =>
      host.notify({ kind: 'error', message: `${COPY.plan.saveFailed} ${error instanceof Error ? error.message : ''}` }),
    onSuccess: saved => {
      queryClient.setQueryData(planKey(variant), saved)
      onSaved()
    }
  })
}

function PlanBody({ data, plan }: { data: PortfolioDashboard; plan: PortfolioPlan }) {
  const copy = COPY.plan
  const [draft, setDraft] = useState<InvestmentPlan | null>(null)
  const save = useSavePlan(data.variant, () => setDraft(null))
  const shown = draft ?? plan.plan
  const editing: Editing | null = draft ? { draft, onChange: setDraft } : null
  const rows = classRows(shown, data, plan.classes, Boolean(draft))

  const status =
    plan.saved && plan.plan.updated
      ? copy.updated(dateLabel(plan.plan.updated), plan.plan.updated_by || '—')
      : copy.unsaved

  return (
    <>
      <div
        className="flex items-center gap-3 rounded-[14px] border border-(--card-stroke) bg-(--card-surface) px-4 py-3 text-[0.84375rem] text-(--ui-text-secondary)"
        role="status"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--ui-yellow)_12%,transparent)] text-(--ui-yellow)">
          <Codicon name="info" size="0.9375rem" />
        </span>
        <span className="flex-1">{status}</span>
        {draft ? (
          <div className="flex gap-2">
            <Button onClick={() => setDraft(null)} size="sm" variant="ghost">
              {COPY.lists.cancel}
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate(draft)} size="sm">
              {save.isPending ? copy.saving : copy.save}
            </Button>
          </div>
        ) : (
          <button className={BTN} onClick={() => setDraft(structuredClone(plan.plan))} type="button">
            <Codicon name="edit" size="0.9375rem" />
            {copy.edit}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <AllocationCard editing={editing} rows={rows} sum={targetSum(shown)} />
          <ThesisCard editing={editing} thesis={shown.thesis} />
          <GoalsCard editing={editing} progress={goalProgress(shown.goals, data.total, new Date())} />
        </div>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <RulesCard checks={ruleChecks(shown, data, rows)} editing={editing} plan={shown} />
          {!draft && <PlanAskCard data={data} plan={plan} rows={rows} />}
        </div>
      </div>
      <p className={cn('m-0 text-[0.6875rem] leading-relaxed break-all', MUTED)}>{copy.footer(plan.file)}</p>
    </>
  )
}

export function PlanSection() {
  const copy = COPY.plan
  const [variant, setVariant] = useState('')
  const dashboard = useQuery({ queryFn: () => fetchDashboard(variant), queryKey: portfolioKey(variant) })
  const chosen = dashboard.data?.variant ?? ''

  const plan = useQuery({
    enabled: dashboard.isSuccess,
    queryFn: () => fetchPlan(chosen),
    queryKey: planKey(chosen),
    // The team may write the plan file from a chat; follow it while the page is open.
    refetchInterval: 20_000
  })

  if (dashboard.isLoading || plan.isLoading) {
    return <EmptyState className="min-h-[60vh]" title={copy.loading} />
  }

  if (!dashboard.data || !plan.data) {
    const error = dashboard.error ?? plan.error

    return (
      <EmptyState
        className="min-h-[60vh]"
        description={error instanceof Error ? error.message : undefined}
        title={copy.loadFailed}
      />
    )
  }

  return (
    <>
      <PageHeader subtitle={copy.subtitle} title={copy.title}>
        <VariantSwitch onSelect={setVariant} value={chosen} variants={dashboard.data.variants} />
      </PageHeader>
      <PlanBody data={dashboard.data} key={chosen} plan={plan.data} />
    </>
  )
}
