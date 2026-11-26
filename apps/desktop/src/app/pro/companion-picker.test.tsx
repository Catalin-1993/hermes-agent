/** Brain (Pro Mode): a pet picked in the panel stays in the panel — the app's pet is never switched from here. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { $petGallery, $petGalleryStatus } from '@/store/pet-gallery'
import { $proAvatar, $proPet } from '@/store/pro-avatar'

const requestGateway = vi.fn(async () => ({}))

vi.mock('@/app/gateway/hooks/use-gateway-request', () => ({ useGatewayRequest: () => ({ requestGateway }) }))

const { CompanionPicker } = await import('./companion-picker')

afterEach(() => {
  cleanup()
  requestGateway.mockClear()
  $proPet.set(null)
  $proAvatar.set('')
})

describe('CompanionPicker', () => {
  it('keeps a picked pet for the panel only', () => {
    $petGallery.set({ active: 'corgi', enabled: true, pets: [{ displayName: 'Owl', installed: true, slug: 'owl' }] })
    $petGalleryStatus.set('ready')
    const onDone = vi.fn()

    render(
      <I18nProvider configClient={null} initialLocale="en">
        <CompanionPicker current="brain" onDone={onDone} photo={null} />
      </I18nProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Owl' }))

    expect($proPet.get()?.slug).toBe('owl')
    expect($proAvatar.get()).toBe('pet')
    expect(onDone).toHaveBeenCalledOnce()
    expect(requestGateway.mock.calls.some(call => (call as unknown[])[0] === 'pet.select')).toBe(false)
  })
})
