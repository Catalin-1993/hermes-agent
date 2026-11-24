/** Brain: "Structured chat" is one switch in Chat display, off until turned on, and it sticks. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n'
import { $structuredChat } from '@/store/chat-style'

import { ThreadDisplayToggles } from './thread-display-toggles'

afterEach(() => {
  cleanup()
  $structuredChat.set(false)
})

describe('Structured chat switch', () => {
  it('starts off and turns the structured layout on', () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <ThreadDisplayToggles />
      </I18nProvider>
    )

    const toggle = screen.getByRole('switch', { name: /Structured chat/ })
    expect($structuredChat.get()).toBe(false)
    fireEvent.click(toggle)
    expect($structuredChat.get()).toBe(true)
    expect(localStorage.getItem('hermes.desktop.structured-chat.v1')).toBe('true')
  })
})
