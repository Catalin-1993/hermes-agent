/**
 * Brain (Pro Mode): what the Board shows, and how it is asked for — pure, no I/O.
 *
 * Three views, each written by one stateless model call (`llm.oneshot`, outside the conversation, so the chat's
 * prompt cache is untouched) and kept on this device:
 * - `ChatBoard` — this chat: where we are, then notes by status (done / now / next / talked only / didn't work).
 * - `ProjectMap` — the project over weeks: the idea, milestones, decisions, branches, parked ideas, what failed.
 * - `CatchUp` — what happened since the person last looked, a few items with one sentence of detail each.
 *
 * Replies are asked for as JSON and read defensively: anything malformed becomes an empty field, never a crash,
 * and every list is capped so a chatty model cannot flood the panel.
 */

export type NoteStatus = 'done' | 'failed' | 'next' | 'now' | 'talked'

export interface ChatBoard {
  at: number
  /** How many messages the board was written from — a newer chat is stale. */
  basis: number
  notes: Record<NoteStatus, string[]>
  where: string
}

export type BranchState = 'abandoned' | 'active' | 'merged' | 'unfinished'

export interface ProjectMap {
  at: number
  branches: { name: string; note: string; state: BranchState }[]
  decisions: { date: string; text: string }[]
  failed: string[]
  idea: string
  milestones: { done: boolean; name: string }[]
  parked: string[]
}

export type CatchUpStatus = 'done' | 'next' | 'now' | 'waiting'

export interface CatchUp {
  at: number
  items: { detail: string; status: CatchUpStatus; title: string }[]
  since: number
  summary: string
}

const NOTE_STATUSES: readonly NoteStatus[] = ['done', 'now', 'next', 'talked', 'failed']
const BRANCH_STATES: readonly BranchState[] = ['active', 'merged', 'unfinished', 'abandoned']
const CATCH_UP_STATUSES: readonly CatchUpStatus[] = ['done', 'now', 'next', 'waiting']

const LANGUAGE =
  'Write every value in the language the person writes in. Plain words a non-programmer understands; no file paths ' +
  'unless they matter. Reply with ONE JSON object and nothing else — no prose, no code fence.'

export const CHAT_BOARD_INSTRUCTIONS = [
  'You keep a whiteboard for one conversation between a person and their AI agent, so the person always knows where',
  'the work stands. From the transcript (and the agent’s step list, when given) return:',
  '{"where": one or two sentences — where the work is right now and what comes next,',
  ' "done": [things actually changed, built or finished], "now": [what the agent is doing now],',
  ' "next": [agreed or planned but not started], "talked": [ideas only discussed or checked — nothing was changed],',
  ' "failed": [things tried that did not work or were dropped]}.',
  'Each list: at most 6 short items (under 9 words each), newest first. Never invent work that is not in the transcript.',
  LANGUAGE
].join('\n')

export const PROJECT_MAP_INSTRUCTIONS = [
  'You keep a map of a software project for its owner, who is not a programmer and may come back after months.',
  'From the git history, branches, changelog and recent chat summaries given, return:',
  '{"idea": two or three sentences — what the project is and who it is for,',
  ' "milestones": [{"name": short name, "done": true|false}] in order, at most 10,',
  ' "decisions": [{"date": "YYYY-MM-DD" or "", "text": a decision and why, one sentence}] newest first, at most 6,',
  ' "branches": [{"name": branch, "state": "active"|"merged"|"unfinished"|"abandoned", "note": what it holds or',
  '   what it still needs, one short sentence}],',
  ' "parked": [ideas discussed but not built, at most 6], "failed": [approaches that did not work, at most 5]}.',
  'Only use what the material shows.',
  LANGUAGE
].join('\n')

export const CATCH_UP_INSTRUCTIONS = [
  'The owner of this project is back after a break. Tell them what happened while they were away and what is next.',
  'From the activity given (commits since they left, the chat board, the project map), return:',
  '{"summary": two or three sentences, warm and concrete: what moved forward, what is in progress, what needs them,',
  ' "items": [{"status": "done"|"now"|"next"|"waiting", "title": under 8 words,',
  '   "detail": one sentence that explains what it means for them or what it is waiting on}] — 3 to 6 items,',
  '   done first, then now, next, waiting}.',
  'If nothing happened, say so plainly in the summary and list what is next.',
  LANGUAGE
].join('\n')

const MAX_INPUT = 14_000

/** The tail of a transcript as `Role: text` lines, newest kept, within the input budget. */
export function transcriptInput(messages: readonly { role: string; text: string }[], steps: readonly string[]): string {
  const lines: string[] = []
  let size = 0

  for (const message of [...messages].reverse()) {
    const text = message.text.replace(/\s+/g, ' ').trim()

    if (!text) {
      continue
    }

    const line = `${message.role === 'user' ? 'Person' : 'Agent'}: ${text.slice(0, 700)}`

    if (size + line.length > MAX_INPUT) {
      break
    }

    lines.unshift(line)
    size += line.length
  }

  const plan = steps.length ? `\n\nThe agent's step list:\n${steps.map(step => `- ${step}`).join('\n')}` : ''

  return `${lines.join('\n')}${plan}`
}

/** Sections of project material, each trimmed to its share of the input budget. */
export function sectionsInput(sections: Record<string, string>): string {
  const filled = Object.entries(sections).filter(([, body]) => body.trim())
  const share = Math.floor(MAX_INPUT / Math.max(1, filled.length))

  return filled.map(([title, body]) => `## ${title}\n${body.trim().slice(0, share)}`).join('\n\n')
}

/**
 * Close what a reply cut off mid-way (a model that ran out of room): an open string, then every open array and
 * object, innermost first — so a board that lost its last few notes still shows the rest.
 */
export function closeTruncatedJson(text: string): string {
  const open: string[] = []
  let inString = false
  let escaped = false

  for (const char of text) {
    if (escaped) {
      escaped = false
    } else if (char === '\\') {
      escaped = inString
    } else if (char === '"') {
      inString = !inString
    } else if (!inString && (char === '{' || char === '[')) {
      open.push(char === '{' ? '}' : ']')
    } else if (!inString && (char === '}' || char === ']')) {
      open.pop()
    }
  }

  const body = (inString ? `${text}"` : text).replace(/[,:\s]+$/, '').replace(/,\s*"[^"]*"$/, '')

  return body + open.reverse().join('')
}

const asObject = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

/** The first JSON object in a model reply — whole, or repaired when the reply was cut off — or null. */
export function jsonObjectOf(reply: string): null | Record<string, unknown> {
  const start = reply.indexOf('{')

  if (start < 0) {
    return null
  }

  const end = reply.lastIndexOf('}')

  for (const candidate of [end > start ? reply.slice(start, end + 1) : '', closeTruncatedJson(reply.slice(start))]) {
    try {
      const parsed = asObject(candidate ? JSON.parse(candidate) : null)

      if (parsed) {
        return parsed
      }
    } catch {
      // The next candidate repairs a cut-off reply.
    }
  }

  return null
}

const text = (value: unknown, max = 400) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

const texts = (value: unknown, cap: number) =>
  Array.isArray(value)
    ? value
        .map(item => text(item, 160))
        .filter(Boolean)
        .slice(0, cap)
    : []

const records = (value: unknown, cap: number) =>
  Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, cap)
    : []

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

export function chatBoardOf(reply: string, basis: number, at = Date.now()): ChatBoard | null {
  const json = jsonObjectOf(reply)

  if (!json) {
    return null
  }

  const notes = Object.fromEntries(NOTE_STATUSES.map(status => [status, texts(json[status], 6)])) as ChatBoard['notes']

  return { at, basis, notes, where: text(json.where) }
}

export function projectMapOf(reply: string, at = Date.now()): null | ProjectMap {
  const json = jsonObjectOf(reply)

  if (!json) {
    return null
  }

  return {
    at,
    branches: records(json.branches, 12)
      .map(row => ({
        name: text(row.name, 80),
        note: text(row.note, 160),
        state: oneOf(row.state, BRANCH_STATES, 'active')
      }))
      .filter(row => row.name),
    decisions: records(json.decisions, 6)
      .map(row => ({ date: text(row.date, 10), text: text(row.text, 200) }))
      .filter(row => row.text),
    failed: texts(json.failed, 5),
    idea: text(json.idea, 600),
    milestones: records(json.milestones, 10)
      .map(row => ({ done: row.done === true, name: text(row.name, 60) }))
      .filter(row => row.name),
    parked: texts(json.parked, 6)
  }
}

export function catchUpOf(reply: string, since: number, at = Date.now()): CatchUp | null {
  const json = jsonObjectOf(reply)

  if (!json) {
    return null
  }

  return {
    at,
    items: records(json.items, 6)
      .map(row => ({
        detail: text(row.detail, 240),
        status: oneOf(row.status, CATCH_UP_STATUSES, 'next'),
        title: text(row.title, 80)
      }))
      .filter(row => row.title),
    since,
    summary: text(json.summary, 600)
  }
}

/** A shell-safe single-quoted argument. */
export const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`
