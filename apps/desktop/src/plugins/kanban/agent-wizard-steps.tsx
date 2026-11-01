/**
 * The five pages of the New agent wizard. Each is a plain form over the draft: the wizard owns the state, these
 * only read it and send patches back.
 */

import {
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea
} from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import { WIZARD } from './agent-wizard-copy'
import {
  agentSlug,
  countOn,
  isOn,
  type NameProblem,
  type Schedule,
  setAll,
  type Toggle,
  type WizardBase,
  type WizardDraft
} from './agent-wizard-model'
import { ModelOverrideField } from './model-override'
import type { KanbanProfile } from './types'

export interface StepProps {
  base: WizardBase | undefined
  draft: WizardDraft
  patch: (next: Partial<WizardDraft>) => void
}

const TOP = '__top__'

export function Field({ children, hint, label }: { children: ReactNode; hint?: ReactNode; label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.75rem] font-medium text-(--ui-text-secondary)">{label}</span>
      {children}
      {hint && <span className="text-[0.6875rem] text-(--ui-text-tertiary)">{hint}</span>}
    </label>
  )
}

/** A titled group of rows, the way the app's settings group them. */
function Group({ action, children, title }: { action?: ReactNode; children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[0.6875rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
          {title}
        </h3>
        {action}
      </div>
      <div className="divide-y divide-(--ui-stroke-tertiary) rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated)">
        {children}
      </div>
    </section>
  )
}

function Row({
  checked,
  description,
  disabled,
  label,
  meta,
  onChange
}: {
  checked: boolean
  description?: ReactNode
  disabled?: boolean
  label: string
  meta?: string
  onChange?: (on: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[0.8125rem] font-medium text-foreground">{label}</span>
          {meta && <span className="shrink-0 text-[0.6875rem] text-(--ui-text-tertiary)">{meta}</span>}
        </div>
        {description && <p className="mt-0.5 text-[0.6875rem] text-(--ui-text-tertiary)">{description}</p>}
      </div>
      {onChange ? (
        <Switch aria-label={label} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      ) : (
        <span className="shrink-0 rounded-full bg-(--ui-bg-tertiary) px-2 py-0.5 text-[0.625rem] text-(--ui-text-secondary)">
          {WIZARD.always}
        </span>
      )}
    </div>
  )
}

function AllNone({ items, onPick }: { items: readonly Toggle[]; onPick: (picks: Record<string, boolean>) => void }) {
  const button =
    'cursor-pointer rounded-md px-1.5 py-0.5 text-[0.6875rem] text-(--ui-text-secondary) hover:bg-(--chrome-action-hover) hover:text-foreground'

  return (
    <span className="flex items-center gap-0.5">
      <button className={button} onClick={() => onPick(setAll(items, true))} type="button">
        {WIZARD.all}
      </button>
      <button className={button} onClick={() => onPick(setAll(items, false))} type="button">
        {WIZARD.none}
      </button>
    </span>
  )
}

/** One list of switches with All / None and, for long lists, a filter. */
function ToggleList({
  empty,
  items,
  meta,
  onPick,
  picks,
  title
}: {
  empty: string
  items: readonly Toggle[]
  meta?: (item: Toggle) => string | undefined
  onPick: (picks: Record<string, boolean>) => void
  picks: Record<string, boolean>
  title: string
}) {
  const [filter, setFilter] = useState('')
  const needle = filter.trim().toLowerCase()
  const shown = needle ? items.filter(item => `${item.label ?? ''} ${item.name}`.toLowerCase().includes(needle)) : items

  return (
    <Group
      action={
        items.length > 0 && (
          <span className="flex items-center gap-2">
            <span className="text-[0.6875rem] text-(--ui-text-tertiary) tabular-nums">
              {countOn(picks, items)}/{items.length}
            </span>
            <AllNone items={items} onPick={next => onPick({ ...picks, ...next })} />
          </span>
        )
      }
      title={title}
    >
      {items.length > 8 && (
        <div className="px-2 py-1.5">
          <Input
            aria-label={`${title}: ${WIZARD.search}`}
            className="h-7 text-[0.75rem]"
            onChange={event => setFilter(event.target.value)}
            placeholder={WIZARD.search}
            value={filter}
          />
        </div>
      )}
      {items.length === 0 && <p className="px-3 py-3 text-[0.75rem] text-(--ui-text-tertiary)">{empty}</p>}
      <div className={cn(items.length > 8 && 'max-h-80 overflow-y-auto')}>
        {shown.map(item => (
          <Row
            checked={isOn(picks, item)}
            description={item.description}
            key={item.name}
            label={item.label ?? item.name}
            meta={meta?.(item)}
            onChange={on => onPick({ ...picks, [item.name]: on })}
          />
        ))}
      </div>
    </Group>
  )
}

export function IdentityStep({
  draft,
  patch,
  problem,
  profiles,
  touched
}: StepProps & { problem: NameProblem | null; profiles: KanbanProfile[]; touched: boolean }) {
  const slug = agentSlug(draft.name)

  return (
    <div className="flex flex-col gap-4">
      <Field
        hint={
          touched && problem ? (
            <span className="text-destructive">{WIZARD.nameProblem[problem]}</span>
          ) : (
            WIZARD.nameHint(slug)
          )
        }
        label={WIZARD.name}
      >
        <Input
          aria-invalid={touched && problem !== null}
          autoFocus
          onChange={event => patch({ name: event.target.value })}
          placeholder={WIZARD.namePlaceholder}
          value={draft.name}
        />
      </Field>
      <Field label={WIZARD.description}>
        <Textarea
          className="min-h-16 resize-none"
          onChange={event => patch({ description: event.target.value })}
          placeholder={WIZARD.descriptionPlaceholder}
          value={draft.description}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={WIZARD.role}>
          <Input
            onChange={event => patch({ title: event.target.value })}
            placeholder={WIZARD.rolePlaceholder}
            value={draft.title}
          />
        </Field>
        <Field label={WIZARD.reportsTo}>
          <Select
            onValueChange={value => patch({ reportsTo: value === TOP ? '' : value })}
            value={draft.reportsTo || TOP}
          >
            <SelectTrigger aria-label={WIZARD.reportsTo}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOP}>{WIZARD.reportsToNone}</SelectItem>
              {profiles.map(profile => (
                <SelectItem key={profile.name} value={profile.name}>
                  {profile.title ? `${profile.name} · ${profile.title}` : profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field hint={WIZARD.soulHint} label={WIZARD.soul}>
        <Textarea
          className="min-h-40 font-mono text-[0.75rem]"
          onChange={event => patch({ soul: event.target.value })}
          placeholder={WIZARD.soulPlaceholder}
          value={draft.soul}
        />
      </Field>
    </div>
  )
}

export function ModelStep({ draft, patch }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <Field hint={`${WIZARD.modelHint} ${WIZARD.effortHint}`} label={WIZARD.model}>
        <ModelOverrideField
          onChange={next => patch({ effort: next.effort, model: next.model, provider: next.provider })}
          value={{ effort: draft.effort, model: draft.model, provider: draft.provider }}
        />
      </Field>
      <Field hint={WIZARD.budgetHint} label={WIZARD.budget}>
        <Input
          className="max-w-40 tabular-nums"
          inputMode="decimal"
          onChange={event => patch({ budget: event.target.value })}
          placeholder="25"
          value={draft.budget}
        />
      </Field>
    </div>
  )
}

export function ToolsStep({ base, draft, patch }: StepProps) {
  if (!base) {
    return <Loading />
  }

  return (
    <div className="flex flex-col gap-5">
      <ToggleList
        empty=""
        items={base.toolsets}
        meta={item => (item.count ? WIZARD.tools(item.count) : undefined)}
        onPick={toolsets => patch({ toolsets })}
        picks={draft.toolsets}
        title={WIZARD.toolsets}
      />
      <ToggleList
        empty={WIZARD.integrationsEmpty}
        items={base.integrations}
        onPick={integrations => patch({ integrations })}
        picks={draft.integrations}
        title={WIZARD.integrations}
      />
    </div>
  )
}

const EVERY = [30, 60, 120, 240, 480, 1440]
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

function HourSelect({ label, onChange, value }: { label: string; onChange: (hour: number) => void; value: number }) {
  return (
    <Select onValueChange={hour => onChange(Number(hour))} value={String(value)}>
      <SelectTrigger aria-label={label} className="h-7 w-20 text-[0.75rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {HOURS.map(hour => (
          <SelectItem key={hour} value={String(hour)}>
            {`${String(hour).padStart(2, '0')}:00`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ScheduleFields({ onChange, schedule }: { onChange: (next: Schedule) => void; schedule: Schedule }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pb-3 text-[0.75rem] text-(--ui-text-secondary)">
      <span>{WIZARD.every}</span>
      <Select
        onValueChange={minutes => onChange({ ...schedule, everyMinutes: Number(minutes) })}
        value={String(schedule.everyMinutes)}
      >
        <SelectTrigger aria-label={WIZARD.every} className="h-7 w-24 text-[0.75rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EVERY.map(minutes => (
            <SelectItem key={minutes} value={String(minutes)}>
              {WIZARD.minutes(minutes)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>{WIZARD.from}</span>
      <HourSelect
        label={WIZARD.from}
        onChange={startHour => onChange({ ...schedule, startHour })}
        value={schedule.startHour}
      />
      <span>{WIZARD.to}</span>
      <HourSelect label={WIZARD.to} onChange={endHour => onChange({ ...schedule, endHour })} value={schedule.endHour} />
      <label className="ml-1 flex items-center gap-2">
        <Switch
          aria-label={WIZARD.weekdays}
          checked={schedule.weekdaysOnly}
          onCheckedChange={weekdaysOnly => onChange({ ...schedule, weekdaysOnly })}
        />
        {WIZARD.weekdays}
      </label>
    </div>
  )
}

export function InvocationsStep({ draft, patch }: StepProps) {
  const schedule = draft.schedule

  return (
    <div className="flex flex-col gap-5">
      <Group title={WIZARD.steps.invocations}>
        <Row checked description={WIZARD.boardHint} label={WIZARD.board} />
        <Row checked description={WIZARD.chatHint} label={WIZARD.chat} />
        <Row checked description={WIZARD.teamHint} label={WIZARD.team} />
        <div>
          <Row
            checked={schedule.enabled}
            description={WIZARD.scheduleHint}
            label={WIZARD.schedule}
            onChange={enabled => patch({ schedule: { ...schedule, enabled } })}
          />
          {schedule.enabled && <ScheduleFields onChange={next => patch({ schedule: next })} schedule={schedule} />}
        </div>
      </Group>
      <p className="flex items-start gap-2 rounded-lg bg-(--ui-bg-tertiary) px-3 py-2 text-[0.75rem] text-(--ui-text-secondary)">
        <span className="font-medium text-foreground">{WIZARD.messaging}</span>
        <span>{WIZARD.messagingHint}</span>
      </p>
    </div>
  )
}

export function KnowledgeStep({ base, draft, patch }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <Group title={WIZARD.memory}>
        <Row
          checked={draft.memory}
          description={WIZARD.memoryHint}
          label={WIZARD.memory}
          onChange={memory => patch({ memory })}
        />
        <Row
          checked={draft.userProfile}
          description={WIZARD.userProfileHint}
          label={WIZARD.userProfile}
          onChange={userProfile => patch({ userProfile })}
        />
        <Row checked description={WIZARD.projectJournalHint} label={WIZARD.projectJournal} />
      </Group>
      {base ? (
        <ToggleList
          empty={WIZARD.skillsEmpty}
          items={base.skills}
          onPick={skills => patch({ skills })}
          picks={draft.skills}
          title={WIZARD.skills}
        />
      ) : (
        <Loading />
      )}
    </div>
  )
}

const Loading = () => <div className="py-8 text-center text-[0.75rem] text-(--ui-text-quaternary)">…</div>
