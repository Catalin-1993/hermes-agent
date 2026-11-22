/** Brain: the + menu's Library tile runs the Library provider (and leaves the list below), and its two job rows
 * start `/goal` and `/learn` at the head of the draft. */
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
    ['Work until done', '/goal'],
    ['Teach a task', '/learn']
  ])('%s starts %s at the head of the draft', async (label, command) => {
    const inserts: unknown[] = []
    const stop = onComposerInsertRequest(detail => inserts.push(detail))

    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${label}`) }))
    await act(() => new Promise(resolve => setTimeout(resolve, 5)))
    stop()

    expect(inserts).toEqual([expect.objectContaining({ mode: 'prefix', text: command })])
  })
})
