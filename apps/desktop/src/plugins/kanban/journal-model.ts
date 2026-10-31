/**
 * The Journal read for a person: the summary at the top (what was decided, reported and discussed, week by week,
 * and by whom), and one entry's file split into the parts the page lays out — its facts, its sections, the messages
 * of a conversation, and the numbers of a table, ready to chart. Pure, so it is tested.
 */

import type { JournalEntry } from './types'

export const JOURNAL_TYPES = ['decision', 'report', 'conversation'] as const

export type JournalType = (typeof JOURNAL_TYPES)[number]

export interface WeekBar {
  /** Monday of the week, YYYY-MM-DD. */
  start: string
  counts: Record<JournalType, number>
}

export interface JournalSummary {
  agents: { count: number; name: string }[]
  byType: Record<JournalType, number>
  latest: JournalEntry | null
  outcomes: { count: number; outcome: string }[]
  weeks: WeekBar[]
}

const DAY = 86_400_000

const asType = (type: string): JournalType =>
  JOURNAL_TYPES.includes(type as JournalType) ? (type as JournalType) : 'report'

const mondayOf = (time: number) => {
  const date = new Date(time)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))

  return date
}

const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const zero = (): Record<JournalType, number> => ({ conversation: 0, decision: 0, report: 0 })

/** Counts for the top of the page: by kind, decisions by outcome, the most active agents, and the last `weeks`
 *  weeks (oldest first) up to the week of `now`. */
export function journalSummary(entries: readonly JournalEntry[], now: number, weeks = 8): JournalSummary {
  const byType = zero()
  const outcomes = new Map<string, number>()
  const agents = new Map<string, number>()
  const thisWeek = mondayOf(now).getTime()

  const bars: WeekBar[] = Array.from({ length: weeks }, (_, index) => ({
    counts: zero(),
    start: ymd(new Date(thisWeek - (weeks - 1 - index) * 7 * DAY))
  }))

  for (const entry of entries) {
    const type = asType(entry.type)
    byType[type] += 1

    if (type === 'decision' && entry.outcome) {
      outcomes.set(entry.outcome, (outcomes.get(entry.outcome) ?? 0) + 1)
    }

    if (entry.agent) {
      agents.set(entry.agent, (agents.get(entry.agent) ?? 0) + 1)
    }

    const bar = bars.find(item => item.start === ymd(mondayOf(new Date(entry.date).getTime())))
    bar && (bar.counts[type] += 1)
  }

  const ranked = (map: Map<string, number>) => [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const newest = [...entries].sort((a, b) => b.date.localeCompare(a.date))

  return {
    agents: ranked(agents)
      .slice(0, 4)
      .map(([name, count]) => ({ count, name })),
    byType,
    latest: newest.find(entry => entry.type === 'decision') ?? newest[0] ?? null,
    outcomes: ranked(outcomes).map(([outcome, count]) => ({ count, outcome })),
    weeks: bars
  }
}

export interface ParsedEntry {
  /** Facts from the file's header and its `**Key:** value` lines (Outcome, Date, Agent, Card…). */
  facts: { key: string; value: string }[]
  /** The text before the first section, if any. */
  intro: string
  sections: { body: string; title: string }[]
}

const HIDDEN_FACTS = new Set(['title', 'type'])

/** One journal file split into its facts and its `## ` sections. */
export function parseEntry(content: string): ParsedEntry {
  const facts: ParsedEntry['facts'] = []
  let text = content.replace(/\r\n/g, '\n')
  const header = text.match(/^---\n([\s\S]*?)\n---\n*/)

  if (header) {
    for (const line of header[1]!.split('\n')) {
      const match = line.match(/^([A-Za-z_ ]+):\s*(.+)$/)
      match && !HIDDEN_FACTS.has(match[1]!.trim()) && facts.push({ key: match[1]!.trim(), value: match[2]!.trim() })
    }

    text = text.slice(header[0].length)
  }

  text = text.replace(/^# .*\n+/, '')
  const parts = text.split(/^## /m)
  const lead: string[] = []

  for (const line of parts[0]!.split('\n')) {
    const match = line.match(/^\*\*(.+?):\*\*\s*(.*?)\s*$/)

    if (match) {
      const key = match[1]!.trim()
      const index = facts.findIndex(fact => fact.key.toLowerCase() === key.toLowerCase())
      index >= 0 ? (facts[index] = { key, value: match[2]! }) : facts.push({ key, value: match[2]! })
    } else {
      lead.push(line)
    }
  }

  const sections = parts.slice(1).map(part => {
    const [title, ...rest] = part.split('\n')

    return { body: rest.join('\n').trim(), title: title!.trim() }
  })

  return { facts, intro: lead.join('\n').trim(), sections }
}

export interface Message {
  at: string
  author: string
  body: string
}

/** The messages of a conversation section (`### author — 2026-10-26 09:10` then the text), or none. */
export function messagesOf(body: string): Message[] {
  return body
    .split(/^### /m)
    .slice(1)
    .map(block => {
      const [head, ...rest] = block.split('\n')
      const [author, at] = head!.split(/\s+—\s+/)

      return { at: (at ?? '').trim(), author: (author ?? '').trim(), body: rest.join('\n').trim() }
    })
    .filter(message => message.author && message.body)
}

/** A number as written in a report: 39%, $1,234.50, 6.000 €, -2,5. */
export function numberIn(cell: string): null | number {
  const text = cell.replace(/[%$€£\s]|USD|EUR|RON/gi, '')

  if (!/^[-+]?[\d.,]+$/.test(text)) {
    return null
  }

  // "6.000" and "1,234.50": the last separator followed by 1–2 digits is the decimal one.
  const decimal = text.match(/[.,](\d{1,2})$/)
  const whole = decimal ? text.slice(0, -decimal[0].length) : text
  const value = Number(`${whole.replace(/[.,]/g, '')}${decimal ? `.${decimal[1]}` : ''}`)

  return Number.isFinite(value) ? value : null
}

export interface Series {
  /** The column the values come from. */
  name: string
  points: { label: string; value: number }[]
}

/** The first markdown table in `body` with a column of numbers: its first column as labels, that column as values
 *  — enough to draw it as bars. Null when there is no such table (or it has fewer than two rows). */
export function tableSeries(body: string): null | Series {
  const rows = body
    .split('\n')
    .filter(line => /^\s*\|.*\|\s*$/.test(line))
    .map(line =>
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(cell => cell.trim())
    )

  if (rows.length < 4) {
    return null
  }

  const [head, , ...data] = rows

  for (let column = 1; column < head!.length; column += 1) {
    const points = data.map(row => ({ label: row[0] ?? '', value: numberIn(row[column] ?? '') }))

    if (points.every(point => point.value !== null && point.label)) {
      return { name: head![column]!, points: points as Series['points'] }
    }
  }

  return null
}
