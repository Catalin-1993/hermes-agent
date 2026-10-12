import { describe, expect, it } from 'vitest'

import { nextSelection } from './selection'

const ids = ['a', 'b', 'c', 'd', 'e']

describe('library selection', () => {
  it('extends a range from the anchor in visible order, keeping what was already chosen', () => {
    const picked = nextSelection(new Set(['e']), ids, 'd', 'range', 'b')

    expect([...picked].sort()).toEqual(['b', 'c', 'd', 'e'])
  })

  it('toggles one item without touching the rest', () => {
    expect([...nextSelection(new Set(['a', 'b']), ids, 'a', 'toggle', null)]).toEqual(['b'])
  })
})
