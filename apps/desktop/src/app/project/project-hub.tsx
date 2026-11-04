/**
 * The project hub: a panel of its own beside the project page (not the shell's right sidebar, so the two never open on
 * top of each other) with everything that belongs to this project alone — Instructions, Connectors and Knowledge,
 * each folded to its title until you open it.
 */

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { projectRootCwd } from '@/store/projects'

import { PROJECT } from './copy'
import { HubSections } from './hub-sections'

export function ProjectHub({ onClose, project }: { onClose: () => void; project: SidebarProjectTree }) {
  return (
    <aside
      aria-label={PROJECT.hub}
      className="flex w-full shrink-0 flex-col border-t border-(--ui-stroke-tertiary) bg-(--ui-sidebar-surface-background) lg:w-80 lg:border-t-0 lg:border-l"
      data-project-hub=""
    >
      <div className="flex h-11 shrink-0 items-center gap-1 px-4">
        <h2 className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-foreground">{PROJECT.hub}</h2>
        <Tip label={PROJECT.closeHub}>
          <Button aria-label={PROJECT.closeHub} onClick={onClose} size="icon-xs" variant="ghost">
            <Codicon name="close" size="0.8125rem" />
          </Button>
        </Tip>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <HubSections folder={projectRootCwd(project) || null} projectId={project.id} />
      </div>
    </aside>
  )
}
