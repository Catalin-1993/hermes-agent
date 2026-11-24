/**
 * Brain (Pro Mode): who stands at the top of the Pro panel, as the person picked it there — kept on this device.
 *
 * - `brain`: the built-in Brain companion (components/pet/brain-pet.tsx).
 * - `pet`: the project's pet (the gateway's active Petdex pet, the same one that floats over the window).
 * - `photo`: the profile's photo, or its initial when there is none.
 * - '' (never picked): the pet when one is on, else the photo, else Brain.
 */

import { persistentAtom } from '@/lib/persisted'

export type ProAvatar = '' | 'brain' | 'pet' | 'photo'

const CHOICES: readonly ProAvatar[] = ['', 'brain', 'pet', 'photo']

export const $proAvatar = persistentAtom<ProAvatar>('hermes.desktop.pro-avatar.v1', '', {
  decode: raw => (CHOICES.includes(raw as ProAvatar) ? (raw as ProAvatar) : ''),
  encode: value => value || null
})

export const setProAvatar = (choice: ProAvatar) => $proAvatar.set(choice)

/** What the header draws for a choice, given what exists right now. */
export function resolveProAvatar(choice: ProAvatar, petOn: boolean, hasPhoto: boolean): 'brain' | 'pet' | 'photo' {
  if (choice === 'pet') {
    return petOn ? 'pet' : 'brain'
  }

  if (choice === 'brain' || choice === 'photo') {
    return choice
  }

  return petOn ? 'pet' : hasPhoto ? 'photo' : 'brain'
}
