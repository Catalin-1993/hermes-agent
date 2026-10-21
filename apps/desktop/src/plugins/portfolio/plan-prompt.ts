/**
 * The two requests the Plan page prepares for the team: propose a plan (written into the plan file in
 * the shape the page reads) or review the current one against the portfolio (a report in the research
 * folder). Both carry the portfolio as it stands, so the agents start from the same numbers.
 */

import type { InvestmentPlan, PortfolioDashboard } from './api'
import { euro, percent } from './format'
import type { ClassRow } from './plan-math'

export type PlanAsk = 'propose' | 'review'

function holdings(data: PortfolioDashboard, rows: ClassRow[]): string[] {
  return [
    `- Valoare totală ${euro(data.total)}, din care numerar ${euro(data.cash)}; câștig de la pornire ${percent(data.pnl_pct, true)}.`,
    `- Alocare acum: ${rows.map(row => `${row.name} ${percent(row.current)}`).join(', ') || '—'}.`,
    `- Poziții: ${data.positions.map(p => `${p.symbol} ${percent(p.weight)} (${percent(p.pnl_pct, true)})`).join(', ') || '—'}.`
  ]
}

function currentPlan(plan: InvestmentPlan): string[] {
  const targets = Object.entries(plan.targets)
    .map(([name, value]) => `${name} ${percent(value ?? 0)}`)
    .join(', ')

  const goals = plan.goals
    .map(goal => `${goal.name}: ${euro(goal.target_eur)}${goal.by ? ` până la ${goal.by}` : ''}`)
    .join('; ')

  return [
    `- Ținte: ${targets || 'nefixate încă'}.`,
    `- Reguli: poziție maximă ${percent(plan.rules.max_position_pct)}, rebalansare la ±${plan.rules.rebalance_band_pp} puncte, numerar minim ${percent(plan.rules.min_cash_pct)}, revizuire la −${percent(plan.rules.review_loss_pct)}.`,
    `- Obiective: ${goals || 'niciunul'}.`,
    ...(plan.thesis.trim()
      ? [`- Strategia, în cuvintele mele: ${plan.thesis.trim().replace(/\s+/g, ' ').slice(0, 600)}`]
      : [])
  ]
}

const SHAPE = (classes: string[], variant: string) => [
  '{',
  '  "variants": {',
  `    "${variant}": {`,
  `      "targets": { "<clasă>": <procent> },   // doar clasele: ${classes.join(', ')}; suma 100`,
  '      "rules": { "max_position_pct": 25, "rebalance_band_pp": 5, "min_cash_pct": 5, "review_loss_pct": 20 },',
  '      "goals": [ { "name": "<obiectiv>", "target_eur": 50000, "by": "AAAA-LL-ZZ" } ],',
  '      "thesis": "<strategia în câteva paragrafe, în română>",',
  '      "updated_by": "<cine din echipă>"',
  '    }',
  '  }',
  '}'
]

export function planPrompt(input: {
  ask: PlanAsk
  classes: string[]
  data: PortfolioDashboard
  file: string
  note: string
  plan: InvestmentPlan
  researchDir: string
  rows: ClassRow[]
  today: string
}): string {
  const { ask, classes, data, file, note, plan, researchDir, rows, today } = input
  const variant = data.variant

  const head = [
    ask === 'propose'
      ? `Propune un plan de investiții pentru varianta ${variant || 'principală'} a portofoliului simulat, cerut din pagina Portofoliu → Plan.`
      : `Verifică planul de investiții al variantei ${variant || 'principale'} față de portofoliul simulat, cerut din pagina Portofoliu → Plan.`,
    '',
    'Portofoliul acum:',
    ...holdings(data, rows),
    '',
    'Planul de acum:',
    ...currentPlan(plan),
    ...(note.trim() ? ['', `Ce vreau în mod special: ${note.trim()}`] : []),
    '',
    'Reguli:',
    '- Implică echipa după cum crezi de cuviință (strategul macro, ofițerul de risc, psihologul financiar).',
    '- E un portofoliu simulat: nu face tranzacții reale și nu modifica jurnalul de tranzacții.',
    '- Scrie în română, simplu.'
  ]

  const tail =
    ask === 'propose'
      ? [
          `- Scrie planul în ${file}, păstrând celelalte variante din fișier neschimbate, exact în forma:`,
          ...SHAPE(classes, variant),
          '- În chat, explică-mi pe scurt ce ai schimbat și de ce. Planul apare în pagina Plan după salvare.'
        ]
      : [
          `- Nu modifica planul. Salvează verificarea ca Markdown în ${researchDir.replace(/\/+$/, '')}/${today}-PLAN-verificare.md, care începe cu antetul:`,
          '---',
          `titlu: Verificarea planului (varianta ${variant || 'principală'})`,
          'simbol: PLAN',
          'verdict: <unul dintre: Planul ține / De ajustat / De refăcut>',
          'autor: <cine din echipă a scris>',
          '---',
          '- Spune ce ține, ce nu și ce ai schimba, cu cifre. La final spune-mi verdictul în chat.'
        ]

  return [...head, ...tail].join('\n')
}
