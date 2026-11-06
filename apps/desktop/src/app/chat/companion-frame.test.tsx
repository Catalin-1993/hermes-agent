import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { $sessionTiles } from '@/store/session-states'

import { CompanionFrame } from './companion-frame'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      library: {
        withHermes: {
          agentSettings: 'Agent settings…',
          chatOptions: 'Chat options',
          closeChat: 'Close chat',
          openFull: 'Open as full chat'
        }
      }
    }
  })
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

function Where() {
  const location = useLocation()

  return <output data-testid="where">{location.pathname + location.search}</output>
}

beforeEach(() => {
  window.innerWidth = 1200
  cluster = document.createElement('div')
  cluster.dataset.titlebarCluster = 'right'
  document.body.append(cluster)
})

afterEach(() => {
  cleanup()
  $sessionTiles.set([])
  cluster.remove()
})

function handlesRight(chat: DOMRect, controls: DOMRect) {
  vi.spyOn(cluster, 'getBoundingClientRect').mockReturnValue(controls)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this === cluster ? controls : chat
  })

  render(
    <MemoryRouter>
      <CompanionFrame companion onClose={() => undefined} storedSessionId="s1">
        <div />
      </CompanionFrame>
      <Where />
    </MemoryRouter>
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

it("offers the agent's settings from the ⋯ menu, on the profile the chat runs in", async () => {
  $sessionTiles.set([{ ownerProfile: 'ds-ceo', storedSessionId: 's1' }] as never)
  handlesRight(rectOf(880, 1200), rectOf(1040, 1192))

  fireEvent.pointerDown(screen.getByLabelText('Chat options'), { button: 0, ctrlKey: false })
  fireEvent.click(await screen.findByText('Agent settings…'))

  expect(screen.getByTestId('where').textContent).toBe('/profiles?profile=ds-ceo')
})
