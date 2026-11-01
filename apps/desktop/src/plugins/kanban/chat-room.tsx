/**
 * The pieces of the Chat room: the channel's header with its members, the Room notes card, a thread's first
 * message standing in the channel with its replies, the approval card a waiting thread carries (the same actions
 * as the Inbox, from `inbox-writes`), the "… is working" line above the composer, and the thread panel on the right.
 */

import { Button, cn, Codicon, MessageTextContent, Textarea, Tip, useQuery, useValue } from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import { $boardSlug, $boardView, fetchJournal, journalKey, useKanbanScope } from './api'
import { CHAT } from './chat-copy'
import type { ChatAgent } from './chat-model'
import { type ApprovalKind, approvalKind, roomNotes, type ThreadRoot } from './chat-room-model'
import { parseDecision } from './decision-model'
import { $inboxFocus } from './inbox-card'
import { useDecide } from './inbox-writes'
import { useGoals } from './team-queries'
import { columnMeta, type KanbanTask } from './types'
import { ago, Avatar, columnLabel, useKanban } from './ui'

const AVATAR_STACK = 5

export function ChannelHeader({ agents, name, prefix = '#' }: { agents: ChatAgent[]; name: string; prefix?: string }) {
  return (
    <header
      className="flex shrink-0 items-center gap-3 border-b border-(--ui-stroke-tertiary) px-5 py-2.5"
      data-chat-channel=""
    >
      <h2 className="flex min-w-0 flex-1 items-center gap-1 text-[0.9375rem] font-semibold text-foreground">
        <span className="text-(--ui-text-tertiary)">{prefix}</span>
        <span className="truncate">{name}</span>
      </h2>
      <Tip label={agents.map(agent => agent.name).join(', ')}>
        <span className="flex items-center gap-2 text-[0.75rem] text-(--ui-text-tertiary)">
          <span className="flex -space-x-1.5">
            {agents.slice(0, AVATAR_STACK).map(agent => (
              <span className="rounded-full ring-2 ring-(--ui-bg)" key={agent.name}>
                <Avatar name={agent.name} size="1.375rem" />
              </span>
            ))}
          </span>
          {CHAT.members(agents.length + 1)}
        </span>
      </Tip>
    </header>
  )
}

function NoteBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.625rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

/** The project's objective, the latest decisions from its journal, and what is open — folded away on a click. */
export function RoomNotesCard({ tasks }: { tasks: KanbanTask[] }) {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  // Open on a wide window; folded on a phone, where it would push the conversation off the screen.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)
  const { data: goals } = useGoals()
  const { data: journal } = useQuery({ queryFn: fetchJournal, queryKey: journalKey(scope, slug), staleTime: 30_000 })
  const notes = roomNotes(goals?.goals, journal?.entries, tasks)
  const { needYou, running, waiting } = notes.open

  return (
    <section
      className="rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) text-[0.8125rem]"
      data-room-notes=""
    >
      <button
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <Codicon className="text-(--ui-text-tertiary)" name="note" size="0.85rem" />
        <span className="flex-1 font-semibold text-foreground">{CHAT.notes.title}</span>
        <Codicon className="text-(--ui-text-tertiary)" name={open ? 'chevron-up' : 'chevron-down'} size="0.8rem" />
      </button>
      {open && (
        <div className="grid gap-4 border-t border-(--ui-stroke-tertiary) px-3 py-3 @2xl:grid-cols-[1.2fr_1.4fr_0.8fr]">
          <NoteBlock label={CHAT.notes.objective}>
            {notes.objective ? (
              <>
                <p className="font-medium text-foreground">{notes.objective.title}</p>
                {notes.objective.why && (
                  <p className="line-clamp-2 text-[0.75rem] text-(--ui-text-tertiary)">{notes.objective.why}</p>
                )}
              </>
            ) : (
              <button
                className="cursor-pointer text-left text-(--ui-text-tertiary) hover:text-foreground"
                onClick={() => $boardView.set('goals')}
                type="button"
              >
                {CHAT.notes.noObjective}
              </button>
            )}
          </NoteBlock>
          <NoteBlock label={CHAT.notes.decisions}>
            {notes.decisions.length ? (
              <ul className="flex flex-col gap-1">
                {notes.decisions.map(entry => (
                  <li className="flex min-w-0 items-baseline gap-1.5" key={entry.path}>
                    <span className="shrink-0 text-[0.6875rem] text-(--ui-text-tertiary)">
                      {CHAT.notes.outcome[entry.outcome] ?? entry.outcome}
                    </span>
                    <span className="min-w-0 truncate text-foreground">{entry.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-(--ui-text-tertiary)">{CHAT.notes.noDecisions}</p>
            )}
          </NoteBlock>
          <NoteBlock label={CHAT.notes.open}>
            <span style={{ color: needYou ? columnMeta('blocked').tone : undefined }}>
              {CHAT.notes.needYou(needYou)}
            </span>
            <span className="text-(--ui-text-secondary)">{CHAT.notes.running(running)}</span>
            <span className="text-(--ui-text-tertiary)">{CHAT.notes.waiting(waiting)}</span>
          </NoteBlock>
        </div>
      )}
    </section>
  )
}

const APPROVAL_ICON: Record<ApprovalKind, string> = { blocked: 'debug-pause', question: 'question', review: 'pass' }

/** A waiting thread's decision, settled in place with the Inbox's own actions. */
export function ApprovalCard({ onAnswer, task }: { onAnswer: () => void; task: KanbanTask }) {
  const decide = useDecide()
  const [denying, setDenying] = useState<null | string>(null)
  const [busy, setBusy] = useState(false)
  const kind = approvalKind(task)

  if (!kind) {
    return null
  }

  const said = parseDecision(task.latest_summary || task.body)
  const ask = said.ask || said.report || task.latest_summary || ''
  const tone = columnMeta(task.status).tone

  const run = async (write: () => Promise<boolean>) => {
    setBusy(true)
    await write()
    setBusy(false)
  }

  const details = () => {
    $inboxFocus.set(task.id)
    $boardView.set('inbox')
  }

  return (
    <div
      className="mt-1.5 flex max-w-2xl flex-col gap-2 rounded-xl border px-3 py-2.5"
      data-chat-approval={kind}
      style={{
        backgroundColor: `color-mix(in srgb, ${tone} 6%, transparent)`,
        borderColor: `color-mix(in srgb, ${tone} 35%, transparent)`
      }}
    >
      <div className="flex items-center gap-2 text-[0.75rem] font-medium" style={{ color: tone }}>
        <Codicon name={APPROVAL_ICON[kind]} size="0.85rem" />
        {CHAT.approval[kind]}
      </div>
      {ask && <p className="line-clamp-3 text-[0.8125rem] text-foreground">{ask}</p>}
      {denying !== null ? (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label={CHAT.approval.deny}
            autoFocus
            className="min-h-16 text-[0.8125rem]"
            onChange={event => setDenying(event.target.value)}
            placeholder={CHAT.approval.denyPlaceholder}
            value={denying}
          />
          <div className="flex items-center gap-2">
            <Button
              disabled={busy || !denying.trim()}
              onClick={() => void run(() => decide.sendBack(task.id, denying))}
              size="sm"
            >
              {CHAT.approval.send}
            </Button>
            <Button onClick={() => setDenying(null)} size="sm" variant="ghost">
              {CHAT.approval.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {kind === 'review' && (
            <>
              <Button
                className="bg-(--ui-green) text-white hover:bg-(--ui-green)/90"
                disabled={busy}
                onClick={() => void run(() => decide.approve(task.id, ''))}
                size="sm"
              >
                <Codicon name="check" size="0.8rem" />
                {CHAT.approval.approve}
              </Button>
              <Button disabled={busy} onClick={() => setDenying('')} size="sm" variant="outline">
                <Codicon name="close" size="0.8rem" />
                {CHAT.approval.deny}
              </Button>
            </>
          )}
          {kind === 'question' && (
            <Button onClick={onAnswer} size="sm">
              <Codicon name="reply" size="0.8rem" />
              {CHAT.approval.answer}
            </Button>
          )}
          {kind === 'blocked' && (
            <Button
              disabled={busy}
              onClick={() => void run(() => decide.unblock(task.id, ''))}
              size="sm"
              variant="outline"
            >
              <Codicon name="debug-continue" size="0.8rem" />
              {CHAT.approval.unblock}
            </Button>
          )}
          <Button onClick={details} size="sm" variant="ghost">
            {CHAT.approval.more}
          </Button>
        </div>
      )}
    </div>
  )
}

function Markdown({ text }: { text: string }) {
  return (
    <div
      className="line-clamp-6 min-w-0 text-[0.875rem] leading-relaxed text-foreground [&_.aui-md>:first-child]:mt-0 [&_.aui-md>:last-child]:mb-0"
      data-selectable-text="true"
    >
      <MessageTextContent media={false} text={text} />
    </div>
  )
}

/** A thread's first message in the channel, with its replies underneath and, when it waits on you, its card. */
export function RootMessage({
  active,
  onOpen,
  role,
  root
}: {
  active: boolean
  onOpen: () => void
  role?: string
  root: ThreadRoot
}) {
  const k = useKanban()
  const name = root.mine ? CHAT.you : root.author
  const status = root.task.status

  return (
    <article
      className={cn(
        'group flex gap-2.5 rounded-lg px-2 py-2 transition-colors',
        active ? 'bg-(--ui-control-active-background)' : 'hover:bg-(--chrome-action-hover)'
      )}
      data-chat-root={root.task.id}
    >
      <span className="w-7 shrink-0 pt-0.5">
        {root.mine ? (
          <span className="grid size-7 place-items-center rounded-full bg-foreground text-[0.625rem] font-semibold text-background">
            {CHAT.you.slice(0, 1)}
          </span>
        ) : (
          <Avatar name={root.author} size="1.75rem" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[0.75rem]">
          <span className="font-semibold text-foreground">{name}</span>
          {role && !root.mine && <span className="truncate text-(--ui-text-tertiary)">{role}</span>}
          <span className="text-(--ui-text-quaternary)">· {ago(root.at)}</span>
          <span
            className="ml-1 truncate rounded-full px-1.5 text-[0.625rem]"
            style={{
              backgroundColor: `color-mix(in srgb, ${columnMeta(status).tone} 14%, transparent)`,
              color: columnMeta(status).tone
            }}
          >
            {columnLabel(k, status)}
          </span>
        </span>
        {root.body.trim() !== (root.task.title ?? '').trim() && (
          <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
            {CHAT.on(root.task.title ?? root.task.id)}
          </span>
        )}
        <Markdown text={root.body} />
        <ApprovalCard onAnswer={onOpen} task={root.task} />
        <button
          className="mt-0.5 flex w-fit cursor-pointer items-center gap-2 rounded-md py-0.5 pr-2 text-[0.75rem] text-(--ui-text-tertiary) hover:text-foreground"
          data-chat-replies={root.task.id}
          onClick={onOpen}
          type="button"
        >
          {root.participants.length > 0 && (
            <span className="flex -space-x-1">
              {root.participants.slice(0, 3).map(author => (
                <Avatar key={author} name={author} size="1.125rem" />
              ))}
            </span>
          )}
          <span className="font-medium text-[#60a5fa]">
            {root.replies ? CHAT.replies(root.replies) : CHAT.noReplies}
          </span>
          {root.replies > 0 && <span>{CHAT.lastReply(ago(root.lastAt) ?? '')}</span>}
        </button>
      </div>
    </article>
  )
}

/** "Ana and Max are working…" with the three pulsing dots, above the composer. */
export function WorkingLine({ text }: { text: string }) {
  if (!text) {
    return <div aria-hidden className="h-5" />
  }

  return (
    <div className="flex h-5 items-center gap-2 px-1 text-[0.75rem] text-(--ui-text-tertiary)" role="status">
      <span aria-hidden className="inline-flex gap-0.5">
        {[0, 1, 2].map(dot => (
          <span
            className="size-1 animate-pulse rounded-full bg-(--ui-text-tertiary)"
            key={dot}
            style={{ animationDelay: `${dot * 0.25}s` }}
          />
        ))}
      </span>
      {text}
    </div>
  )
}

/** The thread on the right: its title and state, every message, and a composer that replies in it. */
export function ThreadPanel({
  children,
  composer,
  onClose,
  onOpenTask,
  task
}: {
  children: ReactNode
  composer: ReactNode
  onClose: () => void
  onOpenTask: () => void
  task: KanbanTask
}) {
  const k = useKanban()

  return (
    <aside
      className="flex w-full min-w-0 shrink-0 flex-col border-l border-(--ui-stroke-tertiary) bg-(--ui-bg) xl:w-[26rem]"
      data-chat-thread-panel={task.id}
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-(--ui-stroke-tertiary) px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{CHAT.thread}</div>
          <h3 className="line-clamp-2 text-[0.875rem] font-semibold text-foreground">{task.title || task.id}</h3>
          <p className="text-[0.6875rem] text-(--ui-text-tertiary)">
            {task.assignee ?? '—'} ·{' '}
            <span style={{ color: columnMeta(task.status).tone }}>{columnLabel(k, task.status)}</span>
          </p>
        </div>
        <Tip label={CHAT.openTask}>
          <Button aria-label={CHAT.openTask} onClick={onOpenTask} size="icon-xs" variant="ghost">
            <Codicon name="link-external" size="0.8rem" />
          </Button>
        </Tip>
        <Tip label={CHAT.closeThread}>
          <Button aria-label={CHAT.closeThread} onClick={onClose} size="icon-xs" variant="ghost">
            <Codicon name="close" size="0.8rem" />
          </Button>
        </Tip>
      </header>
      {children}
      <div className="shrink-0 px-4 pb-4">{composer}</div>
    </aside>
  )
}
