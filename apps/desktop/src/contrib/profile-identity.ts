/**
 * Brain: the profile menu's Identity section — the one place a plugin, connector or tool shows what it gives the
 * agent to be reachable as a person: a phone number, an email address, a postal address, a wallet, a social account.
 *
 * A plugin registers a data contribution on `PROFILE_IDENTITY_AREA`; the section lists it only when its `kind` is one
 * of `PROFILE_IDENTITY_KINDS`, so nothing unrelated lands there. Rows show what the plugin chooses to show — keep
 * secrets (full numbers, keys, seed phrases) in the plugin's own store and give a masked `detail` here.
 */

export const PROFILE_IDENTITY_AREA = 'profile.identity'

export const PROFILE_IDENTITY_KINDS = ['phone', 'email', 'address', 'wallet', 'social'] as const

export type ProfileIdentityKind = (typeof PROFILE_IDENTITY_KINDS)[number]

/** Payload of a `PROFILE_IDENTITY_AREA` data contribution. */
export interface ProfileIdentityContribution {
  /** A short, already-masked hint: `+49 •••• 12`, `cata@…`, `2 addresses`. */
  detail?: string
  /** Codicon name; defaults to the kind's own icon. */
  icon?: string
  kind: ProfileIdentityKind
  label: string
  /** What a click does — usually opens the plugin's own settings. */
  run?: () => void
}

export const PROFILE_IDENTITY_ICONS: Record<ProfileIdentityKind, string> = {
  address: 'home',
  email: 'mail',
  phone: 'device-mobile',
  social: 'mention',
  wallet: 'credit-card'
}

export function isProfileIdentityContribution(data: unknown): data is ProfileIdentityContribution {
  const row = data as Partial<ProfileIdentityContribution> | null

  return Boolean(
    row &&
    typeof row.label === 'string' &&
    row.label.trim() &&
    (PROFILE_IDENTITY_KINDS as readonly string[]).includes(String(row.kind))
  )
}
