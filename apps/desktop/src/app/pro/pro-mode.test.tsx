/** Brain: Pro Mode off gives the community app back — the + menu as upstream ships it — and on brings Brain's. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContextMenu } from '@/app/chat/composer/context-menu'
import { I18nProvider } from '@/i18n'
import { $proMode } from '@/store/pro-mode'

afterEach(() => {
  cleanup()
  $proMode.set(true)
})

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

describe('Pro Mode', () => {
  it('is on by default, so an update changes nothing for the person', () => {
    expect($proMode.get()).toBe(true)
  })

  it('shows Brain’s + menu when on and the original one when off', () => {
    openMenu()
    expect(screen.getByRole('menuitem', { name: 'Work until done' })).toBeTruthy()
    expect(screen.queryByText('Attach', { selector: '[data-slot="dropdown-menu-label"]' })).toBeNull()
    cleanup()

    $proMode.set(false)
    openMenu()
    expect(screen.queryByRole('menuitem', { name: 'Work until done' })).toBeNull()
    expect(screen.getByText('Attach', { selector: '[data-slot="dropdown-menu-label"]' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^Files/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^Images/ })).toBeTruthy()
  })
})
