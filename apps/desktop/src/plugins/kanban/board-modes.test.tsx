/**
 * The page opens on the Overview, with the lanes one switch away and washed in their status tone.
 * Real page, only the REST layer mocked.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Test harness supplies the host's locale registration, as plugin loading does.
// eslint-disable-next-line no-restricted-imports
import { registerPluginLocales } from '@/i18n/plugin-i18n'

import type * as KanbanApi from './api'
import { $boardView } from './api'
import { KanbanBoardPage } from './board'
import { KANBAN_LOCALES } from './i18n'

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  fetchActivity: vi.fn(async () => ({
    days: [{ blocked: 0, completed: 2, date: '2026-10-22', failed: 1, other: 0 }],
    events: [{ actor: 'analist', created_at: 1, id: 1, kind: 'claimed', task_id: 't1', task_title: 'Raport BTC' }],
    now: 2,
    success_rate: 66.7,
    totals: { blocked: 0, completed: 2, failed: 1, other: 0 }
  })),
  fetchBoard: vi.fn(async () => ({
    assignees: ['analist'],
    columns: [
      { name: 'ready', tasks: [] },
      { name: 'running', tasks: [{ assignee: 'analist', id: 't1', status: 'running', title: 'Raport BTC' }] },
      { name: 'blocked', tasks: [{ block_kind: 'needs_input', id: 't2', status: 'blocked', title: 'Buget ETH' }] }
    ],
    latest_event_id: 0,
    now: 0,
    tenants: []
  })),
  fetchBoards: vi.fn(async () => ({ boards: [], current: 'default' })),
  fetchOrchestration: vi.fn(async () => ({ default_assignee: '' })),
  fetchProfiles: vi.fn(async () => ({ profiles: [] }))
}))

let disposeLocales: () => void = () => undefined

beforeEach(() => {
  disposeLocales = registerPluginLocales('kanban', KANBAN_LOCALES)
})

afterEach(() => {
  cleanup()
  disposeLocales()
  $boardView.set('overview')
})

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <KanbanBoardPage />
    </QueryClientProvider>
  )

const tintedLanes = (root: HTMLElement) => root.querySelectorAll('.kanban-lane-tint').length

describe('kanban faces', () => {
  it('opens on the Overview, first in the switch, with no look switch and no page title', async () => {
    renderPage()

    expect(await screen.findByText('Needs you', { selector: 'h3' })).toBeTruthy()
    expect(await screen.findByText('67%')).toBeTruthy()
    const switches = screen.getAllByRole('button').map(button => button.textContent)
    expect(switches.indexOf('Overview')).toBeLessThan(switches.indexOf('Board'))
    expect(screen.queryByRole('button', { name: 'Classic' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Kanban' })).toBeNull()
  })

  it('shows the lanes, washed in their status tone, from the Board switch', async () => {
    const { container } = renderPage()
    await screen.findByText('Needs you', { selector: 'h3' })

    fireEvent.click(screen.getByRole('button', { name: 'Board' }))

    expect(await screen.findByText('Raport BTC')).toBeTruthy()
    expect(tintedLanes(container)).toBeGreaterThan(0)
  })
})
