/** A project's page: who it is, a box that starts a chat in it, and its chats — the Workspace lives in the right sidebar. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $projectTree } from '@/store/project-tree'
import type * as ProjectsStore from '@/store/projects'
import { requestStartWorkSession } from '@/store/projects'
import { $workspacePanel, $workspaceProjectId } from '@/store/workspace-panel'

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
  act(() => $workspacePanel.set(false))
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

  it('opens the right sidebar’s Workspace for this project from its header', () => {
    show()

    expect($workspaceProjectId.get()).toBe('p_1')
    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))

    expect($workspacePanel.get()).toBe(true)
  })
})
