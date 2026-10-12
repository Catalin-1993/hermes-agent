// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { en } from '@/i18n/en'
import { $panesFlipped, sidebarSide, togglePanesFlipped } from '@/store/layout'

import { AppearanceSettings } from './appearance-settings'

// The titlebar no longer carries "Swap sidebar sides": Settings → Appearance is its home, and it is
// the same state the ⌘\ shortcut writes.

afterEach(() => {
  cleanup()
  act(() => $panesFlipped.set(false))
})

function flipSwitch() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppearanceSettings subpage="window-layout" />
    </QueryClientProvider>
  )

  return screen.getByRole('switch', { name: en.settings.appearance.flipPanesTitle })
}

describe('Swap sidebar sides setting', () => {
  it('moves the sessions sidebar to the other edge and back', () => {
    const toggle = flipSwitch()

    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(sidebarSide()).toBe('left')

    fireEvent.click(toggle)

    expect(sidebarSide()).toBe('right')
    expect(toggle.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(toggle)

    expect(sidebarSide()).toBe('left')
  })

  it('follows the shortcut', () => {
    const toggle = flipSwitch()

    act(() => togglePanesFlipped())

    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })
})
