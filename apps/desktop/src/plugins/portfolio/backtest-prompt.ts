/** The request that hands a finished backtest to the team: what was tested, how it did against buy and
 *  hold, and where to save their reading of it so it appears in Research. Pure, so it is tested. */

import type { BacktestRecord } from './api'
import { percent } from './format'

const day = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10)

export function backtestPrompt(input: {
  names: Record<string, string>
  note: string
  record: BacktestRecord
  researchDir: string
  today: string
}): string {
  const { names, note, record, researchDir, today } = input
  const { request, result, benchmark } = record
  const s = result.stats
  const b = benchmark.stats

  const params = Object.entries(record.params)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ')

  const file = `${researchDir.replace(/\/+$/, '')}/${today}-${request.symbol.replace(/[^\w.-]/g, '')}-backtest.md`

  const span = result.curve.length
    ? `${day(result.curve[0][0])} – ${day(result.curve[result.curve.length - 1][0])}`
    : '—'

  return [
    `Interpretează un backtest făcut în pagina Portofoliu → Backtesting (NautilusTrader, date zilnice yfinance).`,
    '',
    `- Activ: ${request.symbol}; strategia: ${names[request.strategy] ?? request.strategy}${params ? ` (${params})` : ''}; perioada ${span}.`,
    `- Capital ${request.capital} ${request.currency}, comision ${request.fee_pct}% pe tranzacție; doar pe creștere, totul sau nimic.`,
    `- Strategia: randament ${percent(s.total_return_pct, true)}, pe an ${percent(s.cagr_pct, true)}, scădere maximă ${percent(s.max_drawdown_pct, true)}, Sharpe ${s.sharpe.toFixed(2)}, ${s.trades} tranzacții, ${percent(s.win_rate_pct)} câștigătoare, în piață ${percent(s.exposure_pct)} din timp.`,
    `- Cumpără și păstrează: randament ${percent(b.total_return_pct, true)}, pe an ${percent(b.cagr_pct, true)}, scădere maximă ${percent(b.max_drawdown_pct, true)}, Sharpe ${b.sharpe.toFixed(2)}.`,
    ...(note.trim() ? ['', `Ce vreau să aflu: ${note.trim()}`] : []),
    '',
    'Ce vreau: dacă rezultatul pare robust sau e noroc (perioadă scurtă, prea puține tranzacții, potrivire forțată a parametrilor), ce ar trebui testat în continuare și dacă strategia are loc în planul nostru.',
    '',
    'Reguli:',
    '- Rezultatele trecute nu garantează nimic; spune-o simplu acolo unde contează.',
    '- E un portofoliu simulat: nu face tranzacții reale și nu modifica jurnalul.',
    `- Salvează analiza ca Markdown în ${file}, care începe cu antetul:`,
    '---',
    `titlu: Backtest ${request.symbol}: ${names[request.strategy] ?? request.strategy}`,
    `simbol: ${request.symbol}`,
    'verdict: <unul dintre: Promițător / De testat mai mult / Nu merită>',
    'autor: <cine din echipă a scris>',
    '---',
    '- Scrie în română, simplu, cu concluzia la început.'
  ].join('\n')
}
