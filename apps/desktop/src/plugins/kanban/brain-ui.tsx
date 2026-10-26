/** Pieces the Dashboard and Projects share: the project card, the state dot, a row for something that waits on you. */

import { cn, Codicon } from '@hermes/plugin-sdk'

import { BRAIN } from './brain-copy'
import { type Attention, type ProjectData, projectName, type ProjectState, projectStats } from './brain-model'
import { columnMeta } from './types'
import { ago, Avatar, columnLabel, useKanban } from './ui'

const STATE_TONE: Record<ProjectState, string> = {
  blocked: columnMeta('blocked').tone,
  done: columnMeta('done').tone,
  empty: 'var(--ui-text-quaternary)',
  idle: columnMeta('ready').tone,
  running: columnMeta('running').tone
}

export function StateBadge({ state }: { state: ProjectState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">
      <span className="size-2 rounded-full" style={{ backgroundColor: STATE_TONE[state] }} />
      {BRAIN.projects.state[state]}
    </span>
  )
}

export function ProgressBar({ percent, tone }: { percent: number; tone?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-(--ui-bg-quaternary)">
      <div
        className="h-full rounded-full"
        style={{ backgroundColor: tone ?? STATE_TONE.running, width: `${percent}%` }}
      />
    </div>
  )
}

export const PANEL =
  'flex min-w-0 flex-col gap-3 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3.5'

/** A project as one card: its name, state, progress and the counts that matter. */
export function ProjectCard({ onOpen, project }: { onOpen: () => void; project: ProjectData }) {
  const stats = projectStats(project.board)
  const copy = BRAIN.projects

  return (
    <button
      className={cn(PANEL, 'cursor-pointer gap-2.5 text-left transition-colors hover:bg-(--chrome-action-hover)')}
      data-brain-project={project.meta.slug}
      onClick={onOpen}
      type="button"
    >
      <span className="flex items-center gap-2">
        <Codicon className="text-(--ui-text-tertiary)" name="project" size="0.9rem" />
        <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-foreground">
          {projectName(project.meta)}
        </span>
        <StateBadge state={stats.state} />
      </span>
      <ProgressBar percent={stats.percent} tone={STATE_TONE[stats.state]} />
      <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)">
        <span>{`${stats.percent}% · ${copy.tasks(stats.total)}`}</span>
        {stats.running.length > 0 && (
          <span style={{ color: STATE_TONE.running }}>{copy.running(stats.running.length)}</span>
        )}
        {stats.needs.length > 0 && <span style={{ color: STATE_TONE.blocked }}>{copy.needs(stats.needs.length)}</span>}
      </span>
    </button>
  )
}

/** One thing that waits on the owner, with the project it belongs to. */
export function AttentionRow({ item, onOpen }: { item: Attention; onOpen: () => void }) {
  const k = useKanban()
  const { task } = item

  return (
    <button
      className="flex w-full cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-(--chrome-action-hover)"
      onClick={onOpen}
      type="button"
    >
      <span
        className="mt-1.5 size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: columnMeta(task.status).tone }}
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-[0.8125rem] text-foreground">{task.title || task.id}</span>
        <span className="text-[0.6875rem] text-(--ui-text-tertiary)">
          {projectName(item.project)}
          {' · '}
          {task.status === 'blocked' && task.block_kind ? task.block_kind : columnLabel(k, task.status)}
          {task.assignee && ` · ${task.assignee}`}
        </span>
      </span>
      {ago(task.created_at) && (
        <span className="shrink-0 text-[0.625rem] text-(--ui-text-quaternary)">{ago(task.created_at)}</span>
      )}
    </button>
  )
}

export function AgentChip({ name, size = '1.5rem' }: { name: string; size?: string }) {
  return <Avatar name={name} size={size} />
}
