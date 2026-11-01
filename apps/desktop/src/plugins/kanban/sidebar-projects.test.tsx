/** The left sidebar lists the projects on every page but Projects itself; a click opens one on its Overview. */
import { host } from '@hermes/plugin-sdk'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as KanbanApi from './api'
import { $boardSlug, $boardView, $projectsHome, $projectsOpen } from './api'
import { SidebarProjects } from './sidebar-projects'

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  fetchBoards: vi.fn(async () => ({
    boards: [
      { name: 'Investiții', project_id: null, slug: 'default', total: 13 },
      { name: 'Dropshipping', project_id: null, slug: 'dropshipping', total: 7 }
    ],
    current: 'default'
  }))
}))

afterEach(() => {
  cleanup()
  $boardSlug.set('')
  $boardView.set('overview')
  $projectsHome.set(true)
  $projectsOpen.set(false)
  vi.restoreAllMocks()
})

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SidebarProjects />
    </QueryClientProvider>
  )

describe('sidebar projects', () => {
  it('lists the projects, marks the open one, and opens another on its Overview', async () => {
    const navigate = vi.spyOn(host, 'navigate').mockImplementation(() => undefined)
    $boardView.set('board')
    show()

    const open = await screen.findByRole('button', { name: /Investiții/ })
    expect(open.getAttribute('aria-current')).toBe('page')

    fireEvent.click(screen.getByRole('button', { name: /Dropshipping/ }))

    expect($boardSlug.get()).toBe('dropshipping')
    expect($boardView.get()).toBe('overview')
    expect($projectsHome.get()).toBe(false)
    expect(navigate).toHaveBeenCalledWith('/kanban')

    fireEvent.click(screen.getByRole('button', { name: 'All projects' }))
    expect($projectsHome.get()).toBe(true)
  })

  it('steps aside while the Projects page is on screen', async () => {
    $projectsOpen.set(true)
    show()
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(screen.queryByRole('button', { name: /Dropshipping/ })).toBeNull()
  })
})
