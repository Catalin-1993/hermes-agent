import { atom } from 'nanostores'

import { setFileBrowserOpen } from '@/store/layout'

/** The right sidebar shows the project's Workspace (instructions, connectors, knowledge) instead of its files. */
export const $workspacePanel = atom(false)

/** The project whose workspace is shown, when a page (the project's own) names one; else the focused chat's project. */
export const $workspaceProjectId = atom<null | string>(null)

/** Opens the right sidebar on the Workspace, for `projectId` when given. */
export function openWorkspacePanel(projectId?: string) {
  if (projectId) {
    $workspaceProjectId.set(projectId)
  }

  $workspacePanel.set(true)
  setFileBrowserOpen(true)
}
