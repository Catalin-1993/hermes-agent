/** A chat in a named project shows the project bar with one hub button; other chats show nothing; agents reach "+". */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { COMPOSER_AREAS } from '@/app/chat/composer/contrib'
import { registry } from '@/contrib/registry'
import { $profiles } from '@/store/profile'
import { $projectHubOpen, setProjectHubOpen } from '@/store/project-hub'
import { $projectTree } from '@/store/project-tree'

import { ProjectChatDock } from './project-chat-dock'

vi.mock('@/api/mcp', () => ({ listMcpServers: vi.fn(async () => ({ servers: [] })) }))

const tree = (extra: object = {}) =>
  [{ id: 'p_1', label: 'Cafenea', path: '/cafe', repos: [], sessionCount: 0, ...extra }] as never

beforeEach(() => {
  localStorage.clear()
  act(() => setProjectHubOpen(false))
  act(() => $projectTree.set(tree()))
  act(() =>
    $profiles.set([
      { is_default: true, name: 'default' },
      { is_default: false, name: 'max' }
    ] as never)
  )
})

afterEach(() => {
  cleanup()
  act(() => $projectTree.set([]))
})

const show = (cwd: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ProjectChatDock cwd={cwd} />
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('project chat dock', () => {
  it('leaves the bar out while the chat is still the project page, which shows the name itself', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ProjectChatDock cwd="/cafe/menu" onPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(screen.queryByRole('heading', { name: 'Cafenea' })).toBeNull()
  })

  it('shows the project name and one Project hub button that opens and closes the hub', async () => {
    show('/cafe/menu')

    // No window top row to share here, so the name and button fall back to a bar at the top of the chat.
    expect(await screen.findByRole('heading', { name: 'Cafenea' })).toBeTruthy()
    expect(screen.queryByLabelText('Project hub', { selector: 'aside' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Project hub' }))
    expect(screen.getByLabelText('Project hub', { selector: 'aside' })).toBeTruthy()
    expect($projectHubOpen.get()).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Project hub' }))
    expect(screen.queryByLabelText('Project hub', { selector: 'aside' })).toBeNull()
  })

  it('shows nothing for a chat outside a named project, or in an auto-discovered one', () => {
    show('/elsewhere')
    expect(screen.queryByRole('heading')).toBeNull()

    cleanup()
    act(() => $projectTree.set(tree({ isAuto: true })))
    show('/cafe')
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('offers each agent in the composer + menu and takes the row away when the agent is gone', () => {
    show('/elsewhere')

    const labels = () =>
      registry
        .getArea(COMPOSER_AREAS.attachments)
        .map(row => row.data as { group?: string; label: string })
        .filter(row => row.group === 'agents')
        .map(row => row.label)

    expect(labels()).toEqual(['max'])

    act(() => $profiles.set([{ is_default: true, name: 'default' }] as never))
    expect(labels()).toEqual([])
  })
})
