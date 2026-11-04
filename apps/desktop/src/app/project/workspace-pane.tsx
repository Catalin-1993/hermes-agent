/**
 * The right sidebar's Workspace view: what belongs to the project you are working in — its Instructions, Connectors
 * and Knowledge, each folded to its title until you open it. The project is the one the project page named, else the
 * one the focused chat's folder belongs to.
 */

import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { $projectTree, projectIdForCwd, projectRootCwd } from '@/store/projects'
import { $focusedWorkspaceCwd } from '@/store/session-states'
import { $workspacePanel, $workspaceProjectId } from '@/store/workspace-panel'

import { SidebarPanelLabel } from '../shell/sidebar-label'

import { PROJECT } from './copy'
import { WorkspaceSections } from './workspace-sections'

export function WorkspacePane() {
  const cwd = useStore($focusedWorkspaceCwd)
  const named = useStore($workspaceProjectId)
  const tree = useStore($projectTree)
  const project = tree.find(node => node.id === (named ?? projectIdForCwd(cwd || '')))
  const folder = project ? projectRootCwd(project) || null : null

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-workspace-pane="">
      <div className="group/project-header flex h-7 shrink-0 items-center gap-1 px-2.5">
        <SidebarPanelLabel className="min-w-0 flex-1">{project ? project.label : PROJECT.workspace}</SidebarPanelLabel>
        <Tip label={PROJECT.files}>
          <Button
            aria-label={PROJECT.files}
            className={cn('text-sidebar-foreground/70')}
            onClick={() => $workspacePanel.set(false)}
            size="icon-xs"
            variant="ghost"
          >
            <Codicon name="files" size="0.8125rem" />
          </Button>
        </Tip>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {project ? (
          <WorkspaceSections folder={folder} />
        ) : (
          <p className="px-4 py-6 text-center text-[0.8125rem] text-(--ui-text-tertiary)">{PROJECT.notAProject}</p>
        )}
      </div>
    </div>
  )
}
