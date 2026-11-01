/** While Kanban is open, the left sidebar lists its projects; a click opens that project on its Overview. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as KanbanApi from './api'
import { $boardSlug, $boardView } from './api'
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
})

describe('sidebar projects', () => {
  it('lists the projects, marks the open one, and opens another on its Overview', async () => {
    $boardView.set('board')
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SidebarProjects />
      </QueryClientProvider>
    )

    const open = await screen.findByRole('button', { name: /Investiții/ })
    expect(open.getAttribute('aria-current')).toBe('page')

    fireEvent.click(screen.getByRole('button', { name: /Dropshipping/ }))

    expect($boardSlug.get()).toBe('dropshipping')
    expect($boardView.get()).toBe('overview')
  })
})
