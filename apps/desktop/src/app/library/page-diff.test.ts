import { describe, expect, it } from 'vitest'

import { diffLines } from './page-diff'

const rebuild = (lines: ReturnType<typeof diffLines>, side: 'added' | 'removed') =>
  lines.filter(line => line.kind !== side).map(line => line.text)

describe('diffLines', () => {
  it('reads back as the old page on one side and the new page on the other', () => {
    const before = '# Plan\n\nGoals\n\nBudget: 10k\n\nOwner: Ana'
    const after = '# Plan\n\nGoals\n\nBudget: 12k\n\nTimeline: Q4\n\nOwner: Ana'
    const lines = diffLines(before, after)

    expect(rebuild(lines, 'added')).toEqual(['# Plan', 'Goals', 'Budget: 10k', 'Owner: Ana'])
    expect(rebuild(lines, 'removed')).toEqual(['# Plan', 'Goals', 'Budget: 12k', 'Timeline: Q4', 'Owner: Ana'])
    expect(lines.filter(line => line.kind !== 'same')).toEqual(
      expect.arrayContaining([
        { kind: 'removed', text: 'Budget: 10k' },
        { kind: 'added', text: 'Budget: 12k' },
        { kind: 'added', text: 'Timeline: Q4' }
      ])
    )
    expect(lines.filter(line => line.kind !== 'same')).toHaveLength(3)
  })

  it('finds nothing changed in a page that only gained blank lines', () => {
    expect(diffLines('a\nb', 'a\n\n\nb').every(line => line.kind === 'same')).toBe(true)
  })
})
