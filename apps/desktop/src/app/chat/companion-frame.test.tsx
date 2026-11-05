import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { CompanionFrame } from './companion-frame'

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: { library: { withHermes: { closeChat: 'Close chat', openFull: 'Open as full chat' } } } })
}))

vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
  }
)

const rectOf = (left: number, right: number): DOMRect =>
  ({ bottom: 40, height: 40, left, right, top: 0, width: right - left, x: left, y: 0, toJSON: () => ({}) }) as DOMRect

let cluster: HTMLElement

beforeEach(() => {
  window.innerWidth = 1200
  cluster = document.createElement('div')
  cluster.dataset.titlebarCluster = 'right'
  document.body.append(cluster)
})

afterEach(() => {
  cleanup()
  cluster.remove()
})

function handlesRight(chat: DOMRect, controls: DOMRect) {
  vi.spyOn(cluster, 'getBoundingClientRect').mockReturnValue(controls)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this === cluster ? controls : chat
  })

  render(
    <CompanionFrame companion onClose={() => undefined} storedSessionId="s1">
      <div />
    </CompanionFrame>
  )

  const handles = document.querySelector<HTMLElement>('[data-slot="companion-handles"]')

  return handles?.style.right
}

it('keeps its handles off the window controls when the chat is docked at the right edge', () => {
  // The chat ends at the window's edge; the controls (sidebar button, bell, settings) fill the last 160px of the strip.
  expect(handlesRight(rectOf(880, 1200), rectOf(1040, 1192))).toBe('168px')
  expect(screen.getByLabelText('Close chat')).toBeTruthy()
})

it("stays on the chat's own edge when the controls are elsewhere", () => {
  // A chat docked on the left, well clear of the right-hand controls.
  expect(handlesRight(rectOf(200, 520), rectOf(1040, 1192))).toBe('688px')
})
