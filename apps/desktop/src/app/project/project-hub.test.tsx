/** The project's cards: one way to add to each, and instructions/knowledge kept as two files in the project's folder. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCronJob, getCronJobs } from '@/api/cron'
import type * as DesktopFs from '@/lib/desktop-fs'
import { $profiles } from '@/store/profile'
import { $projectTree } from '@/store/project-tree'
import { requestStartWorkSession } from '@/store/projects'
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

vi.mock('@/api/cron', () => ({
  createCronJob: vi.fn(async () => ({ id: 'new' })),
  getCronJobs: vi.fn(async () => [])
}))

vi.mock('@/api/mcp', () => ({ listMcpServers: vi.fn(async () => ({ servers: [{ enabled: true, name: 'github' }] })) }))

vi.mock('@/store/projects', async importOriginal => ({
  ...(await importOriginal<typeof ProjectsStore>()),
  fetchProjectSessions: vi.fn(async () => null),
  requestStartWorkSession: vi.fn()
}))

beforeEach(() => {
  act(() =>
    $profiles.set([
      { is_default: true, name: 'default' },
      { display_name: 'Setter', is_default: false, name: 'setter' }
    ] as never)
  )
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
        <ProjectHub project={project} />
      </MemoryRouter>
    </QueryClientProvider>
  )

const triggerCard = () => screen.getByText('Trigger task').closest('section') as HTMLElement

// Radix menus open on the pointerdown a real click makes.
const openMenu = (name: string) =>
  fireEvent.pointerDown(screen.getByRole('button', { name }), { button: 0, ctrlKey: false })

describe('project cards', () => {
  it('shows each card with its one way to add: instructions, connectors, files, skills, trigger task and website', () => {
    show()

    for (const title of ['Instructions', 'Connectors', 'Files & sources', 'Skills', 'Trigger task', 'Website']) {
      expect(screen.getByText(title)).toBeTruthy()
    }

    expect(screen.getByRole('button', { name: 'Upload' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search web' })).toBeTruthy()
  })

  it('saves instructions as .hermes.md in the project folder', async () => {
    fs.files.set('/cafe/.hermes.md', 'Answer in Romanian.\n')
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))

    const box = await screen.findByLabelText('Instructions', { selector: 'textarea' })
    expect((box as HTMLTextAreaElement).value).toBe('Answer in Romanian.')

    fireEvent.change(box, { target: { value: 'Answer in Romanian. Prices in EUR.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(fs.write).toHaveBeenCalledWith('/cafe/.hermes.md', 'Answer in Romanian. Prices in EUR.\n')
    )
  })

  it('adds a note from Upload to .hermes-knowledge.md and points .hermes.md at it', async () => {
    show()
    await screen.findByText('Files & sources')
    openMenu('Upload')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Note' }))
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Menu prices' } })
    fireEvent.change(screen.getByLabelText('What the agent should know…'), { target: { value: 'Starter 12.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add', hidden: false }))

    await waitFor(() => expect(fs.write).toHaveBeenCalledTimes(2))
    expect(fs.write).toHaveBeenCalledWith(
      '/cafe/.hermes-knowledge.md',
      '# Project knowledge\n\n## Menu prices\n\nStarter 12.\n'
    )
    expect(fs.write.mock.calls.find(call => call[0] === '/cafe/.hermes.md')?.[1]).toContain('.hermes-knowledge.md')
  })

  it('copies files picked from Upload into the knowledge folder under free names and points .hermes.md at them', async () => {
    fs.shelf = ['menu.pdf']
    fs.picked = ['/home/c/Downloads/menu.pdf', '/home/c/Downloads/prices.xlsx']
    show()
    expect(await screen.findByText('1 file')).toBeTruthy()
    openMenu('Upload')
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Files' }))

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

  it('lists what the project holds behind its title and takes a file off with its remove button', async () => {
    fs.shelf = ['menu.pdf', 'prices.xlsx']
    show()
    expect(await screen.findByText('menu.pdf')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove “menu.pdf”' }))

    await waitFor(() => expect(fs.trash).toHaveBeenCalledWith('/cafe/knowledge/menu.pdf'))
    await waitFor(() =>
      expect(fs.write.mock.calls.find(call => call[0] === '/cafe/.hermes.md')?.[1]).toContain('`prices.xlsx`')
    )
    expect(screen.queryByText('menu.pdf')).toBeNull()
  })

  it('counts the connectors that are on', async () => {
    show()

    expect(await screen.findByRole('button', { name: /Connectors\s*1/ })).toBeTruthy()
  })

  it("creates a trigger task that runs in the project folder, and lists only this project's", async () => {
    vi.mocked(getCronJobs).mockResolvedValue([
      { enabled: true, id: 'a', name: 'Morning digest', schedule_display: '0 9 * * *', workdir: '/cafe/' },
      { enabled: true, id: 'b', name: 'Other project', workdir: '/other' }
    ] as never)
    show()

    expect(await screen.findByText('Morning digest')).toBeTruthy()
    expect(screen.queryByText('Other project')).toBeNull()

    fireEvent.click(within(triggerCard()).getByRole('button', { name: 'Add' }))
    fireEvent.change(await screen.findByLabelText('What should Brain do?'), { target: { value: 'Sum up the week' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(createCronJob).toHaveBeenCalledWith({
        name: 'Sum up the week',
        prompt: 'Sum up the week',
        schedule: '0 9 * * *',
        workdir: '/cafe'
      })
    )
  })

  it('starts the "with Brain" requests in a chat of the project', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Search web' }))

    expect(requestStartWorkSession).toHaveBeenCalledWith('/cafe', expect.stringContaining('Search the web'), {
      openTab: true
    })
  })

  it('lists the agents (not the default profile) under Team and starts a chat with one in the project folder', () => {
    show()

    expect(screen.getByText('Setter')).toBeTruthy()
    expect(screen.queryByText('default')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Start a chat with Setter' }))

    expect(requestStartWorkSession).toHaveBeenCalledWith('/cafe', '@setter ', { openTab: true })
  })

  it('opens the five-step New agent wizard from Team', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'New agent' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Tools & integrations')).toBeTruthy()
  })

  it('closes a long list with the arrow in its card, keeps the way to add, and remembers it', async () => {
    fs.shelf = ['menu.pdf']
    show()

    expect(await screen.findByText('menu.pdf')).toBeTruthy()
    expect(screen.getByText('Setter')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close the Files & sources list' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close the Team list' }))

    expect(screen.queryByText('menu.pdf')).toBeNull()
    expect(screen.getByText('1 file')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start a chat with Setter' })).toBeNull()
    expect(screen.getByRole('button', { name: 'New agent' })).toBeTruthy()

    cleanup()
    show()
    expect(await screen.findByRole('button', { name: 'Open the Team list' })).toBeTruthy()
  })

  it('offers no arrow for a list with nothing in it', () => {
    show()

    expect(screen.queryByRole('button', { name: /Files & sources list/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Trigger task list/ })).toBeNull()
  })
})
