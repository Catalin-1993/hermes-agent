/**
 * The Projects start page: every project as a card — its name and what it is about, how far along it is, what is
 * running and what waits on you — with "New project" first. Picking one opens it on its Overview. It is what you
 * see each time you arrive at Projects; the "All projects" button in a project's top bar comes back here.
 */

import { cn, Codicon, Input, useQuery, useValue } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { $boardSlug, $boardView, $projectsHome, boardsKey, fetchBoards, useKanbanScope } from './api'
import { NewBoardDialog } from './board-switcher'
import type { BoardMeta } from './types'

const COPY = {
  title: 'Projects',
  subtitle: 'Pick a project to open it, or start a new one.',
  add: 'New project',
  addHint: 'A board, a team of agents and a goal',
  search: 'Search projects…',
  none: 'No project matches.',
  tasks: (done: number, total: number) => (total ? `${done} of ${total} tasks done` : 'No tasks yet'),
  running: (n: number) => `${n} running`,
  needs: (n: number) => `${n} need you`,
  current: 'Last opened'
}

const TONES = ['#60a5fa', '#34d399', '#a78bfa', '#fbbf24', '#f472b6', '#22d3ee', '#fb923c']

const toneOf = (slug: string) => TONES[[...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0) % TONES.length]!

type Counted = BoardMeta & { counts?: Record<string, number> }

/** Opens a project on its Overview. */
export function openProject(slug: string, current: string) {
  $boardSlug.set(slug === current ? '' : slug)
  $boardView.set('overview')
  $projectsHome.set(false)
}

function ProjectCard({ current, meta, selected }: { current: string; meta: Counted; selected: boolean }) {
  const counts = meta.counts ?? {}
  const total = meta.total ?? 0
  const done = counts.done ?? 0
  const running = counts.running ?? 0
  const needs = (counts.blocked ?? 0) + (counts.review ?? 0)
  const tone = toneOf(meta.slug)

  return (
    <button
      className="kanban-tab group flex min-h-40 cursor-pointer flex-col gap-3 rounded-2xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-4 text-left hover:border-(--ui-stroke-secondary)"
      data-project-card={meta.slug}
      onClick={() => openProject(meta.slug, current)}
      style={{
        backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${tone} 8%, transparent), transparent 60%)`
      }}
      type="button"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: `color-mix(in srgb, ${tone} 18%, transparent)`, color: tone }}
        >
          <Codicon name="folder" size="1.1rem" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1rem] font-semibold text-foreground">{meta.name || meta.slug}</span>
          {selected && <span className="text-[0.6875rem] text-(--ui-text-tertiary)">{COPY.current}</span>}
        </span>
        <Codicon
          className="mt-1 text-(--ui-text-quaternary) transition-transform group-hover:translate-x-0.5"
          name="arrow-right"
          size="0.9rem"
        />
      </div>
      <p className="line-clamp-2 min-h-[2.4em] text-[0.8125rem] leading-snug text-(--ui-text-secondary)">
        {meta.description || meta.project_name || ' '}
      </p>
      <div className="mt-auto flex flex-col gap-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-(--ui-bg-quaternary)">
          <div
            className="h-full rounded-full"
            style={{ backgroundColor: tone, width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-(--ui-text-tertiary)">
          <span className="tabular-nums">{COPY.tasks(done, total)}</span>
          {running > 0 && <span className="text-[#34d399]">{COPY.running(running)}</span>}
          {needs > 0 && <span className="text-[#f87171]">{COPY.needs(needs)}</span>}
        </div>
      </div>
    </button>
  )
}

export function ProjectsHome() {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const { data } = useQuery({ queryFn: fetchBoards, queryKey: boardsKey(scope), staleTime: 15_000 })
  const boards = (data?.boards ?? []) as Counted[]
  const current = data?.current ?? ''
  const needle = query.trim().toLowerCase()

  const shown = boards.filter(
    meta => !needle || `${meta.name} ${meta.slug} ${meta.description}`.toLowerCase().includes(needle)
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-projects-home="">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-8">
        <header className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2.5 text-[1.75rem] font-semibold tracking-tight text-foreground">
              <Codicon className="text-(--ui-text-secondary)" name="folder-library" size="1.5rem" />
              {COPY.title}
              <span className="text-[1.125rem] font-normal tabular-nums text-(--ui-text-tertiary)">
                {boards.length}
              </span>
            </h1>
            <p className="text-[0.875rem] text-(--ui-text-tertiary)">{COPY.subtitle}</p>
          </div>
          <Input
            aria-label={COPY.search}
            className="h-9 w-64 text-[0.8125rem]"
            onChange={event => setQuery(event.target.value)}
            placeholder={COPY.search}
            value={query}
          />
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <button
            className={cn(
              'kanban-tab flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-(--ui-stroke-secondary) p-4 text-center text-(--ui-text-secondary) hover:border-(--ui-text-tertiary) hover:text-foreground'
            )}
            data-project-new=""
            onClick={() => setAdding(true)}
            type="button"
          >
            <span className="grid size-10 place-items-center rounded-full bg-(--ui-bg-tertiary)">
              <Codicon name="add" size="1.1rem" />
            </span>
            <span className="text-[0.9375rem] font-medium">{COPY.add}</span>
            <span className="text-[0.75rem] text-(--ui-text-tertiary)">{COPY.addHint}</span>
          </button>
          {shown.map(meta => (
            <ProjectCard current={current} key={meta.slug} meta={meta} selected={(slug || current) === meta.slug} />
          ))}
        </div>
        {data && !shown.length && needle && <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{COPY.none}</p>}
      </div>
      <NewBoardDialog onClose={() => setAdding(false)} open={adding} />
    </div>
  )
}
