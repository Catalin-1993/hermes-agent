/**
 * The plan held against the portfolio as it stands: how far each class is from its target and what
 * would bring it back, which rules hold and which do not, and how far each goal is. Pure, so the
 * numbers are tested; the page only draws them.
 */

import type { InvestmentPlan, PlanGoal, PortfolioDashboard } from './api'

export interface ClassRow {
  current: number
  /** Percentage points above (+) or below (−) the target. */
  drift: number
  /** Euros to sell (+) or buy (−) to return to the target; 0 when within the band. */
  move: number
  name: string
  outside: boolean
  target: number
}

export interface RuleCheck {
  /** What breaks the rule: a position, the cash, … with its number. */
  breaches: { label: string; value: number }[]
  rule: 'max_position_pct' | 'min_cash_pct' | 'rebalance_band_pp' | 'review_loss_pct'
}

export interface GoalProgress {
  goal: PlanGoal
  progress: number
  /** The yearly growth still needed to reach the target by its date; null without a date or once reached. */
  yearlyNeeded: null | number
  yearsLeft: null | number
}

export const targetSum = (plan: InvestmentPlan) =>
  Object.values(plan.targets).reduce<number>((sum, value) => sum + (value ?? 0), 0)

/** One row per class with a target or a holding; with `everyClass`, every plan class (for editing targets). */
export function classRows(
  plan: InvestmentPlan,
  data: PortfolioDashboard,
  classes: string[],
  everyClass = false
): ClassRow[] {
  const band = plan.rules.rebalance_band_pp
  // Once any target is set, a class without one is meant to be empty; before that nothing is off target.
  const planned = targetSum(plan) > 0
  const held = Object.fromEntries(data.allocation.map(slice => [slice.name, slice.value]))
  const named = everyClass ? classes : classes.filter(name => plan.targets[name] || held[name])
  const names = [...new Set([...named, ...Object.keys(held)])]

  return names.map(name => {
    const current = data.total ? ((held[name] ?? 0) / data.total) * 100 : 0
    const target = plan.targets[name] ?? 0
    const drift = current - target
    const outside = planned && Math.abs(drift) > band

    return { current, drift, move: outside ? (drift / 100) * data.total : 0, name, outside, target }
  })
}

export function ruleChecks(plan: InvestmentPlan, data: PortfolioDashboard, rows: ClassRow[]): RuleCheck[] {
  const { max_position_pct: maxPosition, min_cash_pct: minCash, review_loss_pct: reviewLoss } = plan.rules
  const cash = data.total ? (data.cash / data.total) * 100 : 0

  return [
    {
      breaches: data.positions.filter(p => p.weight > maxPosition).map(p => ({ label: p.symbol, value: p.weight })),
      rule: 'max_position_pct'
    },
    {
      breaches: rows.filter(row => row.outside).map(row => ({ label: row.name, value: row.drift })),
      rule: 'rebalance_band_pp'
    },
    { breaches: cash < minCash ? [{ label: 'Numerar', value: cash }] : [], rule: 'min_cash_pct' },
    {
      breaches: data.positions.filter(p => p.pnl_pct <= -reviewLoss).map(p => ({ label: p.symbol, value: p.pnl_pct })),
      rule: 'review_loss_pct'
    }
  ]
}

export function goalProgress(goals: PlanGoal[], total: number, today: Date): GoalProgress[] {
  return goals.map(goal => {
    const progress = goal.target_eur ? Math.min(total / goal.target_eur, 1) * 100 : 0
    const yearsLeft = goal.by ? (Date.parse(goal.by) - today.getTime()) / (365.25 * 86_400_000) : null
    const reached = total >= goal.target_eur

    const yearlyNeeded =
      reached || yearsLeft === null || yearsLeft <= 0 || total <= 0
        ? null
        : ((goal.target_eur / total) ** (1 / yearsLeft) - 1) * 100

    return { goal, progress, yearlyNeeded, yearsLeft }
  })
}
