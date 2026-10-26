/**
 * Projects: the list of projects (Kanban boards) with a `+ New Project`, and for the open one an Overview that
 * answers, in order: where it stands and what it is for, how far along it is and what just happened, what is
 * running and who runs it, what waits on the owner, and the way into the Kanban faces (Board, Inbox, Agents,
 * Org chart, Goals, Rules). The faces stay Kanban's own; nothing here is a second copy of them.
 */

import { Button, Codicon, Loader, useValue } from '@hermes/plugin-sdk'
import { type ReactNode, useEffect, useState } from 'react'

import { $boardSlug, type BoardView } from './api'
import { NewBoardDialog } from './board-switcher'
import { BRAIN } from './brain-copy'
import { $newProjectRequest, $projectSlug, openKanban, openProject, useProjectGoals, useProjects } from './brain-data'
import { objectiveOf, type ProjectData, projectName, projectStats } from './brain-model'
import { AgentChip, AttentionRow, PANEL, ProgressBar, ProjectCard, StateBadge } from './brain-ui'
import { Feed, Section, StatusBar } from './overview'
import { ago, useKanban } from './ui'

const FACES: { icon: string; id: BoardView }[] = [
  { icon: 'layout', id: 'board' },
  { icon: 'inbox', id: 'inbox' },
  { icon: 'organization', id: 'agents' },
  { icon: 'type-hierarchy', id: 'org' },
  { icon: 'target', id: 'goals' },
  { icon: 'law', id: 'rules' }
]

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-[0.75rem] text-(--ui-text-quaternary)">{children}</p>
}

function StateAndObjective({ project }: { project: ProjectData }) {
  const copy = BRAIN.projects.overview
  const goals = useProjectGoals(project.meta.slug)
  const objective = objectiveOf(goals)
  const stats = projectStats(project.board)

  return (
    <Section title={copy.state}>
      <div className="flex flex-col gap-2">
        <StateBadge state={stats.state} />
        {project.meta.description && (
          <p className="text-[0.8125rem] text-(--ui-text-secondary)">{project.meta.description}</p>
        )}
        <div className="flex flex-col gap-1 border-t border-(--ui-stroke-tertiary) pt-2">
          <span className="text-[0.6875rem] font-semibold tracking-wide text-(--ui-text-tertiary) uppercase">
            {copy.objective}
          </span>
          {objective ? (
            <>
              <span className="text-[0.875rem] font-medium text-foreground">{objective.title}</span>
              {objective.why && <span className="text-[0.75rem] text-(--ui-text-tertiary)">{objective.why}</span>}
              <ProgressBar percent={objective.percent} />
              <span className="text-[0.6875rem] tabular-nums text-(--ui-text-quaternary)">
                {copy.goalProgress(objective.percent)}
              </span>
            </>
          ) : (
            <span className="text-[0.75rem] text-(--ui-text-quaternary)">
              {goals ? copy.noObjective : '…'}{' '}
              {goals && (
                <button
                  className="cursor-pointer text-(--ui-text-secondary) underline"
                  onClick={() => openKanban(project.meta.slug, 'goals')}
                  type="button"
                >
                  {copy.setObjective}
                </button>
              )}
            </span>
          )}
        </div>
      </div>
    </Section>
  )
}

function Progress({ project }: { project: ProjectData }) {
  const k = useKanban()
  const copy = BRAIN.projects.overview
  const stats = projectStats(project.board)

  return (
    <Section action={`${stats.percent}%`} title={copy.progress}>
      {project.board ? <StatusBar board={project.board} k={k} /> : null}
      <span className="text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)">
        {`${BRAIN.projects.done(stats.done)} · ${BRAIN.projects.tasks(stats.total)}`}
      </span>
      <div className="flex flex-col gap-1 border-t border-(--ui-stroke-tertiary) pt-2">
        <span className="text-[0.6875rem] font-semibold tracking-wide text-(--ui-text-tertiary) uppercase">
          {copy.recent}
        </span>
        {project.activity ? (
          <Feed activity={project.activity} k={k} onOpen={() => openKanban(project.meta.slug, 'board')} />
        ) : null}
      </div>
    </Section>
  )
}

function InProgress({ project }: { project: ProjectData }) {
  const copy = BRAIN.projects.overview
  const { running } = projectStats(project.board)

  return (
    <Section action={running.length ? String(running.length) : undefined} title={copy.inProgress}>
      {running.length ? (
        <ul className="flex flex-col gap-2.5">
          {running.map(task => (
            <li className="flex items-center gap-2.5" key={task.id}>
              {task.assignee ? <AgentChip name={task.assignee} /> : <Codicon name="circle-outline" size="1rem" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] text-foreground">{task.title || task.id}</span>
                <span className="block text-[0.6875rem] text-(--ui-text-tertiary)">{task.assignee ?? '—'}</span>
              </span>
              {ago(task.started_at) && (
                <span className="shrink-0 text-[0.625rem] text-(--ui-text-quaternary)">{ago(task.started_at)}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Muted>{copy.inProgressEmpty}</Muted>
      )}
    </Section>
  )
}

function Attention({ project }: { project: ProjectData }) {
  const k = useKanban()
  const { needs } = projectStats(project.board)

  return (
    <Section action={needs.length ? String(needs.length) : undefined} title={BRAIN.projects.overview.attention}>
      {needs.length ? (
        <ul className="-mx-1.5 flex flex-col">
          {needs.slice(0, 8).map(task => (
            <li key={task.id}>
              <AttentionRow
                item={{ project: project.meta, task }}
                onOpen={() => openKanban(project.meta.slug, 'inbox')}
              />
            </li>
          ))}
        </ul>
      ) : (
        <Muted>{k.overview.needsEmpty}</Muted>
      )}
    </Section>
  )
}

function QuickAccess({ slug }: { slug: string }) {
  const k = useKanban()

  return (
    <Section title={BRAIN.projects.overview.access}>
      <div className="flex flex-wrap gap-2">
        {FACES.map(face => (
          <Button key={face.id} onClick={() => openKanban(slug, face.id)} size="sm" variant="outline">
            <Codicon name={face.icon} size="0.9rem" />
            {BRAIN.projects.access[face.id as keyof typeof BRAIN.projects.access] ?? k.overview.views[face.id]}
          </Button>
        ))}
      </div>
    </Section>
  )
}

export function ProjectOverview({ project }: { project: ProjectData }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2" data-brain-project-overview={project.meta.slug}>
      <StateAndObjective project={project} />
      <Progress project={project} />
      <InProgress project={project} />
      <Attention project={project} />
      <div className="lg:col-span-2">
        <QuickAccess slug={project.meta.slug} />
      </div>
    </div>
  )
}

export function BrainProjects() {
  const copy = BRAIN.projects
  const slug = useValue($projectSlug)
  const { loading, projects } = useProjects()
  const [adding, setAdding] = useState(false)
  const requested = useValue($newProjectRequest)
  const open = projects.find(project => project.meta.slug === slug)

  // "+ New Project" from the sidebar lands here and asks for the dialog.
  useEffect(() => {
    if (requested) {
      $newProjectRequest.set(false)
      setAdding(true)
    }
  }, [requested])

  // The dialog selects the board it creates; open that project once it closes.
  const [before, setBefore] = useState('')

  const closeDialog = () => {
    setAdding(false)

    if ($boardSlug.get() !== before) {
      $projectSlug.set($boardSlug.get())
    }
  }

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader type="lemniscate-bloom" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-4 py-4" data-brain-projects="">
      <header className="flex items-center gap-2">
        {open && (
          <Button aria-label={copy.back} onClick={() => $projectSlug.set('')} size="sm" variant="ghost">
            <Codicon name="arrow-left" size="0.9rem" />
          </Button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
          {open ? projectName(open.meta) : copy.title}
        </h1>
        <Button
          onClick={() => {
            setBefore($boardSlug.get())
            setAdding(true)
          }}
          size="sm"
          variant="outline"
        >
          <Codicon name="add" size="0.9rem" />
          {copy.newProject}
        </Button>
      </header>
      {open ? (
        <ProjectOverview project={open} />
      ) : projects.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map(project => (
            <ProjectCard key={project.meta.slug} onOpen={() => openProject(project.meta.slug)} project={project} />
          ))}
        </div>
      ) : (
        <div className={PANEL}>
          <Muted>{copy.empty}</Muted>
        </div>
      )}
      <NewBoardDialog onClose={closeDialog} open={adding} />
    </div>
  )
}
