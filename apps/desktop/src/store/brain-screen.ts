/**
 * Brain: the main agent's screen in the Pro panel — renderer side of electron/brain-screen.ts.
 *
 * - `$brainScreen` mirrors main's opt-in (off until the person turns it on there) and macOS's permission.
 * - `shareScreenWithBrain()` takes one picture and hands it to the composer on screen as an attachment, the way a
 *   pasted image arrives; it is sent only with the next message the person sends. With the live view off, main asks
 *   first. The composer answers through `BRAIN_SCREEN_SHARE_EVENT` (use-brain-screen-share.ts).
 */

import { atom } from 'nanostores'

import type { BrainScreenStatus } from '../../electron/brain-screen-types'

export const BRAIN_SCREEN_SHARE_EVENT = 'hermes:brain-screen-share'

export interface BrainScreenShareDetail {
  blob: Blob
  /** Set by the composer that took it. */
  taken: boolean
}

export type ShareOutcome = 'declined' | 'no-composer' | 'permission' | 'shared' | 'unavailable'

export const $brainScreen = atom<BrainScreenStatus | null>(null)

const api = () => (typeof window === 'undefined' ? undefined : window.hermesDesktop?.brainScreen)

export const brainScreenAvailable = () => Boolean(api())

export async function refreshBrainScreen(): Promise<void> {
  const bridge = api()

  if (bridge) {
    $brainScreen.set(await bridge.get())
  }
}

export async function setBrainScreenEnabled(enabled: boolean): Promise<void> {
  const bridge = api()

  if (bridge) {
    $brainScreen.set(await bridge.setEnabled(enabled))
  }
}

export const openBrainScreenPermission = () => api()?.openPermissionSettings()

/** One small frame of the screen for the live view, or null while it is off or cannot be read. */
export async function brainScreenFrame(): Promise<null | string> {
  const frame = await api()?.frame()

  if (frame && !frame.ok && frame.reason === 'permission') {
    void refreshBrainScreen()
  }

  return frame?.ok ? frame.dataUrl : null
}

export async function shareScreenWithBrain(): Promise<ShareOutcome> {
  const bridge = api()

  if (!bridge) {
    return 'unavailable'
  }

  const shot = await bridge.capture()

  if (!shot.ok) {
    return shot.reason
  }

  const detail: BrainScreenShareDetail = {
    blob: new Blob([new Uint8Array(shot.png)], { type: 'image/png' }),
    taken: false
  }

  window.dispatchEvent(new CustomEvent<BrainScreenShareDetail>(BRAIN_SCREEN_SHARE_EVENT, { detail }))

  return detail.taken ? 'shared' : 'no-composer'
}
