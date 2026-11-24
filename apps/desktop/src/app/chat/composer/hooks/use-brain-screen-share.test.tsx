/** Brain: "Share screenshot" lands in the composer the person is looking at, once, and only when one took it. */
import { cleanup, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { shareScreenWithBrain } from '@/store/brain-screen'
import { createComposerAttachmentScope } from '@/store/composer'

import type { BrainScreenApi } from '../../../../../electron/brain-screen-types'
import { markActiveComposer } from '../focus'
import { ComposerScopeProvider, ComposerSurfaceProvider, MAIN_COMPOSER_SCOPE } from '../scope'

import { useComposerScreenshot } from './use-composer-screenshot'

const capture = vi.fn<BrainScreenApi['capture']>()

function mount(target: string, surfaceId: string, onAttach: (blob: Blob) => Promise<boolean>) {
  const scope = { ...MAIN_COMPOSER_SCOPE, target, attachments: createComposerAttachmentScope() }

  const Wrapper = ({ children }: PropsWithChildren) => (
    <I18nProvider configClient={null}>
      <ComposerScopeProvider value={scope}>
        <ComposerSurfaceProvider value={surfaceId}>
          <div data-composer-surface-id={surfaceId} data-composer-target={target}>
            {children}
          </div>
        </ComposerSurfaceProvider>
      </ComposerScopeProvider>
    </I18nProvider>
  )

  return renderHook(() => useComposerScreenshot({ sessionKey: 'draft', onAttachImageBlob: onAttach }), {
    wrapper: Wrapper
  })
}

function bridge() {
  window.hermesDesktop = {
    ...window.hermesDesktop,
    brainScreen: {
      capture,
      frame: vi.fn(),
      get: vi.fn(),
      openPermissionSettings: vi.fn(),
      setEnabled: vi.fn()
    } as BrainScreenApi
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  delete window.hermesDesktop.brainScreen
  markActiveComposer('main')
})

describe('Share screenshot', () => {
  it('attaches one picture to the active composer only', async () => {
    bridge()
    capture.mockResolvedValue({ ok: true, png: new Uint8Array([1, 2, 3]) })
    const main = vi.fn(async () => true)
    const tile = vi.fn(async () => true)
    mount('main', 'primary', main)
    mount('tile:second', 'second', tile)
    markActiveComposer('tile:second')

    expect(await shareScreenWithBrain()).toBe('shared')
    expect(main).not.toHaveBeenCalled()
    expect(tile).toHaveBeenCalledOnce()
    expect((tile.mock.calls[0] as unknown as [Blob])[0].type).toBe('image/png')
  })

  it('says so when no chat is open, and attaches nothing when the person declined', async () => {
    bridge()
    capture.mockResolvedValue({ ok: true, png: new Uint8Array([1]) })
    expect(await shareScreenWithBrain()).toBe('no-composer')

    const attach = vi.fn(async () => true)
    mount('main', 'primary', attach)
    capture.mockResolvedValue({ ok: false, reason: 'declined' })
    expect(await shareScreenWithBrain()).toBe('declined')
    expect(attach).not.toHaveBeenCalled()
  })
})
