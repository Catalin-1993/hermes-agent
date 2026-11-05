/**
 * New agent: a five-step page in place of the team chart (Identity → Model → Tools & integrations → Invocations →
 * Knowledge), with the agent's card on the right filling in as you type, and Create Agent always at the top right.
 * Only the name is required, so Create Agent works from any step. What each choice turns into is in
 * `agent-wizard-model`; the backend calls are in `agent-wizard-run`.
 */

import { useQuery } from '@tanstack/react-query'
import { type ReactElement, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { profileColor, profileColorSoft } from '@/lib/profile-color'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { refreshProfiles } from '@/store/profile'

import { WIZARD } from './copy'
import {
  agentSlug,
  budgetUsd,
  countOn,
  createPlan,
  EMPTY_DRAFT,
  nameProblem,
  WIZARD_STEPS,
  type WizardBase,
  type WizardDraft,
  type WizardStep
} from './model'
import { fetchWizardBase, runPlan } from './run'
import {
  IdentityStep,
  InvocationsStep,
  KnowledgeStep,
  ModelStep,
  type StepProps,
  type TeamMember,
  ToolsStep
} from './steps'

const FALLBACK = '#8b8bf5'

function Stepper({ at, onPick }: { at: WizardStep; onPick: (step: WizardStep) => void }) {
  const index = WIZARD_STEPS.indexOf(at)

  return (
    <ol className="flex min-w-0 items-center gap-1 overflow-x-auto" data-wizard-steps="">
      {WIZARD_STEPS.map((step, i) => (
        <li className="flex shrink-0 items-center gap-1" key={step}>
          {i > 0 && <span aria-hidden className="h-px w-4 bg-(--ui-stroke-secondary)" />}
          <button
            aria-current={step === at ? 'step' : undefined}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] transition-colors',
              step === at
                ? 'bg-(--ui-control-active-background) font-medium text-foreground'
                : 'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
            )}
            onClick={() => onPick(step)}
            type="button"
          >
            <span
              className={cn(
                'grid size-4 place-items-center rounded-full text-[0.625rem] font-semibold',
                i < index ? 'bg-foreground text-background' : 'border border-current'
              )}
            >
              {i < index ? <Codicon name="check" size="0.6rem" /> : i + 1}
            </span>
            {WIZARD.steps[step]}
          </button>
        </li>
      ))}
    </ol>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-(--ui-bg-tertiary) px-2.5 py-2">
      <span className="text-[0.625rem] tracking-[0.06em] text-(--ui-text-tertiary) uppercase">{label}</span>
      <span className="text-[0.875rem] font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  )
}

/** The agent's card as it will look: banner in its colour, initials, name, role, description, model and counts. */
export function AgentPreview({ base, draft }: { base: WizardBase | undefined; draft: WizardDraft }) {
  const slug = agentSlug(draft.name)
  const color = (slug && profileColor(slug)) || FALLBACK
  const name = draft.name.trim() || WIZARD.preview.unnamed
  const words = name.split(/[\s_-]+/).filter(Boolean)
  const initials = (words.length > 1 ? words[0]![0]! + words[1]![0]! : name.slice(0, 2)).toUpperCase()
  const budget = budgetUsd(draft.budget)
  const invocations = 3 + (draft.schedule.enabled ? 1 : 0)

  return (
    <aside
      className="overflow-hidden rounded-2xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) shadow-sm"
      data-agent-preview=""
    >
      <div
        className="h-20"
        style={{ background: `linear-gradient(135deg, ${color}, ${profileColorSoft(color, 35)})` }}
      />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <span
          className="-mt-7 grid size-14 place-items-center rounded-2xl border-4 border-(--ui-bg-elevated) text-[1.125rem] font-semibold"
          style={{ backgroundColor: profileColorSoft(color, 30), color }}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[1rem] font-semibold text-foreground">{name}</div>
          {draft.title.trim() && (
            <div className="truncate text-[0.75rem] text-(--ui-text-secondary)">{draft.title.trim()}</div>
          )}
          <p className="mt-1.5 line-clamp-3 text-[0.75rem] text-(--ui-text-tertiary)">
            {draft.description.trim() || WIZARD.preview.noDescription}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-(--ui-stroke-tertiary) px-2.5 py-1.5 text-[0.75rem] text-(--ui-text-secondary)">
          <Codicon name="sparkle" size="0.8rem" />
          <span className="min-w-0 flex-1 truncate">{draft.model.trim() || WIZARD.preview.defaultModel}</span>
          {draft.effort && <span className="text-(--ui-text-tertiary)">{draft.effort}</span>}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label={WIZARD.preview.invocations} value={invocations} />
          <Stat
            label={WIZARD.preview.integrations}
            value={base ? countOn(draft.integrations, base.integrations) : '…'}
          />
          <Stat label={WIZARD.preview.tools} value={base ? countOn(draft.toolsets, base.toolsets) : '…'} />
          <Stat label={WIZARD.preview.skills} value={base ? countOn(draft.skills, base.skills) : '…'} />
          <Stat label={WIZARD.preview.memory} value={draft.memory ? WIZARD.preview.on : WIZARD.preview.off} />
          <Stat label={WIZARD.preview.budget} value={budget === null ? WIZARD.preview.noCap : `$${budget}`} />
        </div>
      </div>
    </aside>
  )
}

const PAGES: Record<Exclude<WizardStep, 'identity'>, (props: StepProps) => ReactElement> = {
  model: ModelStep,
  tools: ToolsStep,
  invocations: InvocationsStep,
  knowledge: KnowledgeStep
}

function useCreate(draft: WizardDraft, base: WizardBase | undefined, onClose: () => void) {
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    const plan = createPlan(draft, base ?? { integrations: [], skills: [], toolsets: [] })

    try {
      const missed = await runPlan(plan)
      const name = draft.name.trim()
      notify({
        kind: missed.length ? 'warning' : 'success',
        message: missed.length ? WIZARD.partly(name, missed.join(', ')) : WIZARD.done(name)
      })
      await refreshProfiles()
      onClose()
    } catch (failure) {
      notifyError(failure, WIZARD.failed)
    }

    setBusy(false)
  }

  return { busy, create }
}

function AgentWizard({ onClose, profiles }: { onClose: () => void; profiles: TeamMember[] }) {
  const [step, setStep] = useState<WizardStep>('identity')
  const [draft, setDraft] = useState<WizardDraft>(EMPTY_DRAFT)
  const [touched, setTouched] = useState(false)

  const { data: base } = useQuery({
    queryFn: fetchWizardBase,
    queryKey: ['agent-wizard', 'base'],
    staleTime: 60_000
  })

  const problem = nameProblem(
    draft.name,
    profiles.map(profile => profile.name)
  )

  const { busy, create } = useCreate(draft, base, onClose)
  const index = WIZARD_STEPS.indexOf(step)
  const patch = (next: Partial<WizardDraft>) => setDraft(current => ({ ...current, ...next }))
  const props: StepProps = { base, draft, patch }
  const Page = step === 'identity' ? null : PAGES[step]

  const submit = () => {
    setTouched(true)

    if (problem) {
      setStep('identity')

      return
    }

    void create()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-agent-wizard="">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-(--ui-stroke-tertiary) px-4 py-2.5">
        <button
          aria-label={WIZARD.back}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-(--ui-text-secondary) hover:bg-(--chrome-action-hover) hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <Codicon name="arrow-left" size="0.95rem" />
        </button>
        <h2 className="flex-1 text-[0.9375rem] font-semibold text-foreground md:flex-none">{WIZARD.title}</h2>
        <div className="order-last flex w-full min-w-0 justify-center md:order-none md:w-auto md:flex-1">
          <Stepper at={step} onPick={setStep} />
        </div>
        <Button disabled={busy} onClick={submit} size="sm">
          <Codicon name="add" size="0.8rem" />
          {busy ? WIZARD.creating : WIZARD.create}
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="flex min-w-0 flex-col gap-5">
            <div>
              <h3 className="text-[1.125rem] font-semibold text-foreground">{WIZARD.steps[step]}</h3>
              <p className="mt-1 text-[0.8125rem] text-(--ui-text-tertiary)">{WIZARD.intro[step]}</p>
            </div>
            {Page ? (
              <Page {...props} />
            ) : (
              <IdentityStep {...props} problem={problem} profiles={profiles} touched={touched || Boolean(draft.name)} />
            )}
            <div className="flex items-center justify-between border-t border-(--ui-stroke-tertiary) pt-4">
              <Button
                disabled={index === 0}
                onClick={() => setStep(WIZARD_STEPS[index - 1]!)}
                size="sm"
                variant="ghost"
              >
                {WIZARD.previous}
              </Button>
              {index < WIZARD_STEPS.length - 1 ? (
                <Button onClick={() => setStep(WIZARD_STEPS[index + 1]!)} size="sm" variant="outline">
                  {WIZARD.next}
                  <Codicon name="arrow-right" size="0.8rem" />
                </Button>
              ) : (
                <Button disabled={busy} onClick={submit} size="sm">
                  {busy ? WIZARD.creating : WIZARD.create}
                </Button>
              )}
            </div>
          </section>
          <div className="lg:sticky lg:top-0 lg:self-start">
            <AgentPreview base={base} draft={draft} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The New agent wizard as a window over whatever is on screen: five steps, the agent's card filling in beside them. */
export function NewAgentDialog({
  onClose,
  open,
  profiles
}: {
  onClose: () => void
  open: boolean
  profiles: TeamMember[]
}) {
  return (
    <Dialog onOpenChange={value => !value && onClose()} open={open}>
      <DialogContent
        bodyClassName="flex flex-1 flex-col gap-0 overflow-hidden p-0"
        className="h-[88vh] w-[94vw] max-w-[72rem]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{WIZARD.title}</DialogTitle>
        <AgentWizard onClose={onClose} profiles={profiles} />
      </DialogContent>
    </Dialog>
  )
}
