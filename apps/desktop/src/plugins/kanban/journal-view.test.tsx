/** The Journal sums a project up, lists its decisions, reports and conversations by month, filters and searches
 *  them, and shows the one picked as a report. Real component, only the REST layer mocked. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
    content:
      '---\ntype: decision\n---\n\n# Decision: Cap ETH\n\n**Outcome:** Approved  \n**Card:** t1\n\n' +
      "## The agent's report\n| Coin | Share |\n|---|---|\n| ETH | 39% |\n| BTC | 21% |\n\n" +
      '## Your reason\nMatches my plan.'
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

const list = () => within(screen.getByRole('navigation'))

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BoardJournal board={board} onOpen={() => undefined} />
    </QueryClientProvider>
  )

describe('journal', () => {
  it('groups entries by month, newest first, and filters by kind', async () => {
    show()

    await screen.findByText('October 2026')
    expect(list().getByText('Cap ETH')).toBeTruthy()
    expect(screen.getByText('September 2026')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reports' }))

    expect(list().queryByText('Cap ETH')).toBeNull()
    expect(list().getByText('Raport LINK')).toBeTruthy()
  })

  it('searches the titles', async () => {
    show()
    await screen.findByText('October 2026')

    fireEvent.change(screen.getByLabelText('Search the journal…'), { target: { value: 'buget' } })

    expect(list().queryByText('Cap ETH')).toBeNull()
    expect(list().getByText('Buget Q3')).toBeTruthy()
  })

  it('shows the picked entry as a report, with its table drawn as bars', async () => {
    const { container } = show()
    await screen.findByText('October 2026')

    fireEvent.click(list().getByText('Cap ETH'))

    expect(await screen.findByText('Matches my plan.')).toBeTruthy()
    expect(screen.getByText('Your reason')).toBeTruthy()
    expect(container.querySelector('[data-journal-chart]')?.textContent).toContain('ETH')
  })

  it('sums the project up at the top', async () => {
    show()
    await screen.findByText('October 2026')

    expect(screen.getByText('1 of 1 approved')).toBeTruthy()
    expect(screen.getByText('How decisions went')).toBeTruthy()
  })
})
