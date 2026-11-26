/**
 * Brain (Pro Mode): who stands at the top of the Pro panel, as the person picked it there — kept on this device
 * and shown ONLY in the panel. Picking here never touches the app's pet (Settings → Appearance → Pet keeps owning
 * the pet that floats over the window).
 *
 * - `brain`: the built-in Brain companion (components/pet/brain-pet.tsx).
 * - `pet`: one of the project's pets, by slug (`$proPet`).
 * - `photo`: the profile's photo, or its initial when there is none.
 * - '' (never picked): the photo when there is one, else Brain.
 */

import { Codecs, persistentAtom } from '@/lib/persisted'

export type ProAvatar = '' | 'brain' | 'pet' | 'photo'

const CHOICES: readonly ProAvatar[] = ['', 'brain', 'pet', 'photo']

export const $proAvatar = persistentAtom<ProAvatar>('hermes.desktop.pro-avatar.v1', '', {
  decode: raw => (CHOICES.includes(raw as ProAvatar) ? (raw as ProAvatar) : ''),
  encode: value => value || null
})

/** The pet picked for the panel: its slug, and its gallery sheet url for the preview frame. */
export interface ProPet {
  slug: string
  url: string
}

export const $proPet = persistentAtom<null | ProPet>(
  'hermes.desktop.pro-avatar.pet.v1',
  null,
  Codecs.json<null | ProPet>(value =>
    value && typeof value === 'object' && typeof (value as ProPet).slug === 'string'
      ? { slug: (value as ProPet).slug, url: String((value as ProPet).url ?? '') }
      : null
  )
)

export const setProAvatar = (choice: ProAvatar) => $proAvatar.set(choice)

export function setProPet(pet: ProPet) {
  $proPet.set(pet)
  $proAvatar.set('pet')
}

/** What the header draws for a choice, given what exists right now. */
export function resolveProAvatar(choice: ProAvatar, hasPet: boolean, hasPhoto: boolean): 'brain' | 'pet' | 'photo' {
  if (choice === 'pet') {
    return hasPet ? 'pet' : 'brain'
  }

  if (choice === 'brain' || choice === 'photo') {
    return choice
  }

  return hasPhoto ? 'photo' : 'brain'
}
