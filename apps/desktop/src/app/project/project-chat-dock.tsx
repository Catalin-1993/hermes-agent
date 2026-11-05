/**
 * What a chat in a project adds to the chat surface: a slim project bar (the project's name, a touch larger than a
 * chat title, and the one Project hub button) and the hub panel it opens. Chats outside a named project show
 * nothing. Also keeps the composer's "+" menu offering your agents.
 */

import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { $projectHubOpen, setProjectHubOpen } from '@/store/project-hub'
import { $projectTree, projectIdForCwd } from '@/store/projects'

import { AgentMenuRows } from './agent-menu-rows'
import { PROJECT } from './copy'
import { ProjectHub } from './project-hub'

export function ProjectChatDock({ cwd }: { cwd: string }) {
  const tree = useStore($projectTree)
  const open = useStore($projectHubOpen)
  const id = projectIdForCwd(cwd || '')
  const project = tree.find(node => node.id === id)
  const named = project && !project.isAuto && !project.isNoProject ? project : null
  const color = named?.color || 'var(--ui-text-secondary)'

  return (
    <>
      <AgentMenuRows />
      {named && (
        <div className="relative z-10 shrink-0" data-project-bar={named.id}>
          <div className="flex h-11 items-center gap-2.5 border-b border-(--ui-stroke-tertiary) px-4">
            <span
              className="grid size-6 shrink-0 place-items-center rounded-md"
              style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
            >
              <Codicon name={named.icon || 'folder-library'} size="0.9rem" />
            </span>
            <h1 className="min-w-0 flex-1 truncate text-[1.0625rem] font-semibold tracking-tight text-foreground">
              {named.label}
            </h1>
            <Button aria-pressed={open} onClick={() => setProjectHubOpen(!open)} size="sm" variant="outline">
              <Codicon name="layout-sidebar-right" size="0.8125rem" />
              {PROJECT.hub}
            </Button>
          </div>
          {open && <ProjectHub project={named} />}
        </div>
      )}
    </>
  )
}
