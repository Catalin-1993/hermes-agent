/** The Journal lists a project's decisions, reports and conversations by month, filters and searches them, and
 *  opens one to its text. Real component, only the REST layer mocked. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line no-restricted-imports
import { registerPluginLocales } from '@/i18n/plugin-i18n'

import type * as KanbanApi from './api'
import { KANBAN_LOCALES } from './i18n'
import { BoardJournal } from './journal-view'
import type { KanbanBoard } from './types'

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  fetchJournal: vi.fn(async () => ({
    entries: [
      {
        agent: 'risc',
        date: '2026-10-26T14:32:00',
        outcome: 'approved',
        path: 'a.md',
        task: 't1',
        title: 'Cap ETH',
        type: 'decision'
      },
      {
        agent: 'analist',
        date: '2026-10-20T09:00:00',
        outcome: '',
        path: 'b.md',
        task: 't2',
        title: 'Raport LINK',
        type: 'report'
      },
      {
        agent: 'risc',
        date: '2026-09-02T09:00:00',
        outcome: '',
        path: 'c.md',
        task: 't3',
        title: 'Buget Q3',
        type: 'conversation'
      }
    ],
    root: '/x/journal'
  })),
  fetchJournalEntry: vi.fn(async () => ({
    content: '---\ntype: decision\n---\n\n# Decision: Cap ETH\n\nMatches my plan.'
  }))
}))

const board = { assignees: [], columns: [], latest_event_id: 0, now: 0, tenants: [] } as KanbanBoard
let disposeLocales: () => void = () => undefined

beforeEach(() => {
  disposeLocales = registerPluginLocales('kanban', KANBAN_LOCALES)
})

afterEach(() => {
  cleanup()
  disposeLocales()
})

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BoardJournal board={board} onOpen={() => undefined} />
    </QueryClientProvider>
  )

describe('journal', () => {
  it('groups entries by month, newest first, and filters by kind', async () => {
    show()

    expect(await screen.findByText('Cap ETH')).toBeTruthy()
    expect(screen.getByText('October 2026')).toBeTruthy()
    expect(screen.getByText('September 2026')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reports' }))

    expect(screen.queryByText('Cap ETH')).toBeNull()
    expect(screen.getByText('Raport LINK')).toBeTruthy()
  })

  it('searches the titles', async () => {
    show()
    await screen.findByText('Cap ETH')

    fireEvent.change(screen.getByLabelText('Search the journal…'), { target: { value: 'buget' } })

    expect(screen.queryByText('Cap ETH')).toBeNull()
    expect(screen.getByText('Buget Q3')).toBeTruthy()
  })

  it('opens an entry to its text', async () => {
    show()

    fireEvent.click(await screen.findByText('Cap ETH'))

    expect(await screen.findByText('Matches my plan.')).toBeTruthy()
  })
})
