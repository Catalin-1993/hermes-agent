import { describe, expect, it } from 'vitest'

import { NAV_ORDER } from '@/plugins/kanban/brain-data'
import { applySidebarNavPrefs } from '@/store/sidebar-nav'

describe('sidebar order', () => {
  const rows = [
    'artifacts',
    'cron',
    'kanban:projects',
    'new-session',
    'portfolio:nav',
    'kanban:dashboard',
    'kanban:nav'
  ].map(id => ({ id }))

  it('lists Dashboard, New Session, Scheduled Jobs, Portfolio, Library, Projects', () => {
    const order = applySidebarNavPrefs(rows, [{ data: { order: NAV_ORDER } } as never]).map(row => row.id)

    expect(order.slice(0, 6)).toEqual([
      'kanban:dashboard',
      'new-session',
      'cron',
      'portfolio:nav',
      'artifacts',
      'kanban:projects'
    ])
  })

  it('keeps the order when a page is switched off', () => {
    const order = applySidebarNavPrefs(
      rows.filter(row => row.id !== 'kanban:projects'),
      [{ data: { order: NAV_ORDER } } as never]
    )

    expect(order.map(row => row.id).slice(0, 5)).toEqual([
      'kanban:dashboard',
      'new-session',
      'cron',
      'portfolio:nav',
      'artifacts'
    ])
  })
})
