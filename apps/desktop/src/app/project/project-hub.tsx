/**
 * The project hub: a panel at the right of a project's chat with everything that belongs to the project alone —
 * Instructions, Connectors, Knowledge and Team, each folded to its title until you open it. It hangs from the project bar
 * over the chat's right edge, and the project bar's one button opens and closes it.
 */

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { projectRootCwd } from '@/store/projects'

import { PROJECT } from './copy'
import { HubSections } from './hub-sections'

export function ProjectHub({ project }: { project: SidebarProjectTree }) {
  return (
    <aside
      aria-label={PROJECT.hub}
      className="absolute top-full right-0 z-20 flex max-h-[min(34rem,calc(100vh-14rem))] w-80 max-w-[85%] flex-col overflow-y-auto rounded-l-2xl border border-r-0 border-(--ui-stroke-secondary) bg-popover shadow-xl"
      data-project-hub=""
    >
      <HubSections folder={projectRootCwd(project) || null} />
    </aside>
  )
}
