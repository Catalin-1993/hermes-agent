/** The Projects header's options button: always there, and its items are the app's own project actions. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { $sidebarWorkspaceNodeOpen } from '@/store/layout'
import type * as ProjectsStore from '@/store/projects'
import { openProjectCreate } from '@/store/projects'

import { ProjectsHeaderMenu } from './projects-header-menu'

vi.mock('@/store/projects', async importOriginal => ({
  ...(await importOriginal<typeof ProjectsStore>()),
  openFolderAsProject: vi.fn(async () => undefined),
  openProjectCreate: vi.fn()
}))

afterEach(() => {
  cleanup()
  act(() => $sidebarWorkspaceNodeOpen.set({}))
})

const open = () => {
  render(
    <MemoryRouter>
      <ProjectsHeaderMenu projectIds={['p_1', 'p_2']} />
    </MemoryRouter>
  )
  const trigger = screen.getByRole('button', { name: 'Project options' })
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
}

describe('projects header menu', () => {
  it('starts a new project from the menu', () => {
    open()
    fireEvent.click(screen.getByRole('menuitem', { name: 'New project' }))

    expect(openProjectCreate).toHaveBeenCalled()
  })

  it('folds every project, then unfolds them again', () => {
    open()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Collapse all' }))

    expect($sidebarWorkspaceNodeOpen.get()).toMatchObject({ p_1: false, p_2: false })

    cleanup()
    open()
    expect(screen.getByRole('menuitem', { name: 'Expand all' })).toBeTruthy()
  })
})
