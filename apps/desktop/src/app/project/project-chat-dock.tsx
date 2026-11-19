/**
 * What a chat in a project adds to the chat surface: the project's name and the one Project hub button, and the
 * hub panel it opens. Chats outside a named project show nothing, and neither does a chat still on the project's
 * page (`onPage`), which shows all of that itself. Also keeps the composer's "+" menu offering your agents.
 *
 * The name and the button sit in the window's top row, over the chat's own column: the name just after its tabs,
 * the button at the row's right end, before the window's controls. They live in a portal placed from the live
 * layout (lib/tracked-spot.ts), so the shell's tab strip and titlebar stay untouched. Where the column has no top
 * row to share, they fall back to a slim bar at the top of the chat.
 */

import { useStore } from '@nanostores/react'
import { type CSSProperties, type ReactNode, useRef } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useTrackedSpot } from '@/lib/tracked-spot'
import { $projectHubOpen, setProjectHubOpen } from '@/store/project-hub'
import { $projectTree, projectIdForCwd } from '@/store/projects'

import { AgentMenuRows } from './agent-menu-rows'
import { PROJECT } from './copy'
import { ProjectHub } from './project-hub'

/** The hub button's height (Button size `sm`). */
const HUB_PX = 28
/** Room kept between the name, the tabs before it and the controls after the button. */
const GAP_PX = 12

interface RowSpot {
  height: number
  hubRight: number
  nameLeft: number
  nameMax: number
  top: number
}

const right = (el: Element) => el.getBoundingClientRect().right

/** The chat's column top row (its zone header), minus its tabs and the window's controls over it. */
function rowSpot(anchor: HTMLElement | null): null | RowSpot {
  const zone = anchor?.closest('[data-tree-group]')
  const header = zone?.querySelector<HTMLElement>('[data-panel-header]')
  const row = header?.getBoundingClientRect()

  if (!header || !row || row.height < 24) {
    return null
  }

  const tabs = [...header.querySelectorAll('[role="tab"], [role="tablist"] button')].map(right)
  const nameLeft = Math.max(row.left + GAP_PX, ...tabs.map(edge => edge + GAP_PX))

  // The window's own controls (right sidebar toggle, bell …) float over the row's right end.
  const controls = [...document.querySelectorAll('[data-titlebar-cluster]')]
    .map(el => el.getBoundingClientRect())
    .filter(box => box.width > 0 && box.left > nameLeft && box.left < row.right && box.top < row.bottom)
    .map(box => box.left)

  const end = Math.min(row.right, ...controls) - GAP_PX / 2

  return {
    height: Math.round(row.height),
    hubRight: Math.round(window.innerWidth - end),
    nameLeft: Math.round(nameLeft),
    nameMax: Math.max(0, Math.round(end - nameLeft - 140)),
    top: Math.round(row.top)
  }
}

function ProjectName({ color, icon, label }: { color: string; icon?: null | string; label: string }) {
  return (
    <>
      <span
        className="grid size-6 shrink-0 place-items-center rounded-md"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
      >
        <Codicon name={icon || 'folder-library'} size="0.9rem" />
      </span>
      <h1 className="min-w-0 truncate text-[1.0625rem] font-semibold tracking-tight text-foreground">{label}</h1>
    </>
  )
}

function HubButton({ className, open, style }: { className?: string; open: boolean; style?: CSSProperties }) {
  return (
    <Button
      aria-pressed={open}
      className={[open ? 'ring-1 ring-(--ui-stroke-secondary)' : '', className].filter(Boolean).join(' ')}
      onClick={() => setProjectHubOpen(!open)}
      onPointerDown={event => event.stopPropagation()}
      size="sm"
      style={style}
      variant="secondary"
    >
      <Codicon name="layout-sidebar-right" size="0.8125rem" />
      {PROJECT.hub}
    </Button>
  )
}

interface Named {
  color?: null | string
  icon?: null | string
  id: string
  label: string
}

/** The name and the button: up in the column's top row, or a slim bar at the top of the chat where there is none. */
function ProjectBar({ children, named, open }: { children?: ReactNode; named: Named; open: boolean }) {
  const anchor = useRef<HTMLDivElement>(null)
  const color = named.color || 'var(--ui-text-secondary)'

  const spot = useTrackedSpot(
    () => rowSpot(anchor.current),
    () => [anchor.current?.closest('[data-tree-group]') ?? null]
  )

  return (
    // The hub drops from the top of the chat.
    <div className="relative z-10 shrink-0" data-project-bar={named.id} ref={anchor}>
      {spot
        ? createPortal(
            <>
              <div
                className="fixed z-40 flex items-center gap-2.5 [-webkit-app-region:no-drag]"
                data-project-title=""
                style={{ height: spot.height, left: spot.nameLeft, maxWidth: spot.nameMax, top: spot.top }}
              >
                <ProjectName color={color} icon={named.icon} label={named.label} />
              </div>
              <HubButton
                className="fixed z-40 [-webkit-app-region:no-drag]"
                open={open}
                style={{ right: spot.hubRight, top: spot.top + (spot.height - HUB_PX) / 2 }}
              />
            </>,
            document.body
          )
        : spot === null && (
            <div className="flex h-11 items-center gap-2.5 px-4">
              <ProjectName color={color} icon={named.icon} label={named.label} />
              <span className="flex-1" />
              <HubButton open={open} />
            </div>
          )}
      {children}
    </div>
  )
}

export function ProjectChatDock({ cwd, onPage = false }: { cwd: string; onPage?: boolean }) {
  const tree = useStore($projectTree)
  const open = useStore($projectHubOpen)
  const id = projectIdForCwd(cwd || '')
  const project = tree.find(node => node.id === id)
  const named = project && !project.isAuto && !project.isNoProject ? project : null

  return (
    <>
      <AgentMenuRows />
      {named && !onPage && (
        <ProjectBar named={named} open={open}>
          {open && <ProjectHub project={named} />}
        </ProjectBar>
      )}
    </>
  )
}
