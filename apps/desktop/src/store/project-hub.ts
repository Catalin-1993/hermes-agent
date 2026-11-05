import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

const KEY = 'hermes.desktop.project.hub'

/** Whether the project hub (instructions, connectors, knowledge, team) is open beside a project's chat. */
export const $projectHubOpen = atom(storedBoolean(KEY, false))

export function setProjectHubOpen(open: boolean): void {
  persistBoolean(KEY, open)
  $projectHubOpen.set(open)
}
