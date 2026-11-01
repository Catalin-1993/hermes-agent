/** A watchdog finding in plain words: the number worth seeing, what it means, and the next step. Pure. */

import type { WatchFinding, WatchKind } from './types'

export interface WatchExplained {
  chip: string
  diagnosis: string
  next: string
}

const hours = (value: number) => (value < 1 ? `${Math.max(1, Math.round(value * 60))} min` : `${Math.round(value)} h`)

const EXPLAIN: Record<WatchKind, (value: number) => WatchExplained> = {
  budget_pace: value => ({
    chip: `≈ $${value.toFixed(2)} projected`,
    diagnosis: 'At the current pace this agent will spend more than its monthly budget.',
    next: 'Open the agent to raise its limit or slow its rhythm.'
  }),
  failing: value => ({
    chip: `${Math.round(value)} failed tries`,
    diagnosis: 'The last tries all failed, so Hermes stopped retrying to save credit.',
    next: 'Open the task: it explains what went wrong and what to do, then retry.'
  }),
  slow: value => ({
    chip: `${value.toFixed(1)}× the usual time`,
    diagnosis: 'This task is taking much longer than similar ones did.',
    next: 'Give it a little more time, or restart it.'
  }),
  stalled: value => ({
    chip: `silent for ${Math.round(value)} min`,
    diagnosis: 'The agent started this task but has stopped reporting in, so it may be frozen.',
    next: 'Restart it so a fresh run takes over.'
  }),
  unclaimed: value => ({
    chip: `waiting ${hours(value)}`,
    diagnosis: 'The task is ready, but no agent has picked it up.',
    next: 'Wake the dispatcher. If it stays idle, check the agent is not paused or over budget.'
  }),
  waiting: value => ({
    chip: `untouched for ${hours(value)}`,
    diagnosis: 'Nobody has touched this task for a long time.',
    next: 'Open it and decide: continue, reassign or close it.'
  })
}

export const explainWatch = (finding: WatchFinding): WatchExplained => EXPLAIN[finding.kind](finding.value)
