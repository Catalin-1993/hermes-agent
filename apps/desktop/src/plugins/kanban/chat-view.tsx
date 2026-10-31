/**
 * Chat: the project's conversations, the way a team talks. Each task is a conversation — the agent's updates and
 * questions (its comments), what happened to the task (short grey lines), and what you wrote back; "Team" shows
 * every conversation at once. What you send goes to the task as a comment, which the agent reads before it carries
 * on. A task waiting on you says so at the top, with the way to answer it.
 */

import {
  Button,
  cn,
  Codicon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useQueries,
  useQueryClient,
  useValue
} from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'

import { $boardSlug, $boardView, addComment, fetchTask, taskKey, useKanbanScope } from './api'
import { CHAT } from './chat-copy'
import { type ChatLine, lastMessage, teamFeed, threadLines } from './chat-model'
import { $inboxFocus } from './inbox-card'
import { columnMeta, type KanbanBoard, type KanbanTask } from './types'
import { ago, Avatar, columnLabel, errText, useKanban } from './ui'

const TEAM = '__team__'
const ACTIVE = new Set(['blocked', 'review', 'running'])
const WAITING = new Set(['blocked', 'review'])
const MAX_THREADS = 30

/** The tasks that are conversations: any with comments, and any being worked on or waiting on you. */
function conversationTasks(board: KanbanBoard): KanbanTask[] {
  const rank = (task: KanbanTask) => (WAITING.has(task.status) ? 0 : task.status === 'running' ? 1 : 2)

  return board.columns
    .flatMap(column => column.tasks)
    .filter(task => (task.comment_count ?? 0) > 0 || ACTIVE.has(task.status))
    .sort((a, b) => rank(a) - rank(b) || (b.created_at ?? 0) - (a.created_at ?? 0))
    .slice(0, MAX_THREADS)
}

function Line({ line, title }: { line: ChatLine; title?: string }) {
  const k = useKanban()

  if (line.kind === 'event') {
    return (
      <div className="flex items-center justify-center gap-2 py-0.5 text-[0.75rem] text-(--ui-text-tertiary)">
        <span className="h-px w-8 bg-(--ui-stroke-tertiary)" />
        {k.overview.feed[line.event]}
        {title && <span className="text-(--ui-text-secondary)">{title}</span>}
        <span className="text-(--ui-text-quaternary)">· {ago(line.at)}</span>
        <span className="h-px w-8 bg-(--ui-stroke-tertiary)" />
      </div>
    )
  }

  if (line.mine) {
    return (
      <div className="flex max-w-[70%] flex-col gap-1 self-end rounded-2xl rounded-br-md border border-[color-mix(in_srgb,var(--dt-composer-ring)_35%,transparent)] bg-[color-mix(in_srgb,var(--dt-composer-ring)_16%,transparent)] px-3.5 py-2.5">
        <span className="text-[0.6875rem] text-(--ui-text-tertiary)">
          {CHAT.you} · {ago(line.at)}
          {title && ` · ${CHAT.on(title)}`}
        </span>
        <p className="text-[0.875rem] leading-relaxed whitespace-pre-line text-foreground">{line.body}</p>
      </div>
    )
  }

  return (
    <div className="flex max-w-[78%] items-start gap-3">
      <Avatar name={line.author} size="2rem" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[0.75rem]">
          <span className="font-semibold text-foreground">{line.author}</span>
          <span className="text-(--ui-text-tertiary)">
            {' '}
            · {ago(line.at)}
            {title && ` · ${CHAT.on(title)}`}
          </span>
        </span>
        <p className="rounded-2xl rounded-tl-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) px-3.5 py-2.5 text-[0.875rem] leading-relaxed whitespace-pre-line text-(--ui-text-secondary)">
          {line.body}
        </p>
      </div>
    </div>
  )
}

function ThreadRow({
  active,
  last,
  onSelect,
  task
}: {
  active: boolean
  last: ChatLine | null
  onSelect: () => void
  task: KanbanTask
}) {
  const waiting = WAITING.has(task.status)

  return (
    <button
      className={cn(
        'flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors',
        active ? 'bg-(--ui-control-active-background)' : 'hover:bg-(--chrome-action-hover)'
      )}
      data-chat-thread={task.id}
      onClick={onSelect}
      type="button"
    >
      {task.assignee ? (
        <Avatar name={task.assignee} size="1.75rem" />
      ) : (
        <Codicon className="mt-1" name="circle-outline" size="1rem" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-foreground">
            {task.title || task.id}
          </span>
          {waiting && <span className="size-2 shrink-0 rounded-full bg-[#ef4444]" />}
        </span>
        <span className="block truncate text-[0.75rem] text-(--ui-text-tertiary)">
          {last && last.kind === 'message'
            ? `${last.mine ? CHAT.you : last.author}: ${last.body}`
            : (task.assignee ?? '—')}
        </span>
      </span>
    </button>
  )
}

function Composer({
  onSent,
  target,
  targets,
  setTarget
}: {
  onSent: () => void
  setTarget: (id: string) => void
  target: string
  targets: KanbanTask[] | null
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setBusy(true)
    setError('')

    try {
      await addComment(target, text.trim())
      setText('')
      onSent()
    } catch (failure) {
      setError(errText(failure))
    }

    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) p-2.5">
      <Textarea
        aria-label={CHAT.placeholder}
        className="min-h-14 resize-none border-0 bg-transparent text-[0.875rem] shadow-none focus-visible:ring-0"
        onChange={event => setText(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && text.trim() && target) {
            event.preventDefault()
            void send()
          }
        }}
        placeholder={targets ? CHAT.teamPlaceholder : CHAT.placeholder}
        value={text}
      />
      <div className="flex items-center gap-2">
        {targets && (
          <Select onValueChange={setTarget} value={target}>
            <SelectTrigger aria-label={CHAT.to} className="h-8 max-w-72 text-[0.8125rem]">
              <span className="mr-1 text-(--ui-text-tertiary)">{CHAT.to}</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targets.map(task => (
                <SelectItem key={task.id} value={task.id}>
                  {task.assignee ? `${task.assignee} · ${task.title}` : task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {error && <span className="truncate text-[0.75rem] text-destructive">{error}</span>}
        <Button className="ml-auto" disabled={busy || !text.trim() || !target} onClick={() => void send()} size="sm">
          <Codicon name="send" size="0.8rem" />
          {CHAT.send}
        </Button>
      </div>
    </div>
  )
}

export function BoardChat({ board, onOpen }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const k = useKanban()
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const tasks = conversationTasks(board)
  const [selected, setSelected] = useState(TEAM)
  const [teamTarget, setTeamTarget] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  const details = useQueries({
    queries: tasks.map(task => ({
      queryFn: () => fetchTask(task.id),
      queryKey: taskKey(scope, slug, task.id),
      refetchInterval: 30_000
    }))
  })

  const threads = new Map(
    tasks.map((task, index) => {
      const detail = details[index]?.data

      return [task.id, detail ? threadLines(task.id, detail.comments ?? [], detail.events ?? []) : []]
    })
  )

  const titles = new Map(tasks.map(task => [task.id, task.title || task.id]))
  const current = tasks.find(task => task.id === selected) ?? null
  const lines = current ? (threads.get(current.id) ?? []) : teamFeed([...threads.values()], 200)
  const target = current?.id ?? (teamTarget || tasks[0]?.id || '')

  // New lines scroll into view, as a chat does.
  useEffect(() => bottom.current?.scrollIntoView?.({ block: 'end' }), [lines.length, selected])

  if (!tasks.length) {
    return (
      <div className="grid flex-1 place-items-center px-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-2">
          <span className="grid size-11 place-items-center rounded-full bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)">
            <Codicon name="comment-discussion" size="1.2rem" />
          </span>
          <p className="text-[0.9375rem] font-medium text-foreground">{CHAT.emptyTitle}</p>
          <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{CHAT.emptyBody}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 gap-0 overflow-hidden" data-kanban-chat="">
      <aside className="flex w-72 shrink-0 flex-col gap-1 overflow-y-auto border-r border-(--ui-stroke-tertiary) px-2.5 py-3">
        <button
          className={cn(
            'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left',
            selected === TEAM ? 'bg-(--ui-control-active-background)' : 'hover:bg-(--chrome-action-hover)'
          )}
          onClick={() => setSelected(TEAM)}
          type="button"
        >
          <span className="grid size-7 place-items-center rounded-full bg-(--ui-bg-tertiary) text-foreground">
            <Codicon name="organization" size="0.9rem" />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.8125rem] font-semibold text-foreground">{CHAT.team}</span>
            <span className="block truncate text-[0.75rem] text-(--ui-text-tertiary)">{CHAT.teamHint}</span>
          </span>
        </button>
        <div className="px-2.5 pt-3 pb-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
          {CHAT.conversations}
        </div>
        {tasks.map(task => (
          <ThreadRow
            active={selected === task.id}
            key={task.id}
            last={lastMessage(threads.get(task.id) ?? [])}
            onSelect={() => setSelected(task.id)}
            task={task}
          />
        ))}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-(--ui-stroke-tertiary) px-5 py-3">
          {current?.assignee && <Avatar name={current.assignee} size="2rem" />}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[1rem] font-semibold text-foreground">
              {current ? current.title : CHAT.team}
            </h2>
            <p className="truncate text-[0.75rem] text-(--ui-text-tertiary)">
              {current ? (
                <>
                  {current.assignee ?? '—'} ·{' '}
                  <span style={{ color: columnMeta(current.status).tone }}>{columnLabel(k, current.status)}</span>
                </>
              ) : (
                CHAT.teamHint
              )}
            </p>
          </div>
          {current && (
            <Button onClick={() => onOpen(current.id)} size="sm" variant="outline">
              <Codicon name="link-external" size="0.8rem" />
              {CHAT.openTask}
            </Button>
          )}
        </header>
        {current && WAITING.has(current.status) && (
          <div className="mx-5 mt-3 flex items-center gap-2.5 rounded-xl bg-[color-mix(in_srgb,#fbbf24_10%,transparent)] px-3.5 py-2.5 text-[0.8125rem] text-foreground">
            <Codicon className="text-[#fbbf24]" name="bell-dot" size="0.95rem" />
            <span className="flex-1">{CHAT.waiting}</span>
            <Button
              onClick={() => {
                $inboxFocus.set(current.id)
                $boardView.set('inbox')
              }}
              size="sm"
            >
              {CHAT.openInbox}
            </Button>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">
          {lines.length ? (
            lines.map(line => (
              <Line
                key={`${line.taskId}:${line.id}`}
                line={line}
                title={current ? undefined : titles.get(line.taskId)}
              />
            ))
          ) : (
            <p className="m-auto text-[0.8125rem] text-(--ui-text-tertiary)">{CHAT.noMessages}</p>
          )}
          <div ref={bottom} />
        </div>
        <div className="shrink-0 px-5 pb-4">
          <Composer
            onSent={() => void qc.invalidateQueries({ queryKey: taskKey(scope, slug, target) })}
            setTarget={setTeamTarget}
            target={target}
            targets={current ? null : tasks}
          />
        </div>
      </section>
    </div>
  )
}
