/**
 * The board's two looks. Classic is the board as it always was and stays the default; Team washes
 * the lanes in their status tone and adds the Overview face. Real page, only the REST layer mocked.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Test harness supplies the host's locale registration, as plugin loading does.
// eslint-disable-next-line no-restricted-imports
import { registerPluginLocales } from '@/i18n/plugin-i18n'

import type * as KanbanApi from './api'
import { $boardMode, $boardView } from './api'
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
  $boardMode.set('classic')
  $boardView.set('board')
})

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <KanbanBoardPage />
    </QueryClientProvider>
  )

const tintedLanes = (root: HTMLElement) => root.querySelectorAll('.kanban-lane-tint').length

describe('kanban looks', () => {
  it('opens in Classic: the board as it was, no tint and no overview switch', async () => {
    const { container } = renderPage()

    await screen.findByText('Raport BTC')
    expect(tintedLanes(container)).toBe(0)
    expect(screen.queryByRole('button', { name: 'Overview' })).toBeNull()
  })

  it('Team tints the lanes and opens the overview; Classic brings the old board back', async () => {
    const { container } = renderPage()
    await screen.findByText('Raport BTC')

    fireEvent.click(screen.getByRole('button', { name: 'Team' }))
    expect(tintedLanes(container)).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }))
    expect(await screen.findByText('Needs you', { selector: 'h3' })).toBeTruthy()
    expect(await screen.findByText('67%')).toBeTruthy()
    expect(screen.getByText('Buget ETH')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Classic' }))
    expect(screen.queryByText('Needs you', { selector: 'h3' })).toBeNull()
    expect(tintedLanes(container)).toBe(0)
  })
})
