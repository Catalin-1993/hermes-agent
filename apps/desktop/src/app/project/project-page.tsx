/**
 * A project's own page (`/project?id=…`): who it is (name, folder, description), a box to start a chat in it, its
 * recent chats (box at the bottom, like a chat), and — in the project hub on the right — what belongs to this project
 * alone (`project-hub`). Opened from a project's name in the sidebar.
 */

import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import type { SidebarProjectTree } from '@/app/chat/sidebar/projects/workspace-groups'
import { composerInputBacking } from '@/components/chat/composer-dock'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Textarea } from '@/components/ui/textarea'
import type { SessionInfo } from '@/hermes'
import { sessionTitle } from '@/lib/chat-runtime'
import { persistBoolean, storedBoolean } from '@/lib/storage'
import { relativeTime } from '@/lib/time'
import { requestFreshSession } from '@/store/profile'
import {
  $projectTree,
  $projectTreeLoading,
  fetchProjectSessions,
  projectRootCwd,
  requestStartWorkSession
} from '@/store/projects'

import { openSessionFromPicker } from '../open-session'

import { PROJECT } from './copy'
import { ProjectHub } from './project-hub'

const SHOWN = 10

/** Every chat of the project, newest first, whatever repo or work tree it ran in. */
function chatsOf(tree: SidebarProjectTree | null | undefined): SessionInfo[] {
  const lanes = tree?.repos.flatMap(repo => repo.groups.flatMap(group => group.sessions)) ?? []
  // Until the project's lanes are read, the few chats the project list already carries.
  const rows = lanes.length ? lanes : (tree?.previewSessions ?? [])
  const seen = new Set<string>()

  return rows
    .filter(row => !seen.has(row.id) && seen.add(row.id))
    .sort((a, b) => (b.last_active ?? 0) - (a.last_active ?? 0))
}

function StartBox({ project }: { project: SidebarProjectTree }) {
  const [draft, setDraft] = useState('')
  const cwd = projectRootCwd(project)

  const start = () => {
    const text = draft.trim()

    if (cwd) {
      requestStartWorkSession(cwd, text || undefined, { openTab: true })
    } else {
      requestFreshSession()
    }

    setDraft('')
  }

  return (
    // The composer's own surface: the same fill, ring, radius and focus ladder (styles.css keys on composer-root).
    <div data-home="" data-slot="composer-root">
      <div className="relative isolate rounded-(--composer-radius) border border-[color-mix(in_srgb,var(--dt-composer-ring)_calc(18%*var(--composer-ring-strength)),var(--dt-input))] focus-within:border-(--dt-composer-ring)">
        <div aria-hidden className={composerInputBacking} />
        <Textarea
          aria-label={PROJECT.startPlaceholder(project.label)}
          className="max-h-40 min-h-16 resize-none border-0 bg-transparent px-4 pt-3 pb-1 text-[0.9375rem] shadow-none focus-visible:ring-0"
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              start()
            }
          }}
          placeholder={PROJECT.startPlaceholder(project.label)}
          value={draft}
        />
        <div className="flex items-center justify-end px-3 pb-2.5">
          <button
            aria-label={PROJECT.newChat}
            className="grid size-7 cursor-pointer place-items-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/90"
            onClick={start}
            type="button"
          >
            <Codicon name="arrow-up" size="0.875rem" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Chats({ project }: { project: SidebarProjectTree }) {
  const navigate = useNavigate()

  const { data } = useQuery({
    queryFn: () => fetchProjectSessions(project.id, { supersedable: false }),
    queryKey: ['project-page', 'chats', project.id],
    staleTime: 15_000
  })

  const rows = chatsOf(data ?? project)

  if (!rows.length) {
    return <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{PROJECT.noChats}</p>
  }

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col divide-y divide-(--ui-stroke-tertiary) overflow-hidden rounded-xl border border-(--ui-stroke-tertiary)">
        {rows.slice(0, SHOWN).map(row => (
          <li key={row.id}>
            <button
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-(--chrome-action-hover)"
              onClick={() => openSessionFromPicker(row.id, navigate)}
              type="button"
            >
              <Codicon className="text-(--ui-text-tertiary)" name="comment" size="0.9rem" />
              <span className="min-w-0 flex-1 truncate text-[0.875rem] text-foreground">{sessionTitle(row)}</span>
              <span className="shrink-0 text-[0.75rem] text-(--ui-text-quaternary)">
                {row.last_active ? relativeTime(row.last_active * 1000) : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {rows.length > SHOWN && (
        <p className="px-1 pt-2 text-[0.75rem] text-(--ui-text-tertiary)">{PROJECT.moreChats(rows.length - SHOWN)}</p>
      )}
    </div>
  )
}

const HUB_KEY = 'hermes.desktop.project.hub'

export function ProjectPage() {
  const [params] = useSearchParams()
  const id = params.get('id') ?? ''
  const tree = useStore($projectTree)
  const loading = useStore($projectTreeLoading)
  const project = tree.find(node => node.id === id)
  const [hub, setHub] = useState(() => storedBoolean(HUB_KEY, true))

  const toggleHub = () => {
    persistBoolean(HUB_KEY, !hub)
    setHub(!hub)
  }

  if (!project) {
    return (
      <div className="grid flex-1 place-items-center text-[0.8125rem] text-(--ui-text-tertiary)">
        {loading || !tree.length ? PROJECT.loading : PROJECT.notFound}
      </div>
    )
  }

  const folder = projectRootCwd(project) || null
  const color = project.color || 'var(--ui-text-secondary)'

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
      data-project-page={project.id}
    >
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-3xl shrink-0 items-start gap-4 px-6 pt-10 pb-4">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-2xl"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
          >
            <Codicon name={project.icon || (project.isAuto ? 'repo' : 'folder-library')} size="1.4rem" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.5rem] font-semibold tracking-tight text-foreground">{project.label}</h1>
            {folder ? (
              <p className="truncate text-[0.8125rem] text-(--ui-text-tertiary)" title={folder}>
                {folder}
              </p>
            ) : (
              <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{PROJECT.noFolder}</p>
            )}
          </div>
          <Button aria-pressed={hub} onClick={toggleHub} size="sm" variant="outline">
            <Codicon name="layout-sidebar-right" size="0.8125rem" />
            {PROJECT.hub}
          </Button>
        </header>
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3 overflow-y-auto px-6 pb-4">
          <h2 className="text-[0.8125rem] font-semibold text-foreground">{PROJECT.chats}</h2>
          <Chats project={project} />
        </div>
        <div className="mx-auto w-full max-w-3xl shrink-0 px-6 pb-6">
          <StartBox project={project} />
        </div>
      </main>
      {hub && <ProjectHub onClose={toggleHub} project={project} />}
    </div>
  )
}
