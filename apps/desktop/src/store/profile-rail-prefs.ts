import { Codecs, persistentAtom } from '@/lib/persisted'
import { modeBound } from '@/store/interface-mode'

// The colored profile strip above the sidebar's account row. The account row is the profile door
// (its menu lists every profile, gateway and agent); the strip is the opt-in extra for people who
// run profiles as bots — drag to reorder, hold to recolor. Off by default; Simple mode keeps it off.
const $profileRailVisiblePref = persistentAtom('hermes.desktop.profileRailVisible', false, Codecs.bool)

export const $profileRailVisible = modeBound('profileRailVisible', $profileRailVisiblePref, value =>
  $profileRailVisiblePref.set(value)
)

export function toggleProfileRailVisible() {
  $profileRailVisible.set(!$profileRailVisible.get())
}
