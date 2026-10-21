/**
 * The request the page prepares for the investment team: the asset, the numbers the page already
 * has (so the agents start from facts, then check them), what kind of analysis, and where and how to
 * save the report so it appears in Research. Pure, so its wording is tested, not eyeballed.
 */

import type { ResearchSheet } from './api'
import { percent, quotePrice } from './format'

export type AnalysisKind = 'full' | 'quick' | 'risk'

const ASK: Record<AnalysisKind, { file: string; label: string; want: string }> = {
  full: {
    file: 'complet',
    label: 'completă',
    want:
      'Fundamentele (sau, la cripto, utilitatea, ofertă și adopție), tabloul tehnic, catalizatorii și știrile recente, ' +
      'riscurile, trei scenarii (optimist, de bază, pesimist) și un verdict, cu ce anume l-ar schimba.'
  },
  quick: {
    file: 'rapid',
    label: 'rapidă',
    want: 'Cinci până la opt puncte: ce s-a întâmplat recent, unde e prețul față de trend, principalul risc și un verdict.'
  },
  risk: {
    file: 'risc',
    label: 'de risc',
    want:
      'Ce poate merge rău, cât de volatil e, cea mai mare scădere de care a fost în stare, legătura cu restul ' +
      'portofoliului simulat, cât ar trebui să cântărească cel mult în portofoliu și la ce niveluri teza nu mai e valabilă.'
  }
}

const VERDICTS = 'Cumpără / Păstrează / De urmărit / Evită'

function signed(value: null | number | undefined) {
  return value === null || value === undefined ? '—' : percent(value, true)
}

function plain(value: null | number | undefined, currency = '') {
  return value === null || value === undefined ? '—' : `${quotePrice(value)}${currency ? ` ${currency}` : ''}`
}

function factLines(sheet: ResearchSheet): string[] {
  const t = sheet.technicals
  const currency = sheet.currency ?? ''

  if (!t?.price) {
    return ['- Pagina nu are încă prețuri pentru acest activ (serviciul de date nu rulează); ia-le din surse actuale.']
  }

  const lines = [
    `- Preț: ${plain(t.price, currency)} (închiderea din ${t.date})`,
    `- Evoluție: 1 săptămână ${signed(t.change?.['1w'])}, 1 lună ${signed(t.change?.['1m'])}, 3 luni ${signed(t.change?.['3m'])}, 1 an ${signed(t.change?.['1y'])}`,
    `- Interval 52 de săptămâni: ${plain(t.low_52w)} – ${plain(t.high_52w)}; față de maxim ${signed(t.from_high_pct)}`,
    `- Medii mobile: 50 de zile ${plain(t.sma50)}, 200 de zile ${plain(t.sma200)}; RSI 14: ${t.rsi14 === null || t.rsi14 === undefined ? '—' : t.rsi14.toFixed(0)}`,
    `- Volatilitate anuală ${percent(t.volatility_pct ?? 0)}; cea mai mare scădere în ultimul an ${signed(t.max_drawdown_pct)}`
  ]

  const about = sheet.profile?.profile
  const name = about?.name ?? about?.long_name

  if (name) {
    const sector = [about?.sector, about?.industry].filter(Boolean).join(', ')
    lines.push(`- Profil: ${String(name)}${sector ? ` (${sector})` : ''}`)
  }

  return lines
}

export function researchPrompt(input: {
  dir: string
  kind: AnalysisKind
  note: string
  sheet: ResearchSheet
  today: string
}): string {
  const { dir, kind, note, sheet, today } = input
  const ask = ASK[kind]
  const what = sheet.kind === 'crypto' ? 'criptomonedă' : 'acțiune sau ETF'
  const file = `${dir.replace(/\/+$/, '')}/${today}-${sheet.symbol.replace(/[^\w.-]/g, '')}-${ask.file}.md`

  return [
    `Analiză ${ask.label} pentru ${sheet.symbol} (${what}), cerută din pagina Portofoliu → Research.`,
    '',
    `Date de pornire, de la serviciul de date (verifică-le în surse actuale):`,
    ...factLines(sheet),
    '',
    `Ce vreau: ${ask.want}`,
    ...(note.trim() ? ['', `Întrebarea mea: ${note.trim()}`] : []),
    '',
    'Reguli:',
    '- Implică echipa de investiții după cum crezi de cuviință (analiști, strateg macro, ofițer de risc).',
    '- E un portofoliu simulat: nu face tranzacții reale și nu modifica jurnalul de tranzacții.',
    '- Scrie în română, simplu, cu concluzia la început.',
    `- Salvează raportul ca Markdown în ${file}, care începe cu antetul:`,
    '---',
    `titlu: <un titlu scurt>`,
    `simbol: ${sheet.symbol}`,
    `verdict: <unul dintre: ${VERDICTS}>`,
    'autor: <cine din echipă a scris>',
    '---',
    '- La final spune-mi pe scurt verdictul și unde ai salvat raportul.'
  ].join('\n')
}

export const ANALYSIS_KINDS: AnalysisKind[] = ['full', 'quick', 'risk']
