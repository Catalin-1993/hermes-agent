import { describe, expect, it } from 'vitest'

import { merge3 } from './merge3'

const BASE = ['# A', '', 'one', '', '---', '', '# B', '', 'two', ''].join('\n')

describe('merging the owner’s edit with Brain’s', () => {
  it('keeps both when they touched different slides', () => {
    const mine = BASE.replace('one', 'one, edited by me')
    const theirs = BASE.replace('two', 'two, edited by Brain')
    const { conflicts, text } = merge3(BASE, mine, theirs)

    expect(conflicts).toBe(0)
    expect(text).toContain('one, edited by me')
    expect(text).toContain('two, edited by Brain')
  })

  it('takes a side that the other left alone', () => {
    expect(merge3(BASE, BASE, 'x')).toEqual({ conflicts: 0, text: 'x' })
    expect(merge3(BASE, 'y', BASE)).toEqual({ conflicts: 0, text: 'y' })
    expect(merge3(BASE, 'z', 'z')).toEqual({ conflicts: 0, text: 'z' })
  })

  it('keeps the owner’s words when both rewrote the same line, and says so', () => {
    const { conflicts, text } = merge3(BASE, BASE.replace('one', 'mine'), BASE.replace('one', 'theirs'))

    expect(conflicts).toBe(1)
    expect(text).toContain('mine')
    expect(text).not.toContain('theirs')
  })

  it('carries an insertion by Brain next to an edit by the owner', () => {
    const theirs = `${BASE}\n---\n\n# C\n`
    const { conflicts, text } = merge3(BASE, BASE.replace('two', 'two!'), theirs)

    expect(conflicts).toBe(0)
    expect(text).toContain('two!')
    expect(text).toContain('# C')
  })
})
