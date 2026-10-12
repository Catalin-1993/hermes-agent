import { describe, expect, it } from 'vitest'

import { applySidebarNavPins } from '@/store/sidebar-nav'

// The Edit menu's contract: a pin moves a row between the main list and More; what the user never
// touched keeps its own place; the one row the sidebar cannot do without cannot be sent away.

const rows = [
  { id: 'new-session' },
  { id: 'capabilities' },
  { group: 'more' as const, id: 'connectors' },
  { group: 'more' as const, id: 'starmap' }
]

const placed = (pins: Record<string, boolean>) =>
  Object.fromEntries(applySidebarNavPins(rows, pins).map(row => [row.id, row.group === 'more' ? 'more' : 'list']))

describe('applySidebarNavPins', () => {
  it('leaves every row where it is by default', () => {
    expect(placed({})).toEqual({ capabilities: 'list', connectors: 'more', 'new-session': 'list', starmap: 'more' })
  })

  it('moves a row both ways, and never sends New session away', () => {
    expect(placed({ capabilities: false, connectors: true, 'new-session': false })).toEqual({
      capabilities: 'more',
      connectors: 'list',
      'new-session': 'list',
      starmap: 'more'
    })
  })
})
