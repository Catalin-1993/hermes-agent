/**
 * The Dashboard: the Kanban Overview lifted from one board to all of them. It answers, in order, what is
 * happening across projects, what needs the owner, how each project stands, who is working on what, and what
 * just happened. Every number comes from the boards' own data; one the API cannot give shows "not available".
 */

import { Loader } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'

import { BRAIN } from './brain-copy'
import { openKanban, openProject, useProjects } from './brain-data'
import {
  agentsAcross,
  attentionAcross,
  feedAcross,
  isActive,
  projectName,
  projectStats,
  runTotals
} from './brain-model'
import { AgentChip, AttentionRow, PANEL, ProjectCard } from './brain-ui'
import { Metric, Section } from './overview'
import { columnMeta } from './types'
import { ago, Avatar, useKanban } from './ui'

const FAILURES = new Set(['crashed', 'gave_up', 'timed_out'])

function Summary({ projects }: { projects: ReturnType<typeof useProjects>['projects'] }) {
  const copy = BRAIN.dashboard.summary
  const stats = projects.map(project => projectStats(project.board))
  const loaded = projects.every(project => project.board)
  const runs = runTotals(projects)
  const attention = attentionAcross(projects).length
  const active = stats.filter(isActive).length
  const running = stats.reduce((n, item) => n + item.running.length, 0)
  const value = (n: number) => (loaded ? String(n) : '—')

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric
        hint={copy.activeProjectsHint(projects.length)}
        icon="project"
        label={copy.activeProjects}
        value={value(active)}
      />
      <Metric
        hint={copy.agentsHint}
        icon="organization"
        label={copy.agents}
        tone={columnMeta('running').tone}
        value={value(agentsAcross(projects).length)}
      />
      <Metric hint={copy.inProgressHint} icon="play-circle" label={copy.inProgress} value={value(running)} />
      <Metric
        hint={copy.attentionHint}
        icon="bell-dot"
        label={copy.attention}
        tone={attention ? columnMeta('blocked').tone : undefined}
        value={value(attention)}
      />
      <Metric
        hint={runs ? copy.finishedHint(runs.failed, runs.successRate) : copy.unavailable}
        icon="pass-filled"
        label={copy.finished}
        value={runs ? String(runs.completed) : '—'}
      />
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[0.75rem] text-(--ui-text-quaternary)">{children}</p>
}

export function BrainDashboard() {
  const k = useKanban()
  const copy = BRAIN.dashboard
  const { error, loading, projects } = useProjects()
  const attention = attentionAcross(projects)
  const agents = agentsAcross(projects)
  const feed = feedAcross(projects, 12)

  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader type="lemniscate-bloom" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid h-full place-items-center text-[0.8125rem] text-(--ui-text-tertiary)">{copy.loadFailed}</div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-4 py-4" data-brain-dashboard="">
      <h1 className="text-lg font-semibold text-foreground">{copy.title}</h1>
      <Summary projects={projects} />
      <Section action={attention.length ? String(attention.length) : undefined} title={copy.attention.title}>
        {attention.length ? (
          <ul className="-mx-1.5 flex flex-col">
            {attention.slice(0, 8).map(item => (
              <li key={`${item.project.slug}:${item.task.id}`}>
                <AttentionRow item={item} onOpen={() => openKanban(item.project.slug, 'inbox')} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{copy.attention.empty}</Empty>
        )}
      </Section>
      <section className="flex flex-col gap-2">
        <h3 className="text-[0.6875rem] font-semibold tracking-wide text-(--ui-text-tertiary) uppercase">
          {copy.projects.title}
        </h3>
        {projects.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map(project => (
              <ProjectCard key={project.meta.slug} onOpen={() => openProject(project.meta.slug)} project={project} />
            ))}
          </div>
        ) : (
          <div className={PANEL}>
            <Empty>{copy.projects.empty}</Empty>
          </div>
        )}
      </section>
      <Section title={copy.agents.title}>
        {agents.length ? (
          <ul className="flex flex-col gap-2.5">
            {agents.map(agent => (
              <li key={agent.name}>
                <button
                  className="flex w-full cursor-pointer items-center gap-2.5 text-left"
                  onClick={() => openKanban(agent.running[0]!.project.slug, 'agents')}
                  type="button"
                >
                  <AgentChip name={agent.name} size="1.75rem" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium text-foreground">{agent.name}</span>
                    <span className="block truncate text-[0.6875rem] text-(--ui-text-tertiary)">
                      {agent.running.map(item => item.task.title || item.task.id).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.625rem] text-(--ui-text-quaternary)">
                    {[...new Set(agent.running.map(item => projectName(item.project)))].join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{copy.agents.empty}</Empty>
        )}
      </Section>
      <Section title={copy.recent.title}>
        {feed.length ? (
          <ul className="-mx-1.5 flex flex-col">
            {feed.map(({ event, project }) => (
              <li key={`${project.slug}:${event.id}`}>
                <button
                  className="flex w-full cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-(--chrome-action-hover)"
                  onClick={() => openProject(project.slug)}
                  type="button"
                >
                  <Avatar name={event.actor || project.slug} size="1.25rem" />
                  <span
                    className="min-w-0 flex-1 text-[0.75rem] leading-snug text-(--ui-text-tertiary)"
                    style={FAILURES.has(event.kind) ? { color: '#f87171' } : undefined}
                  >
                    <span className="font-medium text-(--ui-text-secondary)">{event.actor || k.overview.someone}</span>{' '}
                    {k.overview.feed[event.kind as keyof typeof k.overview.feed] ?? event.kind}{' '}
                    <span className="text-foreground">{event.task_title}</span>
                    <span className="text-(--ui-text-quaternary)"> · {projectName(project)}</span>
                  </span>
                  <span className="shrink-0 text-[0.625rem] text-(--ui-text-quaternary)">{ago(event.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{copy.recent.empty}</Empty>
        )}
      </Section>
    </div>
  )
}
