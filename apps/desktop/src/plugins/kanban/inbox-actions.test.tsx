/**
 * The Inbox and Agents actions do what their buttons say, through the existing task and control
 * routes: an answer is a comment followed by a resume, an approval moves the card to Done, and the
 * agent card's Pause sets that agent's pause. Real components, only the REST layer mocked.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Test harness supplies the host's locale registration, as plugin loading does.
// eslint-disable-next-line no-restricted-imports
import { registerPluginLocales } from '@/i18n/plugin-i18n'

import type * as KanbanApi from './api'
import { addComment, patchTask, recordDecision, setControl } from './api'
import { KANBAN_LOCALES } from './i18n'
import { BoardInbox } from './inbox'
import { BoardTeam } from './team-page'
import type { KanbanBoard, KanbanControls } from './types'

const controls: KanbanControls = {
  agents: [
    {
      monthly_budget_usd: 10,
      month_spend_usd: 4.2,
      pause_reason: null,
      paused: false,
      paused_at: null,
      profile: 'analist',
      unpriced_sessions: 0
    }
  ],
  all_paused: false,
  all_paused_at: null,
  month_start: 0
}

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  addComment: vi.fn(async () => ({})),
  fetchActivity: vi.fn(async () => ({ by_profile: {}, days: [], events: [], now: 0, success_rate: null, totals: {} })),
  fetchControls: vi.fn(async () => controls),
  fetchProfiles: vi.fn(async () => ({
    profiles: [
      {
        description: '',
        description_auto: false,
        is_default: false,
        name: 'analist',
        reports: [],
        reports_to: '',
        title: ''
      }
    ]
  })),
  fetchRhythms: vi.fn(async () => ({ rhythms: {} })),
  patchTask: vi.fn(async () => ({})),
  recordDecision: vi.fn(async () => ({})),
  setControl: vi.fn(async () => controls)
}))

const board: KanbanBoard = {
  assignees: ['analist'],
  columns: [
    {
      name: 'blocked',
      tasks: [
        {
          assignee: 'analist',
          block_kind: 'needs_input',
          id: 'q1',
          latest_summary: 'Ce sumă maximă aloc?',
          status: 'blocked',
          title: 'Buget Q4'
        }
      ]
    },
    { name: 'review', tasks: [{ assignee: 'analist', id: 'r1', status: 'review', title: 'Raport ETH' }] }
  ],
  latest_event_id: 0,
  now: 0,
  tenants: []
}

let disposeLocales: () => void = () => undefined

beforeEach(() => {
  disposeLocales = registerPluginLocales('kanban', KANBAN_LOCALES)
})

afterEach(() => {
  cleanup()
  disposeLocales()
  vi.clearAllMocks()
})

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>
  )

describe('inbox and agent actions', () => {
  it('answers a question as a comment, then resumes the card', async () => {
    wrap(<BoardInbox board={board} onOpen={() => undefined} />)

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'Maxim 2.000 €' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send answer' }))

    await waitFor(() => expect(patchTask).toHaveBeenCalledWith('q1', { status: 'ready' }))
    expect(addComment).toHaveBeenCalledWith('q1', 'Maxim 2.000 €')
    await waitFor(() => expect(recordDecision).toHaveBeenCalledWith('q1', 'answered', 'Maxim 2.000 €'))
    expect(vi.mocked(addComment).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(patchTask).mock.invocationCallOrder[0]
    )
  })

  it('approves a review into Done', async () => {
    wrap(<BoardInbox board={board} onOpen={() => undefined} />)

    fireEvent.click(screen.getByText('Raport ETH')) // the first card starts open; this one is opened by hand
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(patchTask).toHaveBeenCalledWith('r1', { status: 'done' }))
    expect(addComment).not.toHaveBeenCalled()
  })

  it('files an approval in the journal with the reason the owner gave', async () => {
    wrap(<BoardInbox board={board} onOpen={() => undefined} />)

    fireEvent.click(screen.getByText('Raport ETH'))
    fireEvent.change(screen.getByLabelText('Your reason'), { target: { value: 'Matches my plan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(recordDecision).toHaveBeenCalledWith('r1', 'approved', 'Matches my plan'))
  })

  it('pauses one agent from its card, and shows its spend against the budget', async () => {
    wrap(<BoardTeam board={board} onOpen={() => undefined} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Show details on cards (load, runs, budget)' }))
    expect(await screen.findByText('$4.20 of $10.00')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))

    await waitFor(() => expect(setControl).toHaveBeenCalledWith({ paused: true, profile: 'analist' }))
  })
})
