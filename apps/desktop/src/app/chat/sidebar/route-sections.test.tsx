/** A plugin's sidebar section shows on its page, or on every page when it names none; the Sessions header names what it shows. */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { registry } from '@/contrib/registry'

import { SIDEBAR_ROUTE_SECTION_AREA } from '../../routes'

import { RouteSections, sessionsSectionHeader, useRouteSections } from './route-sections'

let dispose: () => void = () => undefined

afterEach(() => {
  cleanup()
  dispose()
})

function Host() {
  const items = useRouteSections()

  return (
    <>
      <span data-testid="count">{items.length}</span>
      <RouteSections items={items} />
    </>
  )
}

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Host />
    </MemoryRouter>
  )

describe('route sections', () => {
  it("shows a page's section only on that page", () => {
    dispose = registry.register({
      area: SIDEBAR_ROUTE_SECTION_AREA,
      data: { path: '/kanban' },
      id: 'kanban:sidebar-projects',
      render: () => <p>Kanban projects</p>
    })

    at('/kanban')
    expect(screen.getByText('Kanban projects')).toBeTruthy()
    expect(screen.getByTestId('count').textContent).toBe('1')

    cleanup()
    at('/')
    expect(screen.queryByText('Kanban projects')).toBeNull()
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('shows a section that names no page on every page', () => {
    dispose = registry.register({
      area: SIDEBAR_ROUTE_SECTION_AREA,
      data: {},
      id: 'kanban:sidebar-projects',
      render: () => <p>Projects list</p>
    })

    at('/')
    expect(screen.getByText('Projects list')).toBeTruthy()

    cleanup()
    at('/settings')
    expect(screen.getByTestId('count').textContent).toBe('1')
  })
})

describe('sessionsSectionHeader', () => {
  const base = { grouping: true, hasOverview: false, inProject: false, label: 'Sessions', loading: false }

  it('always names the plain list "Sessions" — projects have their own section — and the project once inside one', () => {
    expect(sessionsSectionHeader(base).label).toBe('Sessions')
    expect(sessionsSectionHeader({ ...base, grouping: false }).label).toBe('Sessions')
    expect(sessionsSectionHeader({ ...base, enteredProject: { label: 'brain' }, inProject: true }).label).toBe('brain')
  })

  it('shows the skeleton only while loading with nothing to show', () => {
    expect(sessionsSectionHeader({ ...base, loading: true }).skeleton).toBe(true)
    expect(sessionsSectionHeader({ ...base, hasOverview: true, loading: true }).skeleton).toBe(false)
  })
})
