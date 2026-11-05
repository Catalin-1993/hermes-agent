/**
 * The "Projects" section of the sidebar: the folder projects (with the chats inside each) as a section of their own,
 * above the Sessions list — the same header as Sessions (label and count, caret after them, "+" on the right in the
 * same slot), a touch bolder. It stands in for the single "Projects" ⇄ "Sessions" view the sidebar used to flip
 * between; Sessions below is always the plain list of recent chats. Home (chats that belong to no project) is not a
 * row here: those chats are the Sessions list.
 */

import { type ComponentProps, type ReactNode, useState } from 'react'

import { $newProjectDropPlacement, openProjectCreate } from '@/store/projects'

import { SidebarSectionAddButton } from './chrome'
import type { SidebarProjectTree } from './projects'
import { SidebarSessionsSection } from './sessions-section'

type SectionProps = ComponentProps<typeof SidebarSessionsSection>

type Props = Omit<
  SectionProps,
  | 'collapsible'
  | 'contentClassName'
  | 'emptyState'
  | 'headerAction'
  | 'label'
  | 'labelMeta'
  | 'onToggle'
  | 'open'
  | 'pinned'
  | 'projectOverview'
  | 'rootClassName'
  | 'sessions'
> & {
  label: string
  newLabel: string
  /** A spinner while the repos are still being scanned. */
  scanning?: ReactNode
  projects: SidebarProjectTree[]
}

export function SidebarProjectsSection({ label, newLabel, projects, scanning, ...rest }: Props) {
  const [open, setOpen] = useState(true)
  const real = projects.filter(project => !project.isNoProject)

  return (
    <SidebarSessionsSection
      {...rest}
      collapsible
      // The rows run as long as the list; past a point the list scrolls inside, so Sessions keeps its room.
      contentClassName="flex max-h-[45vh] flex-col gap-px overflow-y-auto pb-1.75"
      emptyState={null}
      headerAction={
        <div className="flex shrink-0 items-center gap-0.5">
          <SidebarSectionAddButton
            ariaLabel={newLabel}
            // Dragging the "+" arms WHERE the project should start; the dialog flow consumes it on create.
            onNewProjectDrag={{ onArm: placement => $newProjectDropPlacement.set(placement) }}
            onPlainClick={openProjectCreate}
          />
          <div className="size-6" />
        </div>
      }
      label={label}
      labelMeta={scanning}
      onToggle={() => setOpen(!open)}
      open={open}
      pinned={false}
      projectOverview={real}
      rootClassName="shrink-0 p-0"
      sessions={[]}
    />
  )
}
