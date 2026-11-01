import { describe, expect, it } from 'vitest'

import { explainFailure } from './failure-model'
import { explainWatch } from './watch-explain'

const RAW =
  'This task has failed 2 times in a row (most recent: crash). Full last error: pid 20888 exited with code 1 ' +
  'Worker\'s last output: \'_7eae84 hermes -c "Propune 5" Session: 20261019_202303_7eae84 Title: Propune 5 ' +
  'Duration: 4m 55s Messages: 22 (2 user, 18 tool calls) ⚠ No reply: every provider in the fallback chain kept ' +
  "failing over, so the turn stopped instead of retrying forever. Send continue or switch provider.' " +
  'The dispatcher circuit breaker is configured for 2 consecutive non-success attempts.'

describe('explainFailure', () => {
  it('turns the raw failure into a headline, a reason, facts and steps', () => {
    const failure = explainFailure(RAW)!

    expect(failure.cause).toBe('provider')
    expect(failure.headline).toBe('The AI model did not answer')
    expect(failure.facts).toEqual([
      { label: 'Tries in a row', value: '2' },
      { label: 'Exit code', value: '1' },
      { label: 'Ran for', value: '4m 55s' },
      { label: 'Messages', value: '22 (2 user, 18 tool calls)' }
    ])
    expect(failure.why).toContain('After 2 failed tries')
    expect(failure.steps.length).toBeGreaterThan(1)
    expect(failure.raw).toBe(RAW)
  })

  it('tells a crash from a timeout, and leaves other text alone', () => {
    expect(explainFailure('pid 1 exited with code 137')?.cause).toBe('crash')
    expect(explainFailure('The worker timed out after 600 s')?.cause).toBe('timeout')
    expect(explainFailure('Remember to buy milk')).toBeNull()
    expect(explainFailure('')).toBeNull()
  })
})

describe('explainWatch', () => {
  it('gives each finding a number, a meaning and a next step', () => {
    const stalled = explainWatch({
      id: 's',
      kind: 'stalled',
      profile: 'a',
      since: 0,
      task_id: 't',
      task_title: 'T',
      value: 25
    })

    expect(stalled.chip).toBe('silent for 25 min')
    expect(stalled.next).toContain('Restart')
    expect(
      explainWatch({ id: 'u', kind: 'unclaimed', profile: 'a', since: 0, task_id: 't', task_title: 'T', value: 4 }).chip
    ).toBe('waiting 4 h')
  })
})
