/** A project's page: who it is, a box that starts a chat in it, and its chats — the hub with instructions, connectors and knowledge sits beside it. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $projectTree } from '@/store/project-tree'
import type * as ProjectsStore from '@/store/projects'
import { requestStartWorkSession } from '@/store/projects'

import { ProjectPage } from './project-page'

vi.mock('@/store/projects', async importOriginal => ({
  ...(await importOriginal<typeof ProjectsStore>()),
  fetchProjectSessions: vi.fn(async () => null),
  requestStartWorkSession: vi.fn()
}))

beforeEach(() => {
  act(() =>
    $projectTree.set([
      {
        id: 'p_1',
        label: 'Cafenea',
        path: '/cafe',
        previewSessions: [{ id: 's1', last_active: 1, title: 'Meniu de toamnă' }],
        repos: [],
        sessionCount: 1
      }
    ] as never)
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  act(() => $projectTree.set([]))
  localStorage.clear()
})

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/project?id=p_1']}>
        <ProjectPage />
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('project page', () => {
  it('lists the project’s chats and starts a new one in its folder with what you typed', () => {
    show()

    expect(screen.getByText('Meniu de toamnă')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Start a chat in Cafenea…'), { target: { value: 'Ce meniu facem?' } })
    fireEvent.keyDown(screen.getByLabelText('Start a chat in Cafenea…'), { key: 'Enter' })

    expect(requestStartWorkSession).toHaveBeenCalledWith('/cafe', 'Ce meniu facem?', { openTab: true })
  })

  it('shows the project hub beside the page and closes and reopens it from the header', () => {
    show()

    expect(screen.getByLabelText('Project hub', { selector: 'aside' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close project hub' }))
    expect(screen.queryByLabelText('Project hub', { selector: 'aside' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Project hub' }))
    expect(screen.getByLabelText('Project hub', { selector: 'aside' })).toBeTruthy()
  })
})
