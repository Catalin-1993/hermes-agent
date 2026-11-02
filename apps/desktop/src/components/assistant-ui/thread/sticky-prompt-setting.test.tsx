// @vitest-environment jsdom
/** The last question scrolls away with the page unless the user pins it: the pin is a setting, off by default. */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { $stickyPrompt, setStickyPrompt } from '@/store/sticky-prompt'

import { StickyHumanMessageContainer } from './user-message'

afterEach(() => {
  cleanup()
  act(() => setStickyPrompt(false))
})

const root = () => document.querySelector('[data-slot="aui_user-message-root"]') as HTMLElement

describe('pinned question setting', () => {
  it('is off by default: the question is an ordinary message that scrolls with the page', () => {
    expect($stickyPrompt.get()).toBe(false)
    render(<StickyHumanMessageContainer>hello</StickyHumanMessageContainer>)

    expect(root().classList.contains('relative')).toBe(true)
    expect(root().classList.contains('sticky')).toBe(false)
    expect(root().hasAttribute('data-pinned')).toBe(false)
  })

  it('pins the question to the top of the conversation when switched on', () => {
    render(<StickyHumanMessageContainer>hello</StickyHumanMessageContainer>)

    act(() => setStickyPrompt(true))

    expect(root().classList.contains('sticky')).toBe(true)
    expect(root().hasAttribute('data-pinned')).toBe(true)
  })
})
