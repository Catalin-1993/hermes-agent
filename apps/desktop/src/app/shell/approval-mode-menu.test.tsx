import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { $approvalModes } from '@/store/approval-mode'
import { $activeGatewayProfile } from '@/store/profile'
import { $gatewayState } from '@/store/session'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'

import { ApprovalModeMenu } from './approval-mode-menu'

const requestGatewayForProfile = vi.hoisted(() =>
  vi.fn(async (_profile: string, _method: string, params?: Record<string, unknown>) => ({
    value: params?.value ?? 'smart'
  }))
)

vi.mock('@/store/gateway', async importOriginal => ({
  ...(await importOriginal<object>()),
  requestGatewayForProfile
}))

beforeAll(() => {
  stubResizeObserver()
  stubMenuDomApis()
})

afterEach(() => {
  cleanup()
  $approvalModes.set({})
  $activeGatewayProfile.set('default')
  $gatewayState.set('idle')
  requestGatewayForProfile.mockClear()
})

describe('composer approval mode menu', () => {
  it('writes the selected mode to the profile it shows and updates its own label', async () => {
    $activeGatewayProfile.set('work')
    render(<ApprovalModeMenu />)

    fireEvent.pointerDown(screen.getByRole('button', { name: /smart/i }), { button: 0 })
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /manual/i }))

    await waitFor(() => {
      // The menu shows the "work" profile, so the write must name it (#125969); an unscoped
      // `config.set` would edit whichever profile the backend was launched with instead.
      expect(requestGatewayForProfile).toHaveBeenCalledWith('work', 'config.set', {
        key: 'approvals.mode',
        value: 'manual',
        profile: 'work'
      })
      expect(screen.getByRole('button', { name: /manual/i })).toBeTruthy()
    })
  })

  it('syncs once the gateway opens instead of sitting on the pre-sync default', async () => {
    // Boot order: the shell (and this chip) mount while the socket is still
    // connecting, so the sync must wait for 'open' — and then actually run.
    // A sync attempted while connecting rejects ("Hermes gateway
    // unavailable") and, swallowed, would leave the chip on its optimistic
    // 'smart' default for the whole session even though the configured mode
    // is 'off'.
    requestGatewayForProfile.mockImplementation(async () => ({ value: 'off' }))
    $activeGatewayProfile.set('boot')
    $gatewayState.set('connecting')
    render(<ApprovalModeMenu />)

    expect(requestGatewayForProfile).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /smart/i })).toBeTruthy()

    act(() => $gatewayState.set('open'))

    await waitFor(() => {
      expect(requestGatewayForProfile).toHaveBeenCalledWith('boot', 'config.get', { key: 'approvals.mode', profile: 'boot' })
      expect(screen.getByRole('button', { name: /off/i })).toBeTruthy()
    })
  })
})
