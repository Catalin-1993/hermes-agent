/** Brain: the live screen reads nothing while it is off, and shows the frame once it is on. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { $brainScreen } from '@/store/brain-screen'

import type { BrainScreenApi, BrainScreenStatus } from '../../../electron/brain-screen-types'

import { ScreenCard } from './screen-card'

let status: BrainScreenStatus = { enabled: false, permission: 'granted' }
const frame = vi.fn<BrainScreenApi['frame']>(async () => ({ dataUrl: 'data:image/jpeg;base64,AA==', ok: true }))

window.hermesDesktop = {
  ...window.hermesDesktop,
  brainScreen: {
    capture: vi.fn(),
    frame,
    get: async () => status,
    openPermissionSettings: vi.fn(),
    setEnabled: async enabled => (status = { ...status, enabled })
  } as BrainScreenApi
}

afterEach(() => {
  cleanup()
  $brainScreen.set(null)
  frame.mockClear()
})

describe('ScreenCard', () => {
  it('reads the screen only after the person turns the view on', async () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <ScreenCard />
      </I18nProvider>
    )

    await screen.findByText('Off')
    expect(frame).not.toHaveBeenCalled()
    expect(screen.queryByRole('img')).toBeNull()

    fireEvent.click(screen.getByRole('switch', { name: 'Live screen view' }))
    await waitFor(() => expect(screen.getByRole('img').getAttribute('src')).toContain('data:image/jpeg'))
    expect(screen.getByText('Live')).toBeTruthy()
  })
})
