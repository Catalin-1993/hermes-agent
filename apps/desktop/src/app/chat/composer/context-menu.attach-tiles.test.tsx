/** Brain: the + menu's Library tile runs the Library provider (and leaves the list below), its job rows start
 * `/goal` and `/learn` at the head of the draft, and the agents sit in one submenu. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registry } from '@/contrib/registry'
import { I18nProvider } from '@/i18n'

import { ContextMenu } from './context-menu'
import { COMPOSER_AREAS } from './contrib'
import { onComposerInsertRequest } from './focus'

afterEach(cleanup)

function openMenu() {
  render(
    <I18nProvider configClient={null} initialLocale="en">
      <ContextMenu
        onInsertText={vi.fn()}
        onOpenUrlDialog={vi.fn()}
        onPickFiles={vi.fn()}
        onPickImages={vi.fn()}
        state={{ tools: { enabled: true, label: 'Attach' } } as never}
      />
    </I18nProvider>
  )

  fireEvent.pointerDown(screen.getByRole('button', { name: 'Attach' }), { button: 0, ctrlKey: false })
}

describe('attach menu tiles', () => {
  it('opens the Library from its tile and does not list "From Library" again', () => {
    const run = vi.fn()

    let dispose = () => {}

    act(() => {
      dispose = registry.register({
        area: COMPOSER_AREAS.attachments,
        data: { icon: 'library', label: 'From Library…', run },
        id: 'library'
      })
    })

    openMenu()

    expect(screen.queryByText('From Library…')).toBeNull()

    const tile = screen.getByRole('menuitem', { name: 'Library' })

    expect(tile.getAttribute('aria-disabled')).not.toBe('true')
    fireEvent.click(tile)
    expect(run).toHaveBeenCalledTimes(1)

    act(() => dispose())
  })

  it.each([
    ['Work until done', [], '/goal'],
    ['Teach a task', ['Describe it'], '/learn']
  ])('%s starts its command at the head of the draft', async (row, submenu, command) => {
    const inserts: unknown[] = []
    const stop = onComposerInsertRequest(detail => inserts.push(detail))

    openMenu()

    if (submenu.length) {
      fireEvent.keyDown(screen.getByRole('menuitem', { name: row }), { key: 'ArrowRight' })
      fireEvent.click(await screen.findByRole('menuitem', { name: submenu[0] }))
    } else {
      fireEvent.click(screen.getByRole('menuitem', { name: row }))
    }

    await act(() => new Promise(resolve => setTimeout(resolve, 5)))
    stop()

    expect(inserts).toEqual([expect.objectContaining({ mode: 'prefix', text: command })])
  })

  it('folds the agents into one Agents submenu', async () => {
    const run = vi.fn()

    let dispose = () => {}

    act(() => {
      dispose = registry.register({
        area: COMPOSER_AREAS.attachments,
        data: { group: 'agents', icon: 'account', label: 'Setter', run },
        id: 'agent-setter'
      })
    })

    openMenu()
    expect(screen.queryByRole('menuitem', { name: 'Setter' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Agents' }), { key: 'ArrowRight' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Setter' }))
    expect(run).toHaveBeenCalledTimes(1)

    act(() => dispose())
  })
})
