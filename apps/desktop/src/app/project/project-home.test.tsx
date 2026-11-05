/** A project's page: what decides an empty chat shows it, and its name and recent conversations. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $projectTree } from '@/store/project-tree'
import type * as ProjectsStore from '@/store/projects'
import { $companionChats } from '@/store/side-chat'

import { openSession } from '../open-session'

import { ProjectHome, recentStamp, useProjectPage } from './project-home'

vi.mock('../open-session', () => ({ openSession: vi.fn() }))

vi.mock('@/store/projects', async importOriginal => ({
  ...(await importOriginal<typeof ProjectsStore>()),
  fetchProjectSessions: vi.fn(async () => null),
  projectIdForCwd: (cwd: string) => (cwd.startsWith('/cafe') ? 'p_1' : cwd.startsWith('/repo') ? 'auto' : null)
}))

const sessions = [
  { id: 'old', last_active: 1_000, message_count: 8, started_at: 1_000, title: 'Menu prices' },
  { id: 'current', last_active: 2_000, message_count: 2, started_at: 2_000, title: 'This chat' },
  { id: 'unused', last_active: 3_000, message_count: 0, started_at: 3_000, title: 'Never used' }
]

const project = {
  id: 'p_1',
  label: 'Cafenea',
  lastActive: 2_000,
  path: '/cafe',
  previewSessions: sessions,
  repos: [],
  sessionCount: 3
} as never

beforeEach(() => {
  act(() => {
    $projectTree.set([project, { id: 'auto', isAuto: true, label: 'repo', path: '/repo', repos: [] }] as never)
    $companionChats.set([])
  })
})

afterEach(() => {
  cleanup()
  act(() => $projectTree.set([]))
})

describe('useProjectPage', () => {
  const page = (input: Partial<Parameters<typeof useProjectPage>[0]>) =>
    renderHook(() =>
      useProjectPage({
        cwd: '/cafe',
        loading: false,
        messagesEmpty: true,
        routeMismatch: false,
        storedSessionId: 's1',
        ...input
      })
    ).result.current

  it('is the named project of an empty chat', () => {
    expect(page({})).toBe(project)
  })

  it('is nothing once the chat has messages, outside a named project, or beside a page', () => {
    expect(page({ messagesEmpty: false })).toBeNull()
    expect(page({ loading: true })).toBeNull()
    expect(page({ routeMismatch: true })).toBeNull()
    expect(page({ cwd: '/elsewhere' })).toBeNull()
    expect(page({ cwd: '/repo' })).toBeNull()

    act(() => $companionChats.set(['s1']))
    expect(page({})).toBeNull()
  })
})

describe('ProjectHome', () => {
  const show = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ProjectHome project={project} storedSessionId="current" />
        </MemoryRouter>
      </QueryClientProvider>
    )

  it('names the project and lists its conversations, without this chat or chats never used', () => {
    show()

    expect(screen.getByRole('heading', { name: 'Cafenea' })).toBeTruthy()
    expect(screen.getByText('Menu prices')).toBeTruthy()
    expect(screen.queryByText('This chat')).toBeNull()
    expect(screen.queryByText('Never used')).toBeNull()
  })

  it('opens a conversation from the list', () => {
    show()
    fireEvent.click(screen.getByText('Menu prices'))

    expect(openSession).toHaveBeenCalledWith('old', expect.any(Function))
  })
})

describe('recentStamp', () => {
  it('says the time today and the date before that', () => {
    const now = new Date(2026, 10, 5, 16, 0)

    expect(recentStamp(new Date(2026, 10, 5, 15, 58).getTime() / 1000, now)).toMatch(/58/)
    expect(recentStamp(new Date(2026, 8, 16, 9, 0).getTime() / 1000, now)).toMatch(/16/)
  })
})
