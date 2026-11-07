/**
 * The Projects header's options button, in the same place and with the same look as the Sessions header's filter
 * (always visible, dimmed until hovered): new project, open a folder as a project, fold or unfold every project,
 * and the projects settings. Every item is an action the app already has.
 */

import { useStore } from '@nanostores/react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $sidebarWorkspaceNodeOpen, setWorkspaceNodesOpen } from '@/store/layout'
import { openFolderAsProject, openProjectCreate } from '@/store/projects'

import { SIDEBAR_HEADER_NAV_BTN } from '../chrome'

const PROJECT_SETTINGS = '/settings?tab=config:workspace'

export function ProjectsHeaderMenu({ projectIds }: { projectIds: readonly string[] }) {
  const { t } = useI18n()
  const p = t.sidebar.projects
  const navigate = useNavigate()
  const nodeOpen = useStore($sidebarWorkspaceNodeOpen)
  // Project rows default open, so "all collapsed" means every one has been explicitly shut.
  const allCollapsed = projectIds.length > 0 && projectIds.every(id => nodeOpen[id] === false)

  return (
    <DropdownMenu>
      <Tip label={p.options}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={p.options}
            className={cn(
              SIDEBAR_HEADER_NAV_BTN,
              'data-[state=open]:bg-(--ui-control-active-background) data-[state=open]:text-foreground data-[state=open]:opacity-100'
            )}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <Codicon name="list-filter" size="0.75rem" />
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuItem onSelect={openProjectCreate}>{p.newButton}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void openFolderAsProject()}>{t.commandCenter.openFolder}</DropdownMenuItem>
        {projectIds.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setWorkspaceNodesOpen(projectIds, allCollapsed)}>
              {allCollapsed ? t.sidebar.filter.expandAll : t.sidebar.filter.collapseAll}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(PROJECT_SETTINGS)}>{p.settings}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
