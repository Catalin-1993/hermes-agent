import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { en } from '@/i18n/en'
import { $connection, $selectedStoredSessionId, $sessions } from '@/store/session'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { WorkspaceChip } from './workspace-chip'

const openFolderAsProject = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/store/projects', async importOriginal => ({
  ...(await importOriginal<object>()),
  openFolderAsProject
}))

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

afterEach(() => {
  cleanup()
  openFolderAsProject.mockClear()
  $connection.set(null)
  $selectedStoredSessionId.set(null)
  $sessions.set([])
})

// One action, one home: the menu's folder row is the app's Open folder (⌘O, right sidebar).
describe('composer folder menu', () => {
  it('names the folder the chat works in and opens a folder through the app-wide action', async () => {
    render(<WorkspaceChip cwd="/repos/website" />)
    expect(screen.getByText('website')).toBeTruthy()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Projects' }), { button: 0 })
    fireEvent.click(await screen.findByRole('menuitem', { name: /open folder as project/i }))

    expect(openFolderAsProject).toHaveBeenCalledWith()
  })
})

// The folder lives in one place: this menu also carries what the status bar's folder item used to.
describe('composer folder menu — the chosen folder', () => {
  const openMenu = async () => {
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Projects' }), { button: 0 })

    return screen.findByRole('menu')
  }

  const rows = (menu: HTMLElement) =>
    within(menu)
      .queryAllByRole('menuitem')
      .map(row => row.textContent)

  it('offers copy path, the file manager and the tree for a local folder', async () => {
    $connection.set({ mode: 'local' } as never)
    render(<WorkspaceChip cwd="/repos/website" />)

    expect(rows(await openMenu())).toEqual(
      expect.arrayContaining([en.fileMenu.copyPath, en.fileMenu.revealFileManager, en.fileMenu.revealInSidebar])
    )
  })

  it('keeps the file manager out when the backend is another machine', async () => {
    $connection.set({ mode: 'remote' } as never)
    render(<WorkspaceChip cwd="/srv/app" />)

    const menu = await openMenu()

    expect(rows(menu)).toContain(en.fileMenu.copyPath)
    expect(rows(menu)).toContain(en.fileMenu.revealInSidebar)
    expect(rows(menu)).not.toContain(en.fileMenu.revealFileManager)
  })

  // #115167: a local-primary window can hold a session that runs on a remote gateway.
  it("follows the session's own gateway, not just the window's", async () => {
    $connection.set({ mode: 'local' } as never)
    $selectedStoredSessionId.set('remote-chat')
    $sessions.set([{ connection_id: 'conn-remote', id: 'remote-chat' }] as never)
    render(<WorkspaceChip cwd="/srv/bot/workspace" />)

    expect(rows(await openMenu())).not.toContain(en.fileMenu.revealFileManager)
  })

  it('has no path actions before a folder is chosen', async () => {
    render(<WorkspaceChip cwd="" />)

    const menu = await openMenu()

    expect(rows(menu)).not.toContain(en.fileMenu.copyPath)
    expect(rows(menu)).not.toContain(en.fileMenu.revealInSidebar)
  })
})
