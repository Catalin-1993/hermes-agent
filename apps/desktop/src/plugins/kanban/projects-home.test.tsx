/** Projects opens on the list of projects; picking one opens it on its Overview. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as KanbanApi from './api'
import { $boardSlug, $boardView, $projectsHome } from './api'
import { ProjectsHome } from './projects-home'

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  fetchBoards: vi.fn(async () => ({
    boards: [
      { counts: { done: 4, running: 2 }, name: 'Investiții', slug: 'default', total: 13 },
      {
        counts: { blocked: 1, done: 1, review: 1 },
        description: 'Magazin online',
        name: 'Dropshipping',
        slug: 'ds',
        total: 7
      }
    ],
    current: 'default'
  }))
}))

afterEach(() => {
  cleanup()
  $boardSlug.set('')
  $boardView.set('overview')
  $projectsHome.set(true)
})

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ProjectsHome />
    </QueryClientProvider>
  )

describe('projects start page', () => {
  it('shows every project with its progress and what waits on you, and opens one on its Overview', async () => {
    $boardView.set('board')
    show()

    expect(await screen.findByText('Dropshipping')).toBeTruthy()
    expect(screen.getByText('4 of 13 tasks done')).toBeTruthy()
    expect(screen.getByText('2 need you')).toBeTruthy()
    expect(screen.getAllByText('New project').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('Dropshipping'))

    expect($boardSlug.get()).toBe('ds')
    expect($boardView.get()).toBe('overview')
    expect($projectsHome.get()).toBe(false)
  })

  it('searches the projects', async () => {
    show()
    await screen.findByText('Dropshipping')

    fireEvent.change(screen.getByLabelText('Search projects…'), { target: { value: 'magazin' } })

    expect(screen.queryByText('Investiții')).toBeNull()
    expect(screen.getByText('Dropshipping')).toBeTruthy()
  })
})
