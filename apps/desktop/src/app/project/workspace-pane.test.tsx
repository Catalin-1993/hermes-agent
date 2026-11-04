/** The Workspace in the right sidebar: sections folded to their title, and instructions/knowledge kept as two files
 *  in the project's folder. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as DesktopFs from '@/lib/desktop-fs'
import { $projectTree } from '@/store/project-tree'
import type * as ProjectsStore from '@/store/projects'
import { $workspaceProjectId } from '@/store/workspace-panel'

import { WorkspacePane } from './workspace-pane'

const fs = vi.hoisted(() => ({
  files: new Map<string, string>(),
  write: vi.fn(async (path: string, content: string) => ({ path }))
}))

vi.mock('@/lib/desktop-fs', async importOriginal => ({
  ...(await importOriginal<typeof DesktopFs>()),
  readDesktopFileText: vi.fn(async (path: string) => ({ path, text: fs.files.get(path) ?? '' })),
  selectDesktopPaths: vi.fn(async () => []),
  writeDesktopFileText: fs.write
}))

vi.mock('@/api/mcp', () => ({ listMcpServers: vi.fn(async () => ({ servers: [{ enabled: true, name: 'github' }] })) }))

vi.mock('@/store/projects', async importOriginal => ({
  ...(await importOriginal<typeof ProjectsStore>()),
  fetchProjectSessions: vi.fn(async () => null),
  requestStartWorkSession: vi.fn()
}))

beforeEach(() => {
  fs.files.clear()
  fs.write.mockClear()
  localStorage.clear()
  act(() => $workspaceProjectId.set('p_1'))
  act(() => $projectTree.set([{ id: 'p_1', label: 'Cafenea', path: '/cafe', repos: [], sessionCount: 0 }] as never))
})

afterEach(() => {
  cleanup()
  act(() => $projectTree.set([]))
  act(() => $workspaceProjectId.set(null))
})

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <WorkspacePane />
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('workspace pane', () => {
  it('shows only the section titles until one is opened, and remembers what was opened', () => {
    show()

    expect(screen.queryByLabelText('Instructions')).toBeNull()
    expect(screen.getByRole('button', { name: 'Connectors' }).getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Connectors' }))
    cleanup()
    show()

    expect(screen.getByRole('button', { name: 'Connectors' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Knowledge' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('says so when the chat’s folder is not part of a project', () => {
    act(() => $workspaceProjectId.set(null))
    act(() => $projectTree.set([]))
    show()

    expect(screen.getByText(/not part of a project/)).toBeTruthy()
  })

  it('saves instructions as .hermes.md in the project folder', async () => {
    fs.files.set('/cafe/.hermes.md', 'Answer in Romanian.\n')
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Instructions' }))

    const box = await screen.findByLabelText('Instructions')
    expect((box as HTMLTextAreaElement).value).toBe('Answer in Romanian.')

    fireEvent.change(box, { target: { value: 'Answer in Romanian. Prices in EUR.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(fs.write).toHaveBeenCalledWith('/cafe/.hermes.md', 'Answer in Romanian. Prices in EUR.\n')
    )
  })

  it('adds a knowledge note to .hermes-knowledge.md and points .hermes.md at it', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Knowledge' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add note' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Menu prices' } })
    fireEvent.change(screen.getByLabelText('What the agent should know…'), { target: { value: 'Starter 12.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(fs.write).toHaveBeenCalledTimes(2))
    expect(fs.write).toHaveBeenCalledWith(
      '/cafe/.hermes-knowledge.md',
      '# Project knowledge\n\n## Menu prices\n\nStarter 12.\n'
    )
    expect(fs.write.mock.calls.find(call => call[0] === '/cafe/.hermes.md')?.[1]).toContain('.hermes-knowledge.md')
  })

  it('lists the workspace connectors without claiming they are the project’s own', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Connectors' }))

    expect(await screen.findByText('github')).toBeTruthy()
    expect(screen.getByText(/shared by every project/)).toBeTruthy()
  })
})
