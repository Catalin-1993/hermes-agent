/** What a click on a project's name does: opens a chat in the project's folder (the project bar there holds its hub). */

import { requestFreshSession } from '@/store/profile'
import { $projectTree, projectRootCwd, requestStartWorkSession } from '@/store/projects'

export function startProjectChat(id: string): void {
  const cwd = projectRootCwd($projectTree.get().find(node => node.id === id))

  if (cwd) {
    requestStartWorkSession(cwd, undefined, { openTab: true })
  } else {
    requestFreshSession()
  }
}
