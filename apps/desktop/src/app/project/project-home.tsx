/**
 * A project's page: what an empty chat in the project shows. The project's name and dates in the top-left corner, its
 * recent conversations under them and, beside them, the project's cards; the chat's own composer stays at the bottom,
 * so writing there starts a new conversation in the project.
 */

import { useStore } from '@nanostores/react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { type ComposerTarget, requestComposerInsert } from '@/app/chat/composer/focus'
import { latestProjectSessions } from '@/app/chat/sidebar/projects/model'
import { sessionRecency, type SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { useEnteredProjectSessions } from '@/app/chat/sidebar/use-entered-project-sessions'
import { Codicon } from '@/components/ui/codicon'
import { sessionTitle } from '@/lib/chat-runtime'
import { $activeGatewayProfile, $profiles, profileLabel } from '@/store/profile'
import { $projectTree, projectIdForCwd, projectRootCwd } from '@/store/projects'
import { $companionChats } from '@/store/side-chat'
import { isAuxiliaryWindow } from '@/store/windows'

import { openSession } from '../open-session'

import { PROJECT } from './copy'
import { ProjectCards } from './project-cards'

const H = PROJECT.home

/** The project an empty chat should show as its page, if any: a named project, in a chat that has no messages and is
 *  not still loading them. A chat beside a page is too narrow for it and is about that page. */
export function useProjectPage(input: {
  cwd: string
  loading: boolean
  messagesEmpty: boolean
  routeMismatch: boolean
  storedSessionId: null | string
}): null | SidebarProjectTree {
  const tree = useStore($projectTree)
  const companions = useStore($companionChats)
  const empty = input.messagesEmpty && !input.loading && !input.routeMismatch && !isAuxiliaryWindow()

  if (!empty || (input.storedSessionId && companions.includes(input.storedSessionId))) {
    return null
  }

  const id = projectIdForCwd(input.cwd || '')
  const project = tree.find(node => node.id === id)

  return project && !project.isAuto && !project.isNoProject ? project : null
}

const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** A time today, a date before that. */
export function recentStamp(seconds: number, now = new Date()): string {
  const when = new Date(seconds * 1000)

  return when.toDateString() === now.toDateString() ? timeFormat.format(when) : dayFormat.format(when)
}

function useCreatorName(): null | string {
  const profiles = useStore($profiles)
  const active = useStore($activeGatewayProfile)
  const profile = profiles.find(entry => entry.name === active)

  return profile && (!profile.is_default || profile.display_name?.trim()) ? profileLabel(profile) : null
}

function ProjectHead({ project }: { project: SidebarProjectTree }) {
  const created = useCreatorName()
  const color = project.color || undefined

  const facts = [
    created && H.createdBy(created),
    project.lastActive && H.updated(dayFormat.format(project.lastActive * 1000))
  ]

  return (
    <header className="flex items-center gap-3.5" data-project-head={project.id}>
      <span
        className="grid size-12 shrink-0 place-items-center rounded-xl bg-(--chrome-action-hover) text-(--ui-text-secondary)"
        style={color ? { backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color } : undefined}
      >
        <Codicon name={project.icon || 'folder'} size="1.25rem" />
      </span>
      <div className="min-w-0">
        <h1 className="truncate text-[1.25rem] font-semibold tracking-tight text-foreground">{project.label}</h1>
        <p className="truncate text-[0.75rem] text-(--ui-text-tertiary)">{facts.filter(Boolean).join(' · ')}</p>
      </div>
    </header>
  )
}

function RecentList({ project, storedSessionId }: { project: SidebarProjectTree; storedSessionId: null | string }) {
  const navigate = useNavigate()
  const tree = useStore($projectTree)
  const loaded = useEnteredProjectSessions(project.id, true, tree, 'project-page').project

  const source = loaded
    ? latestProjectSessions(loaded, 30)
    : (project.previewSessions ?? latestProjectSessions(project, 30))

  const rows = source.filter(session => session.id !== storedSessionId && (session.message_count ?? 1) > 0)

  return (
    <section className="mt-7">
      <h2 className="text-[0.8125rem] text-(--ui-text-tertiary)">{H.recent}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-[0.8125rem] text-(--ui-text-tertiary)">{H.noRecent}</p>
      ) : (
        <ul className="mt-1.5 flex flex-col">
          {rows.map(session => (
            <li className="border-b border-(--ui-stroke-tertiary)" key={session.id}>
              <button
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-1 py-2.5 text-left transition-colors hover:bg-(--chrome-action-hover)"
                onClick={() => openSession(session.id, navigate)}
                type="button"
              >
                <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="comment-discussion" size="0.875rem" />
                <span className="min-w-0 flex-1 truncate text-[0.875rem] text-foreground">{sessionTitle(session)}</span>
                <span className="shrink-0 text-[0.75rem] text-(--ui-text-tertiary)">
                  {recentStamp(sessionRecency(session))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** The left of the page, over the empty thread and under the composer. */
export function ProjectHome({
  project,
  storedSessionId
}: {
  project: null | SidebarProjectTree
  storedSessionId: null | string
}) {
  if (!project) {
    return null
  }

  return (
    <div
      className="absolute inset-0 z-10 overflow-y-auto bg-(--ui-chat-surface-background)"
      data-project-home={project.id}
      style={{ paddingBottom: 'calc(var(--composer-measured-height, 8rem) + 1rem)' }}
    >
      <div className="mx-auto w-full max-w-(--composer-width) px-6 pt-7">
        <ProjectHead project={project} />
        <RecentList project={project} storedSessionId={storedSessionId} />
      </div>
    </div>
  )
}

/** Holds the chat's thread and composer, with the project's cards at their right on a project's page. Always the same
 *  two boxes, so the thread and the composer are never remounted when a chat stops being empty. */
export function ProjectPageFrame({
  children,
  composerTarget,
  project
}: {
  children: ReactNode
  composerTarget: ComposerTarget
  project: null | SidebarProjectTree
}) {
  return (
    <div className="@container/project flex min-h-0 max-w-full flex-1">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      {project && (
        <aside
          aria-label={PROJECT.hub}
          className="hidden w-84 shrink-0 overflow-y-auto pt-5 pr-4 pb-4 @[50rem]/project:block"
          data-project-rail={project.id}
        >
          <ProjectCards
            folder={projectRootCwd(project) || null}
            onDraft={draft => requestComposerInsert(draft, { target: composerTarget })}
          />
        </aside>
      )}
    </div>
  )
}
