import { atom } from 'nanostores'

/** Where the sidebar draws its messaging sources (API, Telegram, …) in the status bar: the bar's slot while
 *  it shows, null while it is hidden — the sources then stay at the sidebar's foot. */
export const $messagingDockSlot = atom<HTMLElement | null>(null)

/** How many messaging sources there are, so the status bar keeps no empty slot. Set by the sidebar. */
export const $messagingSourceCount = atom(0)
