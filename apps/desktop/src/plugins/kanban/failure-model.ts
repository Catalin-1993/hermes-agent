/**
 * The raw text of a failed task, made readable: what happened in one line, the likely reason in plain words, the
 * numbers worth seeing (tries, exit code, how long it ran), and what to do next. The original text stays available
 * under "Technical details". Pure, so it is tested.
 */

export type FailureCause = 'crash' | 'provider' | 'start' | 'timeout' | 'unknown'

export interface Failure {
  cause: FailureCause
  facts: { label: string; value: string }[]
  headline: string
  raw: string
  steps: string[]
  why: string
}

const COPY: Record<FailureCause, { headline: string; steps: string[]; why: string }> = {
  provider: {
    headline: 'The AI model did not answer',
    steps: [
      'Pick another model for this task in “Model” on the right (or for the agent in its file).',
      'If you use OpenRouter, check the key still has credit.',
      'Then retry the task.'
    ],
    why: 'Hermes tried every model it had for this agent and each one failed. This usually means a limit was reached, the balance is empty, or the model refuses a setting it was sent.'
  },
  timeout: {
    headline: 'It ran out of time',
    steps: ['Split the task into smaller ones, or give it more time.', 'Then retry the task.'],
    why: 'The agent kept working longer than the time allowed and was stopped.'
  },
  start: {
    headline: 'The agent could not start',
    steps: ['Check that the agent exists in the Agents page and that Hermes is installed.', 'Then retry the task.'],
    why: 'The worker process never got going, so no work was done.'
  },
  crash: {
    headline: 'The agent stopped unexpectedly',
    steps: ['Open the “Worker log” tab to see its last lines.', 'Then retry the task.'],
    why: 'The agent’s process ended with an error before it finished.'
  },
  unknown: {
    headline: 'The task failed',
    steps: ['Open the “Worker log” tab to see what happened.', 'Then retry the task.'],
    why: 'Hermes has no more specific reason for this failure.'
  }
}

const CAUSES: [RegExp, FailureCause][] = [
  [/fallback chain|rate.?limit|\b429\b|insufficient|credit|quota|invalid.{0,20}param|provider/i, 'provider'],
  [/timed? ?out|time limit|max.?runtime/i, 'timeout'],
  [/spawn|failed to start|could not start|not found|no such file/i, 'start'],
  [/exited with code|crash|killed|signal/i, 'crash']
]

const FAILED = /failed (\d+) times? in a row|exited with code|timed? ?out|crash|worker's last output/i

/** The failure text split into headline, reason, facts and steps; null when it is not a failure report. */
export function explainFailure(text: null | string | undefined): Failure | null {
  const raw = (text ?? '').trim()

  if (!raw || !FAILED.test(raw)) {
    return null
  }

  const cause = CAUSES.find(([pattern]) => pattern.test(raw))?.[1] ?? 'unknown'
  const facts: Failure['facts'] = []
  const tries = raw.match(/failed (\d+) times? in a row/i)?.[1]
  const exit = raw.match(/exited with code (-?\d+)/i)?.[1]
  const duration = raw.match(/Duration:\s*([0-9hms ]+?)(?=\s+Messages:|\s+⚠|\s*$)/)?.[1]?.trim()
  const messages = raw.match(/Messages:\s*(\d+)\s*\(([^)]*)\)/)
  const limit = raw.match(/circuit breaker is configured for (\d+)/i)?.[1]

  tries && facts.push({ label: 'Tries in a row', value: tries })
  exit && facts.push({ label: 'Exit code', value: exit })
  duration && facts.push({ label: 'Ran for', value: duration })
  messages && facts.push({ label: 'Messages', value: `${messages[1]} (${messages[2]})` })

  const copy = COPY[cause]

  const why = limit
    ? `${copy.why} After ${limit} failed tries in a row it stops trying, so it does not waste credit.`
    : copy.why

  return { cause, facts, headline: copy.headline, raw, steps: copy.steps, why }
}
