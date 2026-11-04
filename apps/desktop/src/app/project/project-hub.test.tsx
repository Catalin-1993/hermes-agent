/** The project hub: sections folded to their title, and instructions/knowledge kept as two files
 *  in the project's folder. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PROJECT_HUB_SECTION_AREA } from '@/app/routes'
import { registry } from '@/contrib'
import type * as DesktopFs from '@/lib/desktop-fs'
import { $projectTree } from '@/store/project-tree'
import type * as ProjectsStore from '@/store/projects'

import { ProjectHub } from './project-hub'

const fs = vi.hoisted(() => ({
  api: vi.fn(async (_request: unknown) => ({ ok: true })),
  files: new Map<string, string>(),
  picked: [] as string[],
  shelf: [] as string[],
  trash: vi.fn(async (_path: string) => undefined),
  write: vi.fn(async (path: string, content: string) => ({ path }))
}))

vi.mock('@/lib/desktop-fs', async importOriginal => ({
  ...(await importOriginal<typeof DesktopFs>()),
  readDesktopFileText: vi.fn(async (path: string) => ({ path, text: fs.files.get(path) ?? '' })),
  readDesktopDir: vi.fn(async () => ({
    entries: fs.shelf.map(name => ({ isDirectory: false, name, path: `/cafe/knowledge/${name}` }))
  })),
  readDesktopFileDataUrlLocalFirst: vi.fn(async (path: string) => `data:application/pdf;base64,${path}`),
  selectDesktopPaths: vi.fn(async () => fs.picked),
  trashDesktopPath: fs.trash,
  writeDesktopFileText: fs.write
}))

vi.mock('@/api/client', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hermesApi: fs.api
}))

vi.mock('@/api/mcp', () => ({ listMcpServers: vi.fn(async () => ({ servers: [{ enabled: true, name: 'github' }] })) }))

vi.mock('@/store/projects', async importOriginal => ({
  ...(await importOriginal<typeof ProjectsStore>()),
  fetchProjectSessions: vi.fn(async () => null),
  requestStartWorkSession: vi.fn()
}))

beforeEach(() => {
  fs.files.clear()
  fs.picked = []
  fs.shelf = []
  fs.api.mockClear()
  fs.trash.mockClear()
  fs.write.mockClear()
  localStorage.clear()
  act(() => $projectTree.set([{ id: 'p_1', label: 'Cafenea', path: '/cafe', repos: [], sessionCount: 0 }] as never))
})

afterEach(() => {
  cleanup()
  act(() => $projectTree.set([]))
})

const project = { id: 'p_1', label: 'Cafenea', path: '/cafe', repos: [], sessionCount: 0 } as never

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ProjectHub onClose={() => {}} project={project} />
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('project hub', () => {
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

  it('copies picked files into the project’s knowledge folder under free names and points .hermes.md at them', async () => {
    fs.shelf = ['menu.pdf']
    fs.picked = ['/home/c/Downloads/menu.pdf', '/home/c/Downloads/prices.xlsx']
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Knowledge' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add files' }))

    await waitFor(() => expect(fs.api).toHaveBeenCalledTimes(2))
    expect(fs.api.mock.calls.map(call => (call[0] as { body: { path: string } }).body.path)).toEqual([
      '/cafe/knowledge/menu 2.pdf',
      '/cafe/knowledge/prices.xlsx'
    ])
    await waitFor(() =>
      expect(fs.write.mock.calls.find(call => call[0] === '/cafe/.hermes.md')?.[1]).toContain(
        '`menu 2.pdf`, `menu.pdf`, `prices.xlsx`'
      )
    )
  })

  it('shows the files already on the shelf and takes one off with its remove button', async () => {
    fs.shelf = ['menu.pdf', 'prices.xlsx']
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Knowledge' }))
    expect(await screen.findByText('menu.pdf')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove “menu.pdf”' }))

    await waitFor(() => expect(fs.trash).toHaveBeenCalledWith('/cafe/knowledge/menu.pdf'))
    await waitFor(() =>
      expect(fs.write.mock.calls.find(call => call[0] === '/cafe/.hermes.md')?.[1]).toContain('`prices.xlsx`')
    )
    expect(screen.queryByText('menu.pdf')).toBeNull()
  })

  it('lists the workspace connectors without claiming they are the project’s own', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Connectors' }))

    expect(await screen.findByText('github')).toBeTruthy()
    expect(screen.getByText(/shared by every project/)).toBeTruthy()
  })

  it('draws a section a plugin contributes, folded like the built-in ones', () => {
    const dispose = registry.register({
      area: PROJECT_HUB_SECTION_AREA,
      data: { hint: 'Who works here.', render: () => <p>Max, Setter</p>, title: 'Team' },
      id: 'team'
    })

    show()
    expect(screen.queryByText('Max, Setter')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Team' }))
    expect(screen.getByText('Max, Setter')).toBeTruthy()
    dispose()
  })
})
