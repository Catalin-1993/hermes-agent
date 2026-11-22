/**
 * Brain: TASK RECORDER, routine half — turns what the page captured (record-in-page.ts) into the routine Hermes
 * saves and replays, and words the `/learn` request that saves it.
 *
 * A routine is the person's own steps, in order, each one of: open an address, click a control, type into a field,
 * choose in a select, press a key, or arrive at an address (a checkpoint a click or key led to — replay waits for it
 * instead of navigating there itself). Noise is folded away: a click that only focused the field typed into next,
 * a field typed into twice in a row, the same address twice, blank pages. Secrets are never in it.
 *
 * Replay is the agent's own in-app browser tools — `desktop_preview` opens, `drive_preview` clicks, types and
 * presses — so a routine needs no new tool, and the skill `/learn` writes tells the agent to follow the steps
 * exactly, verify each checkpoint, and stop rather than improvise when a step no longer matches the page.
 */

import type { RecordedPageEvent } from './record-in-page'

interface Target {
  label: string
  selector: string
}

export type RoutineStep =
  | ({ kind: 'click' } & Target)
  | ({ key: string; kind: 'press' } & Target)
  | ({ kind: 'select'; value: string } & Target)
  | ({ kind: 'type'; secret?: boolean; value: string } & Target)
  | { kind: 'arrive'; url: string }
  | { kind: 'open'; url: string }

/** A page that follows a click or key this soon was caused by it. */
const CAUSED_WITHIN_MS = 4000

const BLANK = /^(about:blank|chrome-error:|data:)/

const target = (event: RecordedPageEvent): Target => ({
  label: event.label || '',
  selector: event.selector || ''
})

function toStep(event: RecordedPageEvent, previous: RecordedPageEvent | undefined): null | RoutineStep {
  switch (event.kind) {
    case 'page': {
      if (!event.url || BLANK.test(event.url)) {
        return null
      }

      const caused =
        previous && (previous.kind === 'click' || previous.kind === 'key') && event.at - previous.at < CAUSED_WITHIN_MS

      return { kind: caused ? 'arrive' : 'open', url: event.url }
    }

    case 'click':
      return { kind: 'click', ...target(event) }

    case 'key':
      return { key: event.key || 'Enter', kind: 'press', ...target(event) }

    case 'select':
      return { kind: 'select', value: event.value || '', ...target(event) }

    case 'type':
      return event.secret
        ? { kind: 'type', secret: true, value: '', ...target(event) }
        : { kind: 'type', value: event.value || '', ...target(event) }
  }
}

const sameTarget = (a: RoutineStep, b: RoutineStep) =>
  'selector' in a && 'selector' in b && a.selector !== '' && a.selector === b.selector

/** The routine `events` (in the order captured, across every page) describe. */
export function routineFromEvents(events: readonly RecordedPageEvent[]): RoutineStep[] {
  const ordered = [...events].sort((a, b) => a.at - b.at)
  const steps: RoutineStep[] = []
  let previousAction: RecordedPageEvent | undefined

  for (const event of ordered) {
    const step = toStep(event, previousAction)

    if (event.kind !== 'page') {
      previousAction = event
    }

    if (!step) {
      continue
    }

    const last = steps.at(-1)

    // The same address twice (a reload, a page re-reporting itself) is one step.
    if (last && 'url' in last && 'url' in step && last.url === step.url) {
      continue
    }

    // Typing into a field again replaces what was typed before; the click that focused it says nothing new.
    if (last && step.kind === 'type' && (last.kind === 'type' || last.kind === 'click') && sameTarget(last, step)) {
      steps.pop()
    }

    // The first step is always somewhere to start from.
    if (steps.length === 0 && step.kind === 'arrive') {
      steps.push({ kind: 'open', url: step.url })

      continue
    }

    steps.push(step)
  }

  return steps
}

const quoted = (text: string) => `“${text}”`
const named = (step: Target) => (step.label ? quoted(step.label) : 'the element')

/** One line a person reads in the review list. */
export function describeStep(step: RoutineStep): string {
  switch (step.kind) {
    case 'open':
      return `Open ${step.url}`

    case 'arrive':
      return `Arrive at ${step.url}`

    case 'click':
      return `Click ${named(step)}`

    case 'press':
      return `Press ${step.key}${step.label ? ` in ${quoted(step.label)}` : ''}`

    case 'select':
      return `Choose ${quoted(step.value)} in ${named(step)}`

    case 'type':
      return step.secret ? `Type a secret in ${named(step)}` : `Type ${quoted(step.value)} in ${named(step)}`
  }
}

/** A routine name a skill can carry: lowercase words joined by hyphens. */
export function routineSlug(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'browser-routine'
  )
}

/** The `/learn` request that saves `steps` as a skill named after `name`. */
export function routineLearnRequest(name: string, steps: readonly RoutineStep[]): string {
  const slug = routineSlug(name)
  const secrets = steps.some(step => step.kind === 'type' && step.secret)

  return [
    `/learn Save the browser routine I just showed you as a skill named "${slug}" (${name.trim() || slug}).`,
    'I recorded it step by step in the in-app browser. The steps below are the routine — keep every one, in order,',
    'exactly as recorded; do not merge, reorder, reword or "improve" them.',
    '',
    'Requirements for the skill:',
    `- Save the steps verbatim as \`references/steps.json\` (skill_manage write_file) and list them in the Procedure.`,
    '- Replay ONLY with the in-app browser tools: `desktop_preview` action=open for "open";',
    '  `drive_preview` for the rest — click (selector), type (selector + text), press (selector + key);',
    '  "select" = click the select, then the option with that text; "arrive" = a checkpoint: wait for that',
    '  address (desktop_preview action=read) before the next step, never navigate to it yourself.',
    "- Use each step's selector first. If it matches nothing, call drive_preview action=elements and use the",
    "  element whose label matches the step's label. If neither matches, stop and tell me which step failed —",
    '  never guess or skip a step.',
    ...(secrets
      ? [
          '- Steps marked secret were not recorded: at replay, ask me for them (or use a saved login), never store them.'
        ]
      : []),
    '- When every step is done, tell me the routine finished and what page it ended on.',
    '',
    'Recorded steps (JSON):',
    '```json',
    JSON.stringify(steps, null, 2),
    '```'
  ].join('\n')
}
