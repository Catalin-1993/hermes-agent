// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { atom } from 'nanostores'
import { afterEach, expect, it, vi } from 'vitest'

import { ProfileSwitcher } from './profile-dropdown-switcher'

// The account row is the door to switching profiles — its menu must list every profile of the
// active gateway and select through the same store action the rail uses, and carry Settings.

const selectProfile = vi.fn()
const setShowAllProfiles = vi.fn()
const navigate = vi.fn()

vi.mock('react-router', () => ({ useNavigate: () => navigate }))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      sidebar: { nav: { capabilities: 'Capabilities' } },
      titlebar: { openSettings: 'Open settings' },
      profiles: {
        allProfiles: 'All profiles',
        changeName: 'Change name…',
        editProfile: 'Edit profile',
        removePhoto: 'Remove photo',
        changePhoto: 'Change photo…',
        connectGateway: 'Manage gateways…',
        fleet: { onGateway: (name: string, gateway: string) => `${name} · ${gateway}` },
        importProfile: 'Import profile…',
        manageProfiles: 'Manage profiles…',
        personalization: 'Personalization',
        newProfile: 'New profile',
        switchConnectionFailed: (name: string) => `Could not connect to ${name}`,
        title: 'Profiles'
      }
    }
  })
}))

vi.mock('@/store/profile', () => ({
  $activeGatewayProfile: atom('default'),
  $profileColors: atom({}),
  $profileCreateRequest: atom(0),
  $profileOrder: atom([]),
  $profiles: atom([
    { is_default: true, name: 'default' },
    { is_default: false, name: 'clippy' }
  ]),
  $showAllProfiles: atom(false),
  ALL_PROFILES: '__all__',
  normalizeProfileKey: (name: string) => name,
  prewarmProfilePick: vi.fn(),
  profileLabel: (profile: { name: string }) => profile.name,
  refreshActiveProfile: vi.fn().mockResolvedValue(undefined),
  selectProfile: (name: string) => selectProfile(name),
  setShowAllProfiles: (value: boolean) => setShowAllProfiles(value),
  sortByProfileOrder: (profiles: Array<{ name: string }>) => profiles
}))

vi.mock('@/store/connections', () => ({
  $activeConnectionId: atom<null | string>(null),
  $connectionsRegistry: atom(null),
  $hasMultipleConnections: atom(false),
  selectConnection: vi.fn()
}))

vi.mock('@/store/profile-share', () => ({ runImportProfileFlow: vi.fn() }))
vi.mock('./use-profile-prewarm', () => ({
  useProfilePrewarm: () => ({ cancelPrewarm: vi.fn(), startPrewarm: vi.fn() })
}))
vi.mock('./use-fleet-roster', () => ({ useFleetRoster: () => undefined }))
vi.mock('../../profiles/create-profile-dialog', () => ({ CreateProfileDialog: () => null }))

const renameDialog = vi.fn()

vi.mock('../../profiles/rename-profile-dialog', () => ({
  RenameProfileDialog: (props: { currentName: string; isDefault: boolean; open: boolean }) => {
    renameDialog(props)

    return null
  }
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function openMenu() {
  render(<ProfileSwitcher />)

  const trigger = screen.getByRole('button', { name: 'Profiles: Default' })
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await Promise.resolve()
  })
}

it('switches profiles from the account menu', async () => {
  await openMenu()

  const clippy = await screen.findByRole('menuitemradio', { name: /clippy/ })
  await act(async () => {
    fireEvent.click(clippy)
    await Promise.resolve()
  })

  expect(selectProfile).toHaveBeenCalledWith('clippy')
  expect(setShowAllProfiles).not.toHaveBeenCalled()
})

it('reaches the profile and gateway actions by name from the icon row, and no longer opens Settings', async () => {
  await openMenu()

  expect(await screen.findByRole('menuitem', { name: 'Manage gateways…' })).toBeTruthy()
  expect(screen.queryByRole('menuitem', { name: 'Open settings' })).toBeNull()
  expect(screen.queryByRole('menuitem', { name: 'Change photo…' })).toBeNull()

  await act(async () => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Manage gateways…' }))
    await Promise.resolve()
  })

  expect(navigate).toHaveBeenCalledWith('/settings?tab=gateway')
})

it('edits the active profile from a button on its own row: name and photo in a panel of their own', async () => {
  await openMenu()

  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }))
    await Promise.resolve()
  })

  expect(selectProfile).not.toHaveBeenCalled()
  expect(await screen.findByRole('menuitem', { name: 'Change photo…' })).toBeTruthy()

  await act(async () => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Change name…' }))
    await Promise.resolve()
  })

  expect(renameDialog).toHaveBeenLastCalledWith(
    expect.objectContaining({ currentName: 'default', isDefault: true, open: true })
  )
})

it.each([
  ['Capabilities', '/capabilities'],
  ['Personalization', '/profiles']
])('opens %s from the account menu', async (name, route) => {
  await openMenu()

  await act(async () => {
    fireEvent.click(await screen.findByRole('menuitem', { name }))
    await Promise.resolve()
  })

  expect(navigate).toHaveBeenLastCalledWith(route)
})
