/** The Chat page's threads: a task's comments as messages and its work events as short system lines, in time
 *  order; and the team feed, every thread merged. Pure, so it is tested. */

import type { KanbanComment, KanbanEvent } from './types'

/** Comment authors that are the owner writing from the app. */
const OWNER = new Set(['dashboard', 'desktop', 'owner', 'user', 'you'])

/** Work events worth a line in a conversation (comments are messages already). */
export const EVENT_KINDS = [
  'assigned',
  'blocked',
  'claimed',
  'completed',
  'crashed',
  'created',
  'gave_up',
  'review_requested',
  'timed_out',
  'unblocked'
] as const

export type EventKind = (typeof EVENT_KINDS)[number]

export type ChatLine =
  | { at: number; author: string; body: string; id: string; kind: 'message'; mine: boolean; taskId: string }
  | { at: number; event: EventKind; id: string; kind: 'event'; taskId: string }

export const isOwner = (author: string) => OWNER.has(author.trim().toLowerCase())

export function threadLines(
  taskId: string,
  comments: readonly KanbanComment[],
  events: readonly KanbanEvent[]
): ChatLine[] {
  const known = new Set<string>(EVENT_KINDS)

  const messages: ChatLine[] = comments.map(comment => ({
    at: comment.created_at,
    author: comment.author,
    body: comment.body,
    id: `c${comment.id}`,
    kind: 'message',
    mine: isOwner(comment.author),
    taskId
  }))

  const lines: ChatLine[] = events
    .filter(event => known.has(event.kind))
    .map(event => ({ at: event.created_at, event: event.kind as EventKind, id: `e${event.id}`, kind: 'event', taskId }))

  return [...messages, ...lines].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
}

/** Every thread in one feed, oldest first; only the newest `limit` lines are kept. */
export function teamFeed(threads: readonly ChatLine[][], limit: number): ChatLine[] {
  return threads
    .flat()
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .slice(-limit)
}

/** Work events that matter when many conversations share one feed (the rest stay in the task's own thread). */
const FEED_EVENTS = new Set<string>(['blocked', 'completed', 'crashed', 'gave_up', 'review_requested', 'timed_out'])

/** A shared feed (the team, or one agent) keeps every message and only the events worth seeing there. */
export const feedLines = (lines: readonly ChatLine[]) =>
  lines.filter(line => line.kind === 'message' || FEED_EVENTS.has(line.event))

/** The newest message of a thread, for its row in the list. */
export const lastMessage = (lines: readonly ChatLine[]) =>
  [...lines].reverse().find(line => line.kind === 'message') ?? null

/** A finished task's result is the agent's last word: shown as its message, so a question asked in Chat reads as
 *  question → answer. */
export function answerLine(
  taskId: string,
  task: { assignee?: null | string; completed_at?: null | number; result?: null | string; status: string }
): ChatLine | null {
  const body = task.result?.trim()

  if (task.status !== 'done' || !body || !task.assignee) {
    return null
  }

  return { at: task.completed_at ?? 0, author: task.assignee, body, id: 'result', kind: 'message', mine: false, taskId }
}

/** The fields of a profile that say who an agent is. */
export interface ChatAgent {
  description?: string
  display_name?: string
  is_default?: boolean
  name: string
  reports?: string[]
  reports_to?: string
  title?: string
}

export interface AgentPick {
  agent: string
  /** The question words that matched the agent (empty for a mention or the lead). */
  matched: string[]
  why: 'lead' | 'match' | 'mention'
}

const STOP = new Set(
  (
    'about after again also and any are ask asked can could does doing done for from get give has have help how into ' +
    'its just know let like make need not now our out please should some tell than that the their them then there ' +
    'they this was what when where which who why will with would you your ' +
    'acum ale are asta care cat cum dar din este face fie iar ice inca mai mie nou noi pentru poti sau sunt tot unde ' +
    'vreau'
  ).split(' ')
)

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/** The question's words that count (no filler), each with its stem — its first five letters, enough for "design",
 *  "designer" and "designul" to meet. */
const words = (text: string) =>
  [...new Set(fold(text).match(/[a-z0-9]{3,}/g) ?? [])]
    .filter(word => !STOP.has(word))
    .map(word => ({ stem: word.slice(0, 5), word }))

const stems = (text: string) => new Set(words(text).map(item => item.stem))

const label = (agent: ChatAgent) => [agent.name, agent.display_name ?? '', agent.title ?? ''].join(' ')

/** The agent named with @, or a plain mention of its name. */
function mentioned(question: string, agents: readonly ChatAgent[]): ChatAgent | undefined {
  const text = fold(question)

  return (
    agents.find(agent => text.includes(`@${fold(agent.name)}`)) ??
    agents.find(agent =>
      new RegExp(`(^|[^a-z0-9])${fold(agent.name).replace(/[^a-z0-9]/g, '.')}($|[^a-z0-9])`).test(text)
    )
  )
}

/** The team's lead: the agent nobody reports to that has reports, else the default profile, else the first. */
function lead(agents: readonly ChatAgent[]): ChatAgent {
  const names = new Set(agents.map(agent => agent.name))

  return (
    agents.find(agent => (!agent.reports_to || !names.has(agent.reports_to)) && (agent.reports?.length ?? 0) > 0) ??
    agents.find(agent => agent.is_default) ??
    agents[0]
  )
}

/** Who answers a question asked to the whole team: the agent it names, else the one whose name, title and
 *  description share the most words with it (name and title count double), else the lead. */
export function pickAgent(question: string, agents: readonly ChatAgent[]): AgentPick | null {
  if (!agents.length) {
    return null
  }

  const named = mentioned(question, agents)

  if (named) {
    return { agent: named.name, matched: [], why: 'mention' }
  }

  const asked = words(question)
  let best: { agent: ChatAgent; matched: string[]; score: number } | null = null

  for (const agent of agents) {
    const strong = stems(label(agent))
    const weak = stems(agent.description ?? '')
    const hits = asked.filter(({ stem }) => strong.has(stem) || weak.has(stem))
    const matched = hits.map(item => item.word)
    const score = hits.reduce((sum, { stem }) => sum + (strong.has(stem) ? 2 : 1), 0)

    if (score > (best?.score ?? 0)) {
      best = { agent, matched, score }
    }
  }

  return best
    ? { agent: best.agent.name, matched: best.matched, why: 'match' }
    : { agent: lead(agents).name, matched: [], why: 'lead' }
}

export const QUESTION_PREFIX = 'Question: '

/** The card a Chat question becomes: assigned to the agent who answers, its answer the card's result. */
export function questionTask(question: string, agent: string) {
  const text = question.trim()
  const first = text.split('\n')[0]
  const title = QUESTION_PREFIX + (first.length > 70 ? `${first.slice(0, 69)}…` : first)

  const body = [
    'The owner asked a question in the project Chat, and it is yours to answer.',
    '',
    'Question:',
    ...text.split('\n').map(line => `> ${line}`),
    '',
    "Answer in a few short, clear sentences, in the owner's language, as this task's result, then complete the task.",
    'Do not start other work: if the question needs real work, say what you would do and ask first.'
  ].join('\n')

  return { assignee: agent, body, title }
}

export const isQuestion = (title: string | null | undefined) => (title ?? '').startsWith(QUESTION_PREFIX)
