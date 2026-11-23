import { Codecs, persistentAtom } from '@/lib/persisted'
import { parseSocialLink } from '@/lib/social-links'

/**
 * Brain: the social profile links per profile, for the profile menu's Identity section. Kept on this device like the
 * profile photo (profile-avatars.ts): public links a person chose to list, never credentials.
 */

const MAX_LINKS = 20

const sanitize = (value: unknown): Record<string, string[]> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([profile, links]) => [
          profile,
          Array.isArray(links) ? links.filter((link): link is string => typeof link === 'string') : []
        ])
      )
    : {}

export const $identityLinks = persistentAtom<Record<string, string[]>>(
  'hermes.desktop.identity-links.v1',
  {},
  Codecs.json(sanitize)
)

/** Save `input` for `profile`; false when it is not a web link (or already listed). */
export function addIdentityLink(profile: string, input: string): boolean {
  const link = parseSocialLink(input)
  const current = $identityLinks.get()[profile] ?? []

  if (!link || current.includes(link.url) || current.length >= MAX_LINKS) {
    return false
  }

  $identityLinks.set({ ...$identityLinks.get(), [profile]: [...current, link.url] })

  return true
}

export function removeIdentityLink(profile: string, url: string): void {
  const all = $identityLinks.get()
  const next = (all[profile] ?? []).filter(link => link !== url)

  $identityLinks.set({ ...all, [profile]: next })
}
