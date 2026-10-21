/**
 * The Plan page's cards. Each reads the plan against the portfolio (`plan-math.ts`) and, while the
 * owner edits, turns its numbers into fields; every change goes up through one `onChange` so the
 * page saves the whole plan at once.
 */

import { Button, cn, Codicon, FIGURE_CARD_CLASS, MessageTextContent } from '@hermes/plugin-sdk'

import type { InvestmentPlan, PlanGoal, PlanRule } from './api'
import { COPY } from './copy'
import { dateLabel, euro, percent } from './format'
import type { ClassRow, GoalProgress, RuleCheck } from './plan-math'

const TITLE = 'text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)'

const FIELD =
  'h-7 min-w-0 rounded-lg bg-(--card-well) px-2.5 text-[0.8125rem] text-(--ui-text-primary) tabular-nums placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:ring-1 focus-visible:ring-(--ui-text-tertiary)'

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
    <div className={cn(FIGURE_CARD_CLASS, 'gap-3')} data-portfolio-plan-allocation="">
      <div>
        <div className={TITLE}>{copy.title}</div>
        <div className="mt-0.5 text-[0.75rem] text-(--ui-text-tertiary)">{copy.subtitle}</div>
      </div>
      {!editing && sum === 0 ? (
        <p className="py-2 text-[0.8125rem] leading-relaxed text-(--ui-text-tertiary)">{copy.none}</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[26rem] sm:min-w-[34rem] border-collapse text-[0.8125rem]">
            <thead>
              <tr className="text-[0.75rem] text-(--ui-text-tertiary)">
                <th className="px-1 py-1.5 text-left font-medium">{copy.class}</th>
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
                  <td className="px-1 py-2.5 font-medium text-(--ui-text-primary)">{row.name}</td>
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
      )}
      {(editing || sum > 0) && (
        <p
          className={cn(
            'text-[0.75rem]',
            Math.abs(sum - 100) > 0.01 ? 'text-(--ui-yellow)' : 'text-(--ui-text-tertiary)'
          )}
        >
          {copy.sum(percent(sum))}
        </p>
      )}
    </div>
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

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'gap-1')} data-portfolio-plan-rules="">
      <div className={cn(TITLE, 'mb-1')}>{copy.title}</div>
      <ul className="divide-y divide-(--card-well-stroke)">
        {RULE_ORDER.map(rule => {
          const check = byRule[rule]
          const kept = !check?.breaches.length

          return (
            <li className="flex items-start justify-between gap-3 py-2.5" key={rule}>
              <div className="min-w-0">
                <div className="text-[0.8125rem] font-medium text-(--ui-text-primary)">
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
                    <span className="tabular-nums text-(--ui-text-secondary)">
                      {rule === 'rebalance_band_pp'
                        ? `±${plan.rules[rule]} ${copy.pointsUnit}`
                        : percent(plan.rules[rule])}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[0.6875rem] leading-relaxed text-(--ui-text-tertiary)">
                  {kept ? copy.hints[rule] : breachText(check)}
                </div>
              </div>
              <span
                className={cn(
                  'flex shrink-0 items-center gap-1 text-[0.75rem]',
                  kept ? 'text-(--ui-green)' : 'text-(--ui-yellow)'
                )}
              >
                <Codicon name={kept ? 'check' : 'warning'} size="0.75rem" />
                {kept ? copy.kept : copy.broken}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
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
    <div className={cn(FIGURE_CARD_CLASS, 'gap-1')} data-portfolio-plan-goals="">
      <div className={cn(TITLE, 'mb-1')}>{copy.title}</div>
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
            <Button
              className="mt-1 self-start"
              onClick={() =>
                setGoals([...goals, { by: '', id: crypto.randomUUID().slice(0, 8), name: '', target_eur: 0 }])
              }
              size="sm"
              variant="secondary"
            >
              <Codicon className="mr-1.5" name="add" />
              {copy.add}
            </Button>
          )}
        </>
      ) : progress.length ? (
        <ul className="divide-y divide-(--card-well-stroke)">
          {progress.map(item => (
            <GoalRow item={item} key={item.goal.id} />
          ))}
        </ul>
      ) : (
        <p className="py-1 text-[0.8125rem] leading-relaxed text-(--ui-text-tertiary)">{copy.none}</p>
      )}
    </div>
  )
}

export function ThesisCard({ editing, thesis }: { editing: Editing | null; thesis: string }) {
  const copy = COPY.plan.thesis

  return (
    <div className={cn(FIGURE_CARD_CLASS, 'gap-2')} data-portfolio-plan-thesis="">
      <div className={TITLE}>{copy.title}</div>
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
        <p className="text-[0.8125rem] leading-relaxed text-(--ui-text-tertiary)">{copy.none}</p>
      )}
    </div>
  )
}
