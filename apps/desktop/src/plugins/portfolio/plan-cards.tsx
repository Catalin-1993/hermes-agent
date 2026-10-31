/**
 * The Plan page's cards. Each reads the plan against the portfolio (`plan-math.ts`) and, while the
 * owner edits, turns its numbers into fields; every change goes up through one `onChange` so the
 * page saves the whole plan at once.
 */

import { Button, cn, Codicon, MessageTextContent, randomUuid } from '@hermes/plugin-sdk'

import type { InvestmentPlan, PlanGoal, PlanRule } from './api'
import { COPY } from './copy'
import { dateLabel, euro, percent } from './format'
import type { ClassRow, GoalProgress, RuleCheck } from './plan-math'
import { FIELD as BASE_FIELD, BTN, CARD, CARD_PAD, CardHead, CountPill, EmptyDashed, MUTED } from './ui'

/** The plan's editing fields are the page's field, a size down so a row of them fits. */
const FIELD = cn(BASE_FIELD, 'h-8 w-auto rounded-lg px-2.5 text-[0.8125rem] tabular-nums')

export interface Editing {
  draft: InvestmentPlan
  onChange: (next: InvestmentPlan) => void
}

function NumberField({
  label,
  onChange,
  suffix,
  value
}: {
  label: string
  onChange: (value: number) => void
  suffix: string
  value: number
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        aria-label={label}
        className={cn(FIELD, 'w-16 text-right')}
        inputMode="decimal"
        min={0}
        onChange={event => onChange(Number(event.target.value.replace(',', '.')) || 0)}
        step="0.5"
        type="number"
        value={value}
      />
      <span className="text-[0.75rem] text-(--ui-text-tertiary)">{suffix}</span>
    </span>
  )
}

function Bar({ current, target }: { current: number; target: number }) {
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-(--card-well)">
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-(--ui-text-tertiary)"
        style={{ width: `${Math.min(current, 100)}%` }}
      />
      {target > 0 && (
        <span
          className="absolute inset-y-[-2px] w-0.5 rounded-full bg-(--ui-text-primary)"
          style={{ left: `calc(${Math.min(target, 100)}% - 1px)` }}
        />
      )}
    </span>
  )
}

function moveText(row: ClassRow) {
  const copy = COPY.plan.allocation

  if (!row.outside) {
    return <span className="text-(--ui-text-tertiary)">{row.target || row.current ? copy.onTarget : '—'}</span>
  }

  return (
    <span className="text-(--ui-text-secondary)">
      {row.move > 0 ? copy.sell(euro(row.move)) : copy.buy(euro(-row.move))}
    </span>
  )
}

export function AllocationCard({ editing, rows, sum }: { editing: Editing | null; rows: ClassRow[]; sum: number }) {
  const copy = COPY.plan.allocation

  const setTarget = (name: string, value: number) =>
    editing?.onChange({
      ...editing.draft,
      targets: { ...editing.draft.targets, [name]: Math.max(0, Math.min(value, 100)) }
    })

  return (
    <section className={cn(CARD, CARD_PAD, 'gap-3.5')} data-portfolio-plan-allocation="">
      <CardHead large subtitle={copy.subtitle} title={copy.title} />
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[26rem] sm:min-w-[34rem] border-collapse text-[0.8125rem]">
          <thead>
            <tr className="text-[0.75rem] text-(--ui-text-tertiary)">
              <th className="px-1 pb-2.5 text-left font-medium">{copy.class}</th>
              <th className="px-1 py-1.5 text-right font-medium">{copy.target}</th>
              <th className="px-1 py-1.5 text-right font-medium">{copy.now}</th>
              <th className="hidden w-[28%] px-3 py-1.5 font-medium sm:table-cell" />
              <th className="px-1 py-1.5 text-right font-medium">{copy.drift}</th>
              <th className="px-1 py-1.5 text-right font-medium">{copy.action}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr className="border-t border-(--card-well-stroke)" key={row.name}>
                <td className="px-1 py-3 font-medium text-(--ui-text-primary)">{row.name}</td>
                <td className="px-1 py-2.5 text-right tabular-nums text-(--ui-text-primary)">
                  {editing ? (
                    <NumberField
                      label={copy.targetFor(row.name)}
                      onChange={value => setTarget(row.name, value)}
                      suffix="%"
                      value={editing.draft.targets[row.name] ?? 0}
                    />
                  ) : row.target ? (
                    percent(row.target)
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-1 py-2.5 text-right tabular-nums text-(--ui-text-secondary)">
                  {percent(row.current)}
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <Bar current={row.current} target={editing ? (editing.draft.targets[row.name] ?? 0) : row.target} />
                </td>
                <td
                  className={cn(
                    'px-1 py-2.5 text-right tabular-nums',
                    row.outside ? 'text-(--ui-yellow)' : 'text-(--ui-text-tertiary)'
                  )}
                >
                  {sum > 0 ? copy.points(row.drift) : '—'}
                </td>
                <td className="px-1 py-2.5 text-right whitespace-nowrap">{moveText(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!editing && sum === 0 && <EmptyDashed>{copy.none}</EmptyDashed>}
      {(editing || sum > 0) && (
        <p className={cn('m-0 text-[0.75rem]', Math.abs(sum - 100) > 0.01 ? 'text-(--ui-yellow)' : MUTED)}>
          {copy.sum(percent(sum))}
        </p>
      )}
    </section>
  )
}

const RULE_ORDER: PlanRule[] = ['max_position_pct', 'rebalance_band_pp', 'min_cash_pct', 'review_loss_pct']

function breachText(check: RuleCheck) {
  const format =
    check.rule === 'rebalance_band_pp'
      ? COPY.plan.allocation.points
      : (value: number) => percent(value, check.rule === 'review_loss_pct')

  return check.breaches.map(breach => `${breach.label} ${format(breach.value)}`).join(' · ')
}

export function RulesCard({
  checks,
  editing,
  plan
}: {
  checks: RuleCheck[]
  editing: Editing | null
  plan: InvestmentPlan
}) {
  const copy = COPY.plan.rules
  const byRule = Object.fromEntries(checks.map(check => [check.rule, check]))

  const keptCount = RULE_ORDER.filter(rule => !byRule[rule]?.breaches.length).length

  return (
    <section className={cn(CARD, 'gap-2 px-6 pt-5 pb-2')} data-portfolio-plan-rules="">
      <div className="flex items-center justify-between gap-2 pb-1.5">
        <h2 className="m-0 text-[1.0625rem] font-medium tracking-[-0.01em] text-(--ui-text-primary)">{copy.title}</h2>
        <CountPill>{copy.summary(keptCount, RULE_ORDER.length)}</CountPill>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {RULE_ORDER.map(rule => {
          const check = byRule[rule]
          const kept = !check?.breaches.length

          return (
            <li
              className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-b border-(--card-well-stroke) py-3.5 last:border-b-0"
              key={rule}
            >
              <span
                className={cn(
                  'grid size-7 place-items-center rounded-lg',
                  kept
                    ? 'bg-[color-mix(in_srgb,var(--ui-green)_12%,transparent)] text-(--ui-green)'
                    : 'bg-[color-mix(in_srgb,var(--ui-yellow)_12%,transparent)] text-(--ui-yellow)'
                )}
              >
                <Codicon name={kept ? 'check' : 'warning'} size="0.875rem" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2.5">
                  <span className="text-sm font-medium text-(--ui-text-primary)">
                    {copy.labels[rule]}{' '}
                    {editing ? (
                      <NumberField
                        label={copy.labels[rule]}
                        onChange={value =>
                          editing.onChange({ ...editing.draft, rules: { ...editing.draft.rules, [rule]: value } })
                        }
                        suffix={rule === 'rebalance_band_pp' ? copy.pointsUnit : '%'}
                        value={editing.draft.rules[rule]}
                      />
                    ) : (
                      <span className="tabular-nums">
                        {rule === 'rebalance_band_pp'
                          ? `±${plan.rules[rule]} ${copy.pointsUnit}`
                          : percent(plan.rules[rule])}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-[0.78125rem] font-semibold whitespace-nowrap',
                      kept ? 'text-(--ui-green)' : 'text-(--ui-yellow)'
                    )}
                  >
                    {kept ? copy.kept : copy.broken}
                  </span>
                </div>
                <span className="text-[0.78125rem] leading-relaxed text-(--ui-text-secondary)">
                  {kept ? copy.hints[rule] : breachText(check)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function GoalEditor({
  goal,
  onChange,
  onRemove
}: {
  goal: PlanGoal
  onChange: (goal: PlanGoal) => void
  onRemove: () => void
}) {
  const copy = COPY.plan.goals

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <input
        aria-label={copy.name}
        className={cn(FIELD, 'min-w-40 flex-1')}
        maxLength={80}
        onChange={e => onChange({ ...goal, name: e.target.value })}
        placeholder={copy.namePlaceholder}
        value={goal.name}
      />
      <span className="inline-flex items-center gap-1">
        <input
          aria-label={copy.amount}
          className={cn(FIELD, 'w-28 text-right')}
          inputMode="numeric"
          min={0}
          onChange={e => onChange({ ...goal, target_eur: Number(e.target.value) || 0 })}
          type="number"
          value={goal.target_eur || ''}
        />
        <span className="text-[0.75rem] text-(--ui-text-tertiary)">€</span>
      </span>
      <input
        aria-label={copy.by}
        className={cn(FIELD, 'w-36')}
        onChange={e => onChange({ ...goal, by: e.target.value })}
        type="date"
        value={goal.by}
      />
      <Button aria-label={copy.remove(goal.name)} onClick={onRemove} size="icon-xs" variant="ghost">
        <Codicon name="trash" />
      </Button>
    </li>
  )
}

function GoalRow({ item }: { item: GoalProgress }) {
  const copy = COPY.plan.goals
  const { goal, progress, yearlyNeeded, yearsLeft } = item

  return (
    <li className="flex flex-col gap-1.5 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">{goal.name}</span>
        <span className="shrink-0 text-[0.75rem] tabular-nums text-(--ui-text-secondary)">
          {euro(goal.target_eur)}
          {goal.by && <span className="text-(--ui-text-tertiary)"> · {dateLabel(goal.by)}</span>}
        </span>
      </div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-(--card-well)">
        <span
          className={cn('block h-full rounded-full', progress >= 100 ? 'bg-(--ui-green)' : 'bg-(--ui-text-tertiary)')}
          style={{ width: `${progress}%` }}
        />
      </span>
      <span className="text-[0.6875rem] text-(--ui-text-tertiary)">
        {progress >= 100
          ? copy.reached
          : yearlyNeeded === null
            ? copy.progress(percent(progress))
            : yearsLeft !== null && yearsLeft <= 0
              ? copy.overdue(percent(progress))
              : copy.needed(percent(progress), percent(yearlyNeeded))}
      </span>
    </li>
  )
}

export function GoalsCard({ editing, progress }: { editing: Editing | null; progress: GoalProgress[] }) {
  const copy = COPY.plan.goals
  const goals = editing?.draft.goals ?? []
  const setGoals = (next: PlanGoal[]) => editing?.onChange({ ...editing.draft, goals: next })

  return (
    <section className={cn(CARD, CARD_PAD, 'gap-3.5')} data-portfolio-plan-goals="">
      <CardHead large subtitle={copy.subtitle} title={copy.title} />
      {editing ? (
        <>
          <ul className="divide-y divide-(--card-well-stroke)">
            {goals.map(goal => (
              <GoalEditor
                goal={goal}
                key={goal.id}
                onChange={next => setGoals(goals.map(item => (item.id === goal.id ? next : item)))}
                onRemove={() => setGoals(goals.filter(item => item.id !== goal.id))}
              />
            ))}
          </ul>
          {goals.length < 10 && (
            <button
              className={cn(BTN, 'self-start')}
              onClick={() =>
                setGoals([...goals, { by: '', id: randomUuid().slice(0, 8), name: '', target_eur: 0 }])
              }
              type="button"
            >
              <Codicon name="add" size="0.875rem" />
              {copy.add}
            </button>
          )}
        </>
      ) : progress.length ? (
        <ul className="divide-y divide-(--card-well-stroke)">
          {progress.map(item => (
            <GoalRow item={item} key={item.goal.id} />
          ))}
        </ul>
      ) : (
        <EmptyDashed>
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-(--card-well) text-(--ui-text-secondary)">
            <Codicon name="target" size="1rem" />
          </span>
          {copy.none}
        </EmptyDashed>
      )}
    </section>
  )
}

export function ThesisCard({ editing, thesis }: { editing: Editing | null; thesis: string }) {
  const copy = COPY.plan.thesis

  return (
    <section className={cn(CARD, CARD_PAD, 'gap-3.5')} data-portfolio-plan-thesis="">
      <CardHead large subtitle={copy.subtitle} title={copy.title} />
      {editing ? (
        <textarea
          aria-label={copy.title}
          className="min-h-48 resize-y rounded-xl bg-(--card-well) px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:ring-1 focus-visible:ring-(--ui-text-tertiary)"
          maxLength={20_000}
          onChange={event => editing.onChange({ ...editing.draft, thesis: event.target.value })}
          placeholder={copy.placeholder}
          value={editing.draft.thesis}
        />
      ) : thesis.trim() ? (
        <div
          className="min-w-0 text-[0.875rem] leading-relaxed text-(--ui-text-primary) [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
          data-selectable-text="true"
        >
          <MessageTextContent media={false} text={thesis} />
        </div>
      ) : (
        <EmptyDashed>{copy.none}</EmptyDashed>
      )}
    </section>
  )
}
