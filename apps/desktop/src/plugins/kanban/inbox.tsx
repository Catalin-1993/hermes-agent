/**
 * The owner's Inbox: every decision the board waits on, in one list, each with the action that
 * settles it right there — answer an agent's question and resume the card, approve a review or
 * send it back with a comment, unblock, raise a budget, or open the card for a problem. Items can
 * be put off for a day. Writes ride the existing task routes; the board refresh follows.
 */

import { Button, cn, Codicon, host, Input, Textarea, Tip, useQuery, useQueryClient, useValue } from '@hermes/plugin-sdk'
import { type ComponentType, useState } from 'react'

import {
  $boardSlug,
  $inboxSnoozed,
  activityKey,
  addComment,
  boardKeyPrefix,
  controlsKey,
  fetchControls,
  patchTask,
  setControl,
  useKanbanScope
} from './api'
import {
  buildInbox,
  countByKind,
  INBOX_KINDS,
  type InboxExtras,
  type InboxItem,
  type InboxKind,
  snooze
} from './inbox-model'
import { useRules, useWatchdog } from './team-queries'
import type { AgentControl, KanbanBoard, KanbanControls } from './types'
import { ago, Avatar, errText, type KanbanText, usd, useKanban } from './ui'
import { WatchAction, watchDetail } from './watchdog'

/** The controls (pause, budgets, spend), shared by the Inbox, the Agents view and the pause banner. */
export function useControls() {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  return useQuery({ queryFn: fetchControls, queryKey: controlsKey(scope, slug), refetchInterval: 30_000 })
}

/** Run a write, say it worked (or why not), and refresh what it changed. */
function useSettle() {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  return async (write: () => Promise<unknown>, done: string) => {
    try {
      await write()
      host.notify({ kind: 'success', message: done })
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })

      return false
    } finally {
      void qc.invalidateQueries({ queryKey: boardKeyPrefix(scope) })
      void qc.invalidateQueries({ queryKey: controlsKey(scope, slug) })
      void qc.invalidateQueries({ queryKey: activityKey(scope, slug) })
    }

    return true
  }
}

export const KIND_META: Record<InboxKind, { icon: string; tone: string }> = {
  blocked: { icon: 'error', tone: '#f87171' },
  budget: { icon: 'credit-card', tone: '#fb923c' },
  problem: { icon: 'warning', tone: '#f87171' },
  question: { icon: 'comment-discussion', tone: '#60a5fa' },
  review: { icon: 'eye', tone: '#fbbf24' },
  watch: { icon: 'pulse', tone: '#a78bfa' }
}

interface ActionProps {
  item: InboxItem
  k: KanbanText
  onOpen: (id: string) => void
  agent?: AgentControl
}

function OpenButton({ item, k, onOpen }: ActionProps) {
  return item.task ? (
    <Button onClick={() => onOpen(item.task!.id)} size="sm" variant="ghost">
      <Codicon name="link-external" size="0.75rem" />
      {k.inbox.open}
    </Button>
  ) : null
}

function QuestionActions(props: ActionProps) {
  const { item, k } = props
  const settle = useSettle()
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const id = item.task!.id

  const send = async () => {
    setBusy(true)
    await settle(async () => {
      await addComment(id, answer.trim())
      await patchTask(id, { status: 'ready' })
    }, k.inbox.done.answered)
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label={k.inbox.answerLabel}
        className="min-h-16 text-[0.8125rem]"
        onChange={event => setAnswer(event.target.value)}
        placeholder={k.inbox.answerPlaceholder}
        value={answer}
      />
      <div className="flex items-center gap-2">
        <Button disabled={busy || !answer.trim()} onClick={() => void send()} size="sm">
          <Codicon name="send" size="0.75rem" />
          {k.inbox.answer}
        </Button>
        <OpenButton {...props} />
      </div>
    </div>
  )
}

function ReviewActions(props: ActionProps) {
  const { item, k } = props
  const settle = useSettle()
  const [changes, setChanges] = useState<null | string>(null)
  const [busy, setBusy] = useState(false)
  const id = item.task!.id

  const run = async (write: () => Promise<unknown>, done: string) => {
    setBusy(true)
    await settle(write, done)
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {changes !== null && (
        <Textarea
          aria-label={k.inbox.requestChanges}
          autoFocus
          className="min-h-16 text-[0.8125rem]"
          onChange={event => setChanges(event.target.value)}
          placeholder={k.inbox.changesPlaceholder}
          value={changes}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {changes === null ? (
          <>
            <Button
              className="bg-(--ui-green) text-white hover:bg-(--ui-green)/90"
              disabled={busy}
              onClick={() => void run(() => patchTask(id, { status: 'done' }), k.inbox.done.approved)}
              size="sm"
            >
              <Codicon name="check" size="0.75rem" />
              {k.inbox.approve}
            </Button>
            <Button disabled={busy} onClick={() => setChanges('')} size="sm" variant="outline">
              <Codicon name="reply" size="0.75rem" />
              {k.inbox.requestChanges}
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={busy || !changes.trim()}
              onClick={() =>
                void run(async () => {
                  await addComment(id, changes.trim())
                  await patchTask(id, { status: 'ready' })
                }, k.inbox.done.sentBack)
              }
              size="sm"
            >
              <Codicon name="reply" size="0.75rem" />
              {k.inbox.sendBack}
            </Button>
            <Button onClick={() => setChanges(null)} size="sm" variant="ghost">
              {k.inbox.cancel}
            </Button>
          </>
        )}
        <OpenButton {...props} />
      </div>
    </div>
  )
}

function BlockedActions(props: ActionProps) {
  const { item, k } = props
  const settle = useSettle()

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => void settle(() => patchTask(item.task!.id, { status: 'ready' }), k.inbox.done.unblocked)}
        size="sm"
        variant="outline"
      >
        <Codicon name="debug-continue" size="0.75rem" />
        {k.inbox.unblock}
      </Button>
      <OpenButton {...props} />
    </div>
  )
}

function ProblemActions(props: ActionProps) {
  return (
    <div className="flex items-center gap-2">
      <OpenButton {...props} />
    </div>
  )
}

function BudgetActions({ agent, item, k }: ActionProps) {
  const settle = useSettle()
  const current = agent?.monthly_budget_usd ?? 0
  const [value, setValue] = useState(String(Math.ceil(Math.max(current * 1.5, (agent?.month_spend_usd ?? 0) + 5))))
  const amount = Number(value.replace(',', '.'))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[0.75rem] text-(--ui-text-tertiary)">$</span>
      <Input
        aria-label={k.agents.budgetLabel}
        className="h-7 w-24 text-[0.8125rem] tabular-nums"
        inputMode="decimal"
        onChange={event => setValue(event.target.value)}
        value={value}
      />
      <Button
        disabled={!(amount > 0)}
        onClick={() =>
          void settle(() => setControl({ monthly_budget_usd: amount, profile: item.agent }), k.inbox.done.budget)
        }
        size="sm"
      >
        <Codicon name="arrow-up" size="0.75rem" />
        {k.inbox.raiseBudget}
      </Button>
    </div>
  )
}

function WatchActions(props: ActionProps) {
  return (
    <div className="flex items-center gap-2">
      <WatchAction finding={props.item.finding!} k={props.k} />
      <OpenButton {...props} />
    </div>
  )
}

const ACTIONS: Record<InboxKind, ComponentType<ActionProps>> = {
  blocked: BlockedActions,
  budget: BudgetActions,
  problem: ProblemActions,
  question: QuestionActions,
  review: ReviewActions,
  watch: WatchActions
}

export function itemBody(item: InboxItem, k: KanbanText, agent?: AgentControl): string {
  if (item.kind === 'budget') {
    return k.inbox.budgetBody(usd(agent?.month_spend_usd ?? 0), usd(agent?.monthly_budget_usd ?? 0))
  }

  if (item.kind === 'problem') {
    return k.inbox.problemBody(item.task?.warnings?.count ?? 1)
  }

  if (item.finding) {
    return `${k.watch.kinds[item.finding.kind]}: ${watchDetail(k, item.finding)}`
  }

  return item.task?.latest_summary || item.task?.body || k.inbox.noSummary
}

function InboxCard({
  controls,
  item,
  k,
  onOpen
}: {
  controls?: KanbanControls
  item: InboxItem
  k: KanbanText
  onOpen: (id: string) => void
}) {
  const meta = KIND_META[item.kind]
  const Actions = ACTIONS[item.kind]
  const agent = controls?.agents.find(entry => entry.profile === item.agent)

  return (
    <li
      className="group flex gap-3 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3.5"
      data-inbox-item={item.id}
    >
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
      >
        <Codicon name={meta.icon} size="0.9rem" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.875rem] font-medium text-foreground">
              {item.task?.title || item.finding?.task_title || item.agent}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">
              <span
                className="rounded-full px-1.5 py-px font-medium"
                style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 12%, transparent)`, color: meta.tone }}
              >
                {k.inbox.badge[item.kind]}
              </span>
              {item.agent && (
                <span className="inline-flex items-center gap-1">
                  <Avatar name={item.agent} size="0.875rem" />
                  {item.agent}
                </span>
              )}
              {item.heldBy && (
                <span className="inline-flex items-center gap-1 text-(--ui-text-secondary)">
                  <Codicon name="law" size="0.7rem" />
                  {k.rules.heldBy(item.heldBy)}
                </span>
              )}
              {item.since > 0 && <span className="text-(--ui-text-quaternary)">· {ago(item.since)}</span>}
            </div>
          </div>
          <Tip label={k.inbox.later}>
            <Button
              aria-label={k.inbox.later}
              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => $inboxSnoozed.set(snooze($inboxSnoozed.get(), item.id))}
              size="icon-xs"
              variant="ghost"
            >
              <Codicon name="watch" size="0.8rem" />
            </Button>
          </Tip>
        </div>
        <p className="line-clamp-4 whitespace-pre-line text-[0.8125rem] leading-relaxed text-(--ui-text-secondary)">
          {itemBody(item, k, agent)}
        </p>
        <Actions agent={agent} item={item} k={k} onOpen={onOpen} />
      </div>
    </li>
  )
}

/** The count the Inbox tab shows. */
export function useInboxCount(board: KanbanBoard | null): number {
  const { data: controls } = useControls()
  const extras = useInboxExtras()
  const snoozed = useValue($inboxSnoozed)

  return board ? buildInbox(board, controls, snoozed, Date.now(), extras).length : 0
}

export function useInboxExtras(): InboxExtras {
  const { data: watchdog } = useWatchdog()
  const { data: rules } = useRules()

  return { findings: watchdog?.findings, holds: rules?.holds }
}

export function BoardInbox({ board, onOpen }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const k = useKanban()
  const { data: controls } = useControls()
  const extras = useInboxExtras()
  const snoozed = useValue($inboxSnoozed)
  const [filter, setFilter] = useState<'all' | InboxKind>('all')
  const items = buildInbox(board, controls, snoozed, Date.now(), extras)
  const counts = countByKind(items)
  const shown = filter === 'all' ? items : items.filter(item => item.kind === filter)

  const chip = (id: 'all' | InboxKind, label: string, count: number) => (
    <button
      aria-pressed={filter === id}
      className={cn(
        'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[0.75rem] transition-colors',
        filter === id
          ? 'bg-(--ui-control-active-background) font-medium text-foreground'
          : 'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
      )}
      key={id}
      onClick={() => setFilter(id)}
      type="button"
    >
      {id !== 'all' && <span className="size-1.5 rounded-full" style={{ backgroundColor: KIND_META[id].tone }} />}
      {label}
      <span className="tabular-nums text-(--ui-text-quaternary)">{count}</span>
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4" data-kanban-inbox="">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">{k.inbox.title}</h2>
          <p className="text-[0.75rem] text-(--ui-text-tertiary)">{k.inbox.subtitle(items.length)}</p>
        </header>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chip('all', k.inbox.all, items.length)}
            {INBOX_KINDS.filter(kind => counts[kind] > 0).map(kind => chip(kind, k.inbox.kinds[kind], counts[kind]))}
          </div>
        )}
        {shown.length ? (
          <ul className="flex flex-col gap-2">
            {shown.map(item => (
              <InboxCard controls={controls} item={item} k={k} key={item.id} onOpen={onOpen} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-(--ui-stroke-secondary) px-6 py-12 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-(--ui-green)/12 text-(--ui-green)">
              <Codicon name="check-all" size="1.1rem" />
            </span>
            <p className="text-[0.875rem] font-medium text-foreground">{k.inbox.emptyTitle}</p>
            <p className="text-[0.75rem] text-(--ui-text-tertiary)">{k.inbox.emptyBody}</p>
          </div>
        )}
      </div>
    </div>
  )
}
