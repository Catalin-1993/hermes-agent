/**
 * The Goals view: what the board's work is for. Each goal shows its progress as a ring (the share of
 * its cards that are done, counting every card created from a linked one), its owner, target date and
 * cards; the owner can hand it to its owner agent to plan, add cards from the board, or mark it
 * achieved. Goals live in the board's DB (`kanban_db_objectives`); workers see the goal their card serves.
 */

import {
  Button,
  cn,
  Codicon,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogTitle,
  host,
  Input,
  SearchField,
  SegmentedControl,
  Textarea,
  useQueryClient,
  useValue
} from '@hermes/plugin-sdk'
import { useState } from 'react'

import {
  $boardSlug,
  boardKeyPrefix,
  deleteGoal,
  goalsKey,
  linkGoalCards,
  planGoal,
  saveGoal,
  useKanbanScope
} from './api'
import { useRoster } from './org-view'
import { primaryGoal } from './project-model'
import { useGoals } from './team-queries'
import { type BoardGoal, columnMeta, type GoalDraft, type KanbanBoard } from './types'
import { Avatar, columnLabel, errText, FIELD_LABEL, type KanbanText, useKanban } from './ui'

const STATUS_TONE: Record<BoardGoal['status'], string> = {
  achieved: '#34d399',
  active: '#60a5fa',
  dropped: 'var(--ui-text-quaternary)'
}

/** A card's dot in a goal: the same colours as the goal's bar (an in-review card stands out). */
const CARD_TONE: Record<string, string> = {
  blocked: '#f87171',
  done: '#34d399',
  review: '#fbbf24',
  running: '#60a5fa'
}

const PARTS = [
  ['done', '#34d399'],
  ['running', '#60a5fa'],
  ['blocked', '#f87171'],
  ['open', 'var(--ui-text-quaternary)']
] as const

/** Whole days from today to `date` (YYYY-MM-DD), local time; negative when past. */
export function daysUntil(date: string, now = new Date()): number {
  const [year, month, day] = date.split('-').map(Number)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return Math.round((new Date(year, month - 1, day).getTime() - today.getTime()) / 86_400_000)
}

export function DueChip({ goal, k }: { goal: BoardGoal; k: KanbanText }) {
  if (!goal.target_date || goal.status !== 'active') {
    return goal.target_date ? <span className="text-(--ui-text-quaternary)">{goal.target_date}</span> : null
  }

  const days = daysUntil(goal.target_date)
  const late = days < 0
  const tone = late ? '#f87171' : days <= 7 ? '#fbbf24' : 'var(--ui-text-tertiary)'

  return (
    <span className="inline-flex items-center gap-1" style={{ color: tone }}>
      <Codicon name="calendar" size="0.75rem" />
      {goal.target_date} · {late ? k.goals.overdue(-days) : days === 0 ? k.goals.dueToday : k.goals.dueIn(days)}
    </span>
  )
}

export function ProgressRing({ goal, size = 64 }: { goal: BoardGoal; size?: number }) {
  const radius = 15
  const circumference = 2 * Math.PI * radius
  const tone = STATUS_TONE[goal.status]

  return (
    <span className="relative grid shrink-0 place-items-center" style={{ height: size, width: size }}>
      <svg aria-hidden className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" fill="none" r={radius} stroke="var(--ui-bg-quaternary)" strokeWidth="3.5" />
        {goal.percent > 0 && (
          <circle
            cx="18"
            cy="18"
            fill="none"
            r={radius}
            stroke={goal.status === 'active' ? '#34d399' : tone}
            strokeDasharray={`${(goal.percent / 100) * circumference} ${circumference}`}
            strokeLinecap="round"
            strokeWidth="3.5"
          />
        )}
      </svg>
      <span className="text-[0.8125rem] font-semibold tabular-nums text-foreground">{goal.percent}%</span>
    </span>
  )
}

/** A goals write with its toast; the answer (the new goal list) replaces the cache. */
function useGoalsWrite() {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const key = goalsKey(scope, useValue($boardSlug))

  return async (write: () => Promise<{ goals: BoardGoal[] }>, done?: string) => {
    try {
      qc.setQueryData(key, { goals: (await write()).goals })

      if (done) {
        host.notify({ kind: 'success', message: done })
      }

      void qc.invalidateQueries({ queryKey: boardKeyPrefix(scope) })

      return true
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })

      return false
    }
  }
}

function GoalEditor({ goal, k, onClose }: { goal?: BoardGoal; k: KanbanText; onClose: () => void }) {
  const write = useGoalsWrite()
  const { data: roster } = useRoster()

  const [draft, setDraft] = useState<GoalDraft>({
    owner: goal?.owner ?? null,
    status: goal?.status ?? 'active',
    target_date: goal?.target_date ?? null,
    title: goal?.title ?? '',
    why: goal?.why ?? ''
  })

  const set = (patch: Partial<GoalDraft>) => setDraft(current => ({ ...current, ...patch }))

  const save = async () => {
    if (await write(() => saveGoal({ ...draft, title: draft.title.trim() }, goal?.id), k.goals.saved)) {
      onClose()
    }
  }

  return (
    <Dialog onOpenChange={open => !open && onClose()} open>
      <DialogContent aria-describedby={undefined} className="w-[min(36rem,94vw)] max-w-none">
        <div className="flex flex-col gap-4 p-5">
          <DialogTitle className="text-base font-semibold">{goal ? k.goals.edit : k.goals.add}</DialogTitle>
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{k.goals.title}</span>
            <Input
              maxLength={120}
              onChange={event => set({ title: event.target.value })}
              placeholder={k.goals.titlePlaceholder}
              value={draft.title}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{k.goals.why}</span>
            <Textarea
              className="min-h-16 text-[0.8125rem]"
              onChange={event => set({ why: event.target.value })}
              placeholder={k.goals.whyPlaceholder}
              value={draft.why}
            />
          </label>
          <section className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{k.goals.owner}</span>
            <div className="flex flex-wrap gap-1.5">
              {(roster?.profiles ?? []).map(profile => (
                <button
                  aria-pressed={draft.owner === profile.name}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-[0.75rem]',
                    draft.owner === profile.name
                      ? 'border-(--ui-text-secondary) bg-(--ui-bg-quaternary) text-foreground'
                      : 'border-(--ui-stroke-tertiary) text-(--ui-text-tertiary) hover:text-foreground'
                  )}
                  key={profile.name}
                  onClick={() => set({ owner: draft.owner === profile.name ? null : profile.name })}
                  type="button"
                >
                  <Avatar name={profile.name} size="1.1rem" />
                  {profile.name}
                </button>
              ))}
            </div>
            <span className="text-[0.6875rem] text-(--ui-text-quaternary)">{k.goals.ownerHint}</span>
          </section>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>{k.goals.target}</span>
              <Input
                className="w-44"
                onChange={event => set({ target_date: event.target.value || null })}
                type="date"
                value={draft.target_date ?? ''}
              />
            </label>
            {goal && (
              <SegmentedControl<BoardGoal['status']>
                onChange={status => set({ status })}
                options={(['active', 'achieved', 'dropped'] as const).map(id => ({ id, label: k.goals.status[id] }))}
                value={draft.status}
              />
            )}
          </div>
          <div className="flex justify-end gap-1.5">
            <Button onClick={onClose} size="sm" variant="ghost">
              {k.goals.cancel}
            </Button>
            <Button disabled={!draft.title.trim()} onClick={() => void save()} size="sm">
              {k.goals.save}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CardPicker({
  board,
  goal,
  k,
  onClose
}: {
  board: KanbanBoard
  goal: BoardGoal
  k: KanbanText
  onClose: () => void
}) {
  const write = useGoalsWrite()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const inGoal = new Set(goal.cards.map(card => card.id))
  const needle = query.trim().toLowerCase()

  const cards = board.columns
    .flatMap(column => column.tasks)
    .filter(task => !inGoal.has(task.id) && task.status !== 'archived')
    .filter(task => !needle || (task.title ?? '').toLowerCase().includes(needle))

  return (
    <Dialog onOpenChange={open => !open && onClose()} open>
      <DialogContent aria-describedby={undefined} className="w-[min(34rem,94vw)] max-w-none">
        <div className="flex max-h-[70vh] flex-col gap-3 p-5">
          <DialogTitle className="text-base font-semibold">{k.goals.addCardsTitle}</DialogTitle>
          <SearchField onChange={setQuery} placeholder={k.goals.search} value={query} />
          <ul className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto">
            {cards.map(task => {
              const on = picked.includes(task.id)

              return (
                <li key={task.id}>
                  <button
                    aria-pressed={on}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[0.8125rem]',
                      on ? 'bg-(--ui-bg-quaternary)' : 'hover:bg-(--ui-bg-quinary)'
                    )}
                    onClick={() => setPicked(on ? picked.filter(id => id !== task.id) : [...picked, task.id])}
                    type="button"
                  >
                    <Codicon
                      className={on ? 'text-foreground' : 'text-(--ui-text-quaternary)'}
                      name={on ? 'pass-filled' : 'circle-large'}
                      size="0.9rem"
                    />
                    <span className="min-w-0 flex-1 truncate text-foreground">{task.title}</span>
                    <span className="shrink-0 text-[0.6875rem]" style={{ color: columnMeta(task.status).tone }}>
                      {columnLabel(k, task.status)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex justify-end gap-1.5">
            <Button onClick={onClose} size="sm" variant="ghost">
              {k.goals.cancel}
            </Button>
            <Button
              disabled={!picked.length}
              onClick={() => void write(() => linkGoalCards(goal.id, picked)).then(ok => ok && onClose())}
              size="sm"
            >
              {k.goals.link(picked.length)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SplitBar({ goal, k }: { goal: BoardGoal; k: KanbanText }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-(--ui-bg-quaternary)">
        {goal.total > 0 &&
          PARTS.map(([key, tone]) => (
            <span key={key} style={{ backgroundColor: tone, width: `${(goal[key] / goal.total) * 100}%` }} />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-3 text-[0.6875rem] text-(--ui-text-tertiary)">
        {PARTS.filter(([key]) => goal[key] > 0).map(([key, tone]) => (
          <span className="inline-flex items-center gap-1" key={key}>
            <span className="size-1.5 rounded-full" style={{ backgroundColor: tone }} />
            {goal[key]} {k.goals.counts[key]}
          </span>
        ))}
      </div>
    </div>
  )
}

function GoalCardView({
  board,
  goal,
  k,
  onOpen
}: {
  board: KanbanBoard
  goal: BoardGoal
  k: KanbanText
  onOpen: (id: string) => void
}) {
  const write = useGoalsWrite()
  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [asking, setAsking] = useState(false)
  const active = goal.status === 'active'
  const planning = goal.cards.some(card => card.created_by === 'goals' && card.status !== 'done')
  const draft = { owner: goal.owner, target_date: goal.target_date, title: goal.title, why: goal.why }

  return (
    <article
      className={cn(
        'flex flex-col gap-3.5 rounded-2xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-5',
        goal.status === 'dropped' && 'opacity-60'
      )}
      data-goal={goal.title}
      style={{
        backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${STATUS_TONE[goal.status]} 7%, transparent), transparent 45%)`
      }}
    >
      <header className="flex items-start gap-3.5">
        <ProgressRing goal={goal} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-[1.0625rem] font-semibold text-foreground">{goal.title}</h3>
            {!active && (
              <span
                className="rounded-full px-1.5 py-px text-[0.625rem] font-medium"
                style={{
                  backgroundColor: `color-mix(in srgb, ${STATUS_TONE[goal.status]} 14%, transparent)`,
                  color: STATUS_TONE[goal.status]
                }}
              >
                {k.goals.status[goal.status]}
              </span>
            )}
          </div>
          {goal.why && <p className="line-clamp-2 text-[0.8125rem] text-(--ui-text-secondary)">{goal.why}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-(--ui-text-tertiary)">
            <span className="inline-flex items-center gap-1">
              {goal.owner ? <Avatar name={goal.owner} size="0.95rem" /> : <Codicon name="person" size="0.75rem" />}
              {goal.owner ?? k.goals.noOwner}
            </span>
            <DueChip goal={goal} k={k} />
            {goal.total > 0 && <span className="tabular-nums">{k.goals.progress(goal.done, goal.total)}</span>}
          </div>
        </div>
      </header>
      {goal.total > 0 && <SplitBar goal={goal} k={k} />}
      <div className="text-[0.6875rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
        {GOALS.steps}
      </div>
      {goal.cards.length ? (
        <ul className="-mx-1.5 -mt-2 flex max-h-56 flex-col overflow-y-auto">
          {goal.cards.map(card => (
            <li className="group flex items-center" key={card.id}>
              <button
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-(--ui-bg-quinary)"
                onClick={() => onOpen(card.id)}
                type="button"
              >
                <Codicon
                  className="shrink-0"
                  name={
                    card.status === 'done' ? 'pass-filled' : CARD_TONE[card.status] ? 'circle-filled' : 'circle-outline'
                  }
                  size="0.85rem"
                  style={{ color: CARD_TONE[card.status] ?? 'var(--ui-text-quaternary)' }}
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[0.8125rem]',
                    card.status === 'done' ? 'text-(--ui-text-tertiary) line-through' : 'text-foreground'
                  )}
                >
                  {card.title}
                </span>
                {GOALS.stepState[card.status as keyof typeof GOALS.stepState] && (
                  <span
                    className="shrink-0 text-[0.6875rem] font-medium"
                    style={{ color: CARD_TONE[card.status] ?? 'var(--ui-text-tertiary)' }}
                  >
                    {GOALS.stepState[card.status as keyof typeof GOALS.stepState]}
                  </span>
                )}
                {card.assignee && <Avatar name={card.assignee} size="1rem" />}
              </button>
              {goal.linked.includes(card.id) && (
                <Button
                  aria-label={k.goals.unlink}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => void write(() => linkGoalCards(null, [card.id]))}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Codicon name="close" size="0.75rem" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.75rem] text-(--ui-text-quaternary)">{k.goals.noCards}</p>
      )}
      <footer className="-mx-1 flex flex-wrap items-center gap-1 border-t border-(--ui-stroke-tertiary) pt-2">
        {active && goal.owner && (
          <Button
            disabled={planning}
            onClick={() => void write(() => planGoal(goal.id), k.goals.planned(goal.owner!))}
            size="sm"
            variant={goal.total ? 'ghost' : 'default'}
          >
            <Codicon name="sparkle" size="0.8rem" />
            {planning ? k.goals.planned(goal.owner) : k.goals.plan(goal.owner)}
          </Button>
        )}
        <Button onClick={() => setPicking(true)} size="sm" variant="ghost">
          <Codicon name="add" size="0.8rem" />
          {k.goals.addCards}
        </Button>
        <Button
          onClick={() =>
            void write(() => saveGoal({ ...draft, status: active ? 'achieved' : 'active' }, goal.id), k.goals.saved)
          }
          size="sm"
          variant="ghost"
        >
          <Codicon name={active ? 'pass-filled' : 'history'} size="0.8rem" />
          {active ? k.goals.markAchieved : k.goals.reopen}
        </Button>
        <span className="ml-auto flex items-center gap-1">
          <Button aria-label={k.goals.edit} onClick={() => setEditing(true)} size="icon-xs" variant="ghost">
            <Codicon name="edit" size="0.8rem" />
          </Button>
          <Button aria-label={k.goals.delete} onClick={() => setAsking(true)} size="icon-xs" variant="ghost">
            <Codicon className="text-destructive" name="trash" size="0.8rem" />
          </Button>
        </span>
      </footer>
      {editing && <GoalEditor goal={goal} k={k} onClose={() => setEditing(false)} />}
      {picking && <CardPicker board={board} goal={goal} k={k} onClose={() => setPicking(false)} />}
      {asking && (
        <ConfirmDialog
          cancelLabel={k.goals.cancel}
          confirmLabel={k.goals.delete}
          description={k.goals.deleteBody}
          destructive
          onClose={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false)
            void write(() => deleteGoal(goal.id), k.goals.deleted)
          }}
          open
          title={k.goals.deleteTitle(goal.title)}
        />
      )}
    </article>
  )
}

export function BoardGoals({ board, onOpen }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const k = useKanban()
  const { data } = useGoals()
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)

  if (!data) {
    return <div className="grid flex-1 place-items-center text-[0.75rem] text-(--ui-text-quaternary)">…</div>
  }

  const open = data.goals.filter(goal => goal.status === 'active')
  const closed = data.goals.filter(goal => goal.status !== 'active')
  const shown = showDone ? [...open, ...closed] : open

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4" data-kanban-goals="">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex max-w-3xl flex-col gap-0.5">
          <h2 className="text-xl font-semibold text-foreground">{GOALS.title}</h2>
          <p className="text-[0.8125rem] text-(--ui-text-secondary)">{GOALS.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {closed.length > 0 && (
            <Button onClick={() => setShowDone(!showDone)} size="sm" variant="ghost">
              {showDone ? GOALS.hideDone : GOALS.showDone(closed.length)}
            </Button>
          )}
          <Button onClick={() => setAdding(true)} size="sm">
            <Codicon name="add" size="0.8rem" />
            {k.goals.add}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {shown.map(goal => (
          <GoalCardView board={board} goal={goal} k={k} key={goal.id} onOpen={onOpen} />
        ))}
        <button
          className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-(--ui-stroke-secondary) p-6 text-center text-(--ui-text-tertiary) transition-colors hover:border-(--ui-text-quaternary) hover:text-foreground"
          onClick={() => setAdding(true)}
          type="button"
        >
          <Codicon name="target" size="1.5rem" />
          <span className="text-[0.9375rem] font-medium text-(--ui-text-secondary)">{GOALS.addTitle}</span>
          <span className="max-w-64 text-[0.75rem]">{data.goals.length ? GOALS.addHint : k.goals.empty}</span>
        </button>
      </div>
      {adding && <GoalEditor k={k} onClose={() => setAdding(false)} />}
    </div>
  )
}

/** The Goals page's own words, beside the shared Kanban ones (English). */
const GOALS = {
  title: 'Goals',
  subtitle: 'What this project is for, and the steps the team takes to get there.',
  steps: 'How we get there',
  stepState: { blocked: 'stuck', review: 'waiting for you', running: 'in progress' },
  showDone: (n: number) => `Show achieved and dropped (${n})`,
  hideDone: 'Hide achieved',
  addTitle: 'Add a goal',
  addHint: 'Say what you want to reach; the team plans the steps.'
}

/** The Overview's goals strip: each active goal's progress at a glance (nothing when there are none). */
export function GoalsStrip({ narrow = false, onShow }: { narrow?: boolean; onShow: () => void }) {
  const k = useKanban()
  const { data } = useGoals()
  // The project header already shows the primary goal; this strip is the others.
  const lead = primaryGoal(data?.goals)?.id
  const active = (data?.goals ?? []).filter(goal => goal.status === 'active' && goal.id !== lead).slice(0, 4)

  if (!active.length) {
    return null
  }

  return (
    <section
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', !narrow && 'xl:grid-cols-4')}
      data-kanban-goals-strip=""
    >
      {active.map(goal => (
        <button
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3 text-left hover:border-(--ui-stroke-secondary)"
          key={goal.id}
          onClick={onShow}
          type="button"
        >
          <ProgressRing goal={goal} size={48} />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.625rem] font-semibold uppercase tracking-wide text-(--ui-text-quaternary)">
              {k.goals.strip}
            </span>
            <span className="block truncate text-[0.8125rem] font-medium text-foreground">{goal.title}</span>
            <span className="block text-[0.6875rem] text-(--ui-text-tertiary)">
              <DueChip goal={goal} k={k} />
            </span>
          </span>
        </button>
      ))}
    </section>
  )
}
