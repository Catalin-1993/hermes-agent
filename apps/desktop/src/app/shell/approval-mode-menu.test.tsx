import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { $approvalModes } from '@/store/approval-mode'
import { $activeGatewayProfile } from '@/store/profile'
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
})
