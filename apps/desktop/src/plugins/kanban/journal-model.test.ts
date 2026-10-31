import { describe, expect, it } from 'vitest'

import { journalSummary, messagesOf, numberIn, parseEntry, tableSeries } from './journal-model'

const entry = (type: string, date: string, outcome = '', agent = 'risc') => ({
  agent,
  date,
  outcome,
  path: `${type}-${date}.md`,
  task: 't',
  title: `${type} ${date}`,
  type
})

describe('journalSummary', () => {
  it('counts kinds, decision outcomes, agents, and the weeks they fell in', () => {
    const now = new Date('2026-10-30T12:00:00').getTime()

    const summary = journalSummary(
      [
        entry('decision', '2026-10-29T10:00:00', 'approved'),
        entry('decision', '2026-10-27T10:00:00', 'changes_requested', 'analist'),
        entry('report', '2026-10-20T10:00:00'),
        entry('conversation', '2025-01-01T10:00:00')
      ],
      now
    )

    expect(summary.byType).toEqual({ conversation: 1, decision: 2, report: 1 })
    expect(summary.outcomes.map(item => item.outcome).sort()).toEqual(['approved', 'changes_requested'])
    expect(summary.agents[0]).toEqual({ count: 3, name: 'risc' })
    expect(summary.weeks).toHaveLength(8)
    expect(summary.weeks.at(-1)!.counts.decision).toBe(2)
    expect(summary.weeks.at(-2)!.counts.report).toBe(1)
    expect(summary.latest?.outcome).toBe('approved')
  })
})

describe('parseEntry', () => {
  it('splits a file into its facts and sections', () => {
    const parsed = parseEntry(
      '---\ntype: decision\ntitle: X\nagent: risc\n---\n\n# Decision: X\n\n**Outcome:** Approved  \n**Card:** k8\n\n## What was asked\nCap ETH?\n\n## Your reason\nFits.'
    )

    expect(parsed.facts).toEqual([
      { key: 'agent', value: 'risc' },
      { key: 'Outcome', value: 'Approved' },
      { key: 'Card', value: 'k8' }
    ])
    expect(parsed.sections).toEqual([
      { body: 'Cap ETH?', title: 'What was asked' },
      { body: 'Fits.', title: 'Your reason' }
    ])
  })

  it('reads the messages of a conversation', () => {
    expect(messagesOf('### manager — 2026-10-26 09:10\nCe buget?\n\n### Cătă — 2026-10-26 09:20\n6.000 €')).toEqual([
      { at: '2026-10-26 09:10', author: 'manager', body: 'Ce buget?' },
      { at: '2026-10-26 09:20', author: 'Cătă', body: '6.000 €' }
    ])
  })
})

describe('numbers and tables', () => {
  it('reads numbers as reports write them', () => {
    expect(numberIn('39%')).toBe(39)
    expect(numberIn('6.000 €')).toBe(6000)
    expect(numberIn('$1,234.50')).toBe(1234.5)
    expect(numberIn('-2,5')).toBe(-2.5)
    expect(numberIn('high')).toBeNull()
  })

  it('finds the first numeric column of a table, ready to chart', () => {
    const body = 'Intro\n\n| Coin | Note | Share |\n|---|---|---|\n| ETH | big | 39% |\n| BTC | ok | 21% |\n'

    expect(tableSeries(body)).toEqual({
      name: 'Share',
      points: [
        { label: 'ETH', value: 39 },
        { label: 'BTC', value: 21 }
      ]
    })
    expect(tableSeries('no table here')).toBeNull()
  })
})
