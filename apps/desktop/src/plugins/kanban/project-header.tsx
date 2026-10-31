/**
 * The top of the Overview: which project this is, where it stands, and the objective it works toward —
 * the answers to "what am I looking at" before any number. The project is the board; its objective is the
 * active goal due soonest.
 */

import { Button, cn, Codicon, useQuery, useValue } from '@hermes/plugin-sdk'

import { $boardSlug, $boardView, boardsKey, fetchBoards, useKanbanScope } from './api'
import { DueChip, ProgressRing } from './goals-view'
import { PROJECT } from './project-copy'
import { primaryGoal, type ProjectState, summarize } from './project-model'
import { useGoals } from './team-queries'
import type { KanbanBoard } from './types'
import { columnMeta } from './types'
import { useKanban } from './ui'

const STATE_TONE: Record<ProjectState, string> = {
  done: columnMeta('done').tone,
  empty: 'var(--ui-text-quaternary)',
  idle: columnMeta('ready').tone,
  needs: columnMeta('blocked').tone,
  running: columnMeta('running').tone
}

/** The board's name and description, from the boards list (the open board is the selected slug, or the current one). */
function useProjectMeta() {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const { data } = useQuery({ queryFn: fetchBoards, queryKey: boardsKey(scope), staleTime: 30_000 })
  const wanted = slug || data?.current

  return data?.boards.find(board => board.slug === wanted) ?? null
}

function Objective() {
  const k = useKanban()
  const { data } = useGoals()
  const goal = primaryGoal(data?.goals)

  if (!goal) {
    return (
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <Label>{PROJECT.objective}</Label>
        <p className="text-[1rem] font-medium text-foreground">{PROJECT.noObjective}</p>
        <p className="max-w-md text-[0.8125rem] text-(--ui-text-tertiary)">{PROJECT.noObjectiveHint}</p>
        <div>
          <Button onClick={() => $boardView.set('goals')} size="sm" variant="outline">
            <Codicon name="target" size="0.85rem" />
            {PROJECT.setObjective}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-5" data-project-objective="">
      <ProgressRing goal={goal} size={84} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label>{PROJECT.objective}</Label>
        <h2 className="text-[1.125rem] leading-snug font-semibold text-foreground">{goal.title}</h2>
        {goal.why && <p className="line-clamp-2 text-[0.8125rem] text-(--ui-text-secondary)">{goal.why}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-(--ui-text-tertiary)">
          <DueChip goal={goal} k={k} />
          <span>{PROJECT.tasksOfGoal(goal.done, goal.total)}</span>
          <button
            className="cursor-pointer text-(--ui-text-secondary) underline-offset-2 hover:underline"
            onClick={() => $boardView.set('goals')}
            type="button"
          >
            {PROJECT.viewGoals}
          </button>
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: string }) {
  return (
    <span className="text-[0.6875rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
      {children}
    </span>
  )
}

export function ProjectHeader({ board }: { board: KanbanBoard }) {
  const meta = useProjectMeta()
  const { done, state, total } = summarize(board)

  return (
    <section
      className={cn(
        'flex flex-col gap-5 rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-5',
        'lg:flex-row lg:items-stretch lg:gap-8'
      )}
      data-project-header=""
    >
      <div className="flex min-w-0 flex-col gap-2 lg:w-[22rem] lg:shrink-0">
        <Label>{PROJECT.label}</Label>
        <h1 className="truncate text-[1.5rem] leading-tight font-semibold tracking-tight text-foreground">
          {meta?.name?.trim() || meta?.slug || PROJECT.untitled}
        </h1>
        <span className="inline-flex items-center gap-2 text-[0.8125rem] text-(--ui-text-secondary)">
          <span className="size-2 rounded-full" style={{ backgroundColor: STATE_TONE[state] }} />
          {PROJECT.state[state]}
          <span className="text-(--ui-text-quaternary)">·</span>
          <span className="text-(--ui-text-tertiary) tabular-nums">{PROJECT.tasksDone(done, total)}</span>
        </span>
        <div className="h-1.5 w-full max-w-[18rem] overflow-hidden rounded-full bg-(--ui-bg-quaternary)">
          <div
            className="h-full rounded-full"
            style={{
              backgroundColor: STATE_TONE[state === 'needs' ? 'running' : state],
              width: `${total ? (done / total) * 100 : 0}%`
            }}
          />
        </div>
        {meta?.description && (
          <p className="line-clamp-2 text-[0.8125rem] text-(--ui-text-tertiary)">{meta.description}</p>
        )}
      </div>
      <span aria-hidden className="hidden w-px bg-(--ui-stroke-tertiary) lg:block" />
      <Objective />
    </section>
  )
}
