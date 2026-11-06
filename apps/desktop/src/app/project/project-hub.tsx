/**
 * The project hub: in a chat that has begun, the same cards a project's page shows beside it, hanging from the project
 * bar over the chat's right edge. The project bar's one button opens and closes it.
 */

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { projectRootCwd } from '@/store/projects'

import { PROJECT } from './copy'
import { ProjectCards } from './project-cards'
import { startProjectDraft } from './start-chat'

export function ProjectHub({ project }: { project: SidebarProjectTree }) {
  const folder = projectRootCwd(project) || null

  return (
    <aside
      aria-label={PROJECT.hub}
      className="absolute top-full right-0 z-20 flex max-h-[min(40rem,calc(100vh-10rem))] w-88 max-w-[90%] flex-col overflow-y-auto rounded-l-2xl border border-r-0 border-(--ui-stroke-secondary) bg-popover p-3 shadow-xl"
      data-project-hub=""
    >
      <ProjectCards folder={folder} onDraft={draft => startProjectDraft(folder, draft)} />
    </aside>
  )
}
