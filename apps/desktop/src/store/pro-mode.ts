import { useStore } from '@nanostores/react'

import { Codecs, persistentAtom } from '@/lib/persisted'

/**
 * Brain: Pro Mode — one switch (Settings, at the foot of the left rail) for everything Brain adds on top of the
 * community app. On: the + menu tiles and jobs, the model menu's Context / Usage, Identity in the profile menu and
 * the Pro panel on the right (Board · Screen · Changes · Context). Off: those surfaces render as the original app.
 * Bug fixes are not features and stay in both modes. On by default, so an update changes nothing for the person.
 */
export const $proMode = persistentAtom<boolean>('hermes.desktop.pro-mode.v1', true, Codecs.bool)

export function setProMode(on: boolean): void {
  $proMode.set(on)
}

export const useProMode = (): boolean => useStore($proMode)
