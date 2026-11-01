/** The Chat is the project's room: each task stands in the channel as its first message with its replies, a
 *  conversation waiting on you carries its card (the Inbox's own actions), a click opens the thread on the right,
 *  and a question to the team goes to the agent it fits. Real component, only the REST layer mocked. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line no-restricted-imports
import { registerPluginLocales } from '@/i18n/plugin-i18n'

import type * as KanbanApi from './api'
import { addComment, createTask, patchTask, recordDecision } from './api'
import { BoardChat } from './chat-view'
import { KANBAN_LOCALES } from './i18n'
import type { KanbanBoard } from './types'

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  addComment: vi.fn(async () => ({})),
  createTask: vi.fn(async () => ({ task: { id: 'q1', status: 'ready', title: 'Question' } })),
  fetchGoals: vi.fn(async () => ({
    goals: [{ id: 1, status: 'active', title: 'Portofoliul înapoi la plan', why: 'ETH e prea mare.' }]
  })),
  fetchJournal: vi.fn(async () => ({
    entries: [
      {
        agent: 'risc',
        date: '2026-10-26T14:32:00',
        outcome: 'approved',
        path: 'a.md',
        task: 'k8',
        title: 'Plafon ETH',
        type: 'decision'
      }
    ],
    root: '/x'
  })),
  fetchProfiles: vi.fn(async () => ({
    profiles: [
      { description: 'Checks risk on every trade', is_default: true, name: 'risc', title: 'Risk analyst' },
      { description: 'Draws screens, colors and icons', name: 'designer', title: 'Product designer' }
    ]
  })),
  fetchTask: vi.fn(async () => ({
    attachments: [],
    comments: [
      { author: 'risc', body: 'Am terminat raportul despre ETH.', created_at: 100, id: 1 },
      { author: 'dashboard', body: 'Mulțumesc, îl citesc.', created_at: 200, id: 2 }
    ],
    events: [{ created_at: 50, id: 9, kind: 'claimed', payload: null }],
    links: { children: [], parents: [] },
    runs: [],
    task: { id: 'r1', status: 'review', title: 'Raport ETH' }
  })),
  patchTask: vi.fn(async () => ({})),
  recordDecision: vi.fn(async () => ({}))
}))

const board: KanbanBoard = {
  assignees: ['risc'],
  columns: [
    {
      name: 'review',
      tasks: [
        {
          assignee: 'risc',
          comment_count: 2,
          id: 'r1',
          latest_summary: 'Ask: Aprobi plafonul de 30% pentru ETH?',
          status: 'review',
          title: 'Raport ETH'
        }
      ]
    }
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

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BoardChat board={board} onOpen={() => undefined} />
    </QueryClientProvider>
  )

describe('chat room', () => {
  it('stands each task in the channel with its replies, and opens the thread to reply in it', async () => {
    show()

    expect(await screen.findByText('Am terminat raportul despre ETH.')).toBeTruthy()
    expect(screen.getByText('Portofoliul înapoi la plan')).toBeTruthy()
    expect(screen.getByText('Plafon ETH')).toBeTruthy()

    fireEvent.click(screen.getByText('1 reply'))
    const panel = await screen.findByLabelText('Close thread').then(button => button.closest('aside')!)
    expect(within(panel as HTMLElement).getByText('Mulțumesc, îl citesc.')).toBeTruthy()

    fireEvent.change(within(panel as HTMLElement).getByRole('textbox'), { target: { value: 'Mergi mai departe.' } })
    fireEvent.click(within(panel as HTMLElement).getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(addComment).toHaveBeenCalledWith('r1', 'Mergi mai departe.'))
  })

  it('approves a review right in the channel, as the Inbox does', async () => {
    show()

    expect(await screen.findByText('Aprobi plafonul de 30% pentru ETH?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(patchTask).toHaveBeenCalledWith('r1', { status: 'done' }))
    await waitFor(() => expect(recordDecision).toHaveBeenCalledWith('r1', 'approved', ''))
  })

  it('sends a team question to the agent whose role fits it, and shows it with who is working', async () => {
    show()

    expect(await screen.findByText('Product designer')).toBeTruthy()
    const composer = screen.getAllByRole('textbox').at(-1)!
    fireEvent.change(composer, { target: { value: 'Ce culori folosim în designul paginii?' } })
    expect(screen.getByText(/designer answers/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ assignee: 'designer' })))
    await waitFor(() => expect(addComment).toHaveBeenCalledWith('q1', 'Ce culori folosim în designul paginii?'))
    expect(await screen.findByText('Ce culori folosim în designul paginii?', { selector: 'p' })).toBeTruthy()
    expect(screen.getByText('designer is working…')).toBeTruthy()
  })

  it('unmounts cleanly with a thread open', async () => {
    const { unmount } = show()

    fireEvent.click(await screen.findByText('1 reply'))
    await screen.findByText('Mulțumesc, îl citesc.')

    expect(() => unmount()).not.toThrow()
  })
})
