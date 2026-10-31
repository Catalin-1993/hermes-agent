/** The Chat shows each task's messages and work updates, and what you send reaches the agent as a comment on its
 *  task. Real component, only the REST layer mocked. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line no-restricted-imports
import { registerPluginLocales } from '@/i18n/plugin-i18n'

import type * as KanbanApi from './api'
import { addComment } from './api'
import { BoardChat } from './chat-view'
import { KANBAN_LOCALES } from './i18n'
import type { KanbanBoard } from './types'

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  addComment: vi.fn(async () => ({})),
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
  }))
}))

const board: KanbanBoard = {
  assignees: ['risc'],
  columns: [
    { name: 'review', tasks: [{ assignee: 'risc', comment_count: 2, id: 'r1', status: 'review', title: 'Raport ETH' }] }
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

describe('chat', () => {
  it('shows a task as a conversation and sends a message to it as a comment', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <BoardChat board={board} onOpen={() => undefined} />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByText('Raport ETH', { selector: 'span' }))

    expect(await screen.findByText('Am terminat raportul despre ETH.')).toBeTruthy()
    expect(screen.getByText('Mulțumesc, îl citesc.')).toBeTruthy()
    expect(screen.getByText('This task is waiting for you')).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Aprob, mergi mai departe.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(addComment).toHaveBeenCalledWith('r1', 'Aprob, mergi mai departe.'))
  })
})
