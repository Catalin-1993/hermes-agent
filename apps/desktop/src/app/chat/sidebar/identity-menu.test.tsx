/** Brain: the profile menu's Identity submenu lists only identity tools, and keeps the social links you paste. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PROFILE_IDENTITY_AREA } from '@/contrib/profile-identity'
import { registry } from '@/contrib/registry'
import { I18nProvider } from '@/i18n'
import { $identityLinks } from '@/store/identity-links'

import { IdentityMenu } from './identity-menu'

afterEach(() => {
  cleanup()
  $identityLinks.set({})
})

async function openIdentity() {
  render(
    <I18nProvider configClient={null} initialLocale="en">
      <DropdownMenu open>
        <DropdownMenuTrigger>Profile</DropdownMenuTrigger>
        <DropdownMenuContent>
          <IdentityMenu />
        </DropdownMenuContent>
      </DropdownMenu>
    </I18nProvider>
  )

  fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Identity' }), { key: 'ArrowRight' })
  await screen.findByText('Social profiles')
}

describe('Identity menu', () => {
  it('lists a connected identity tool and leaves out a tool that is not about identity', async () => {
    const disposers: (() => void)[] = []

    act(() => {
      disposers.push(
        registry.register({
          area: PROFILE_IDENTITY_AREA,
          data: { detail: '+49 •••• 12', kind: 'phone', label: 'Brain phone' },
          id: 'phone'
        }),
        registry.register({ area: PROFILE_IDENTITY_AREA, data: { kind: 'weather', label: 'Weather' }, id: 'weather' })
      )
    })

    await openIdentity()

    expect(screen.getByText('Brain phone')).toBeTruthy()
    expect(screen.getByText('+49 •••• 12')).toBeTruthy()
    expect(screen.queryByText('Weather')).toBeNull()

    act(() => disposers.forEach(dispose => dispose()))
  })

  it('saves a pasted profile link for this profile and shows it by platform', async () => {
    await openIdentity()

    expect(screen.getByText(/shows up here once you connect one/)).toBeTruthy()

    const field = screen.getByLabelText('Add a profile link')

    fireEvent.change(field, { target: { value: 'instagram.com/cata.lindau' } })
    expect(screen.getByText('Instagram · @cata.lindau')).toBeTruthy()
    fireEvent.keyDown(field, { key: 'Enter' })

    expect(Object.values($identityLinks.get())).toEqual([['https://instagram.com/cata.lindau']])
    expect(await screen.findByText('@cata.lindau')).toBeTruthy()

    fireEvent.change(field, { target: { value: 'javascript:alert(1)' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(screen.getByText('That is not a web link')).toBeTruthy()
  })
})
