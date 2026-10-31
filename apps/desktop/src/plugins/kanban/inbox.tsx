/**
 * The owner's Inbox: every decision the board waits on, in one list, each with the action that
 * settles it right there — answer an agent's question and resume the card, approve a review or
 * send it back with a comment, unblock, raise a budget, or open the card for a problem. Items can
 * be put off for a day. Writes ride the existing task routes; the board refresh follows.
 */

import { Button, cn, Codicon, host, Input, Textarea, useQuery, useQueryClient, useValue } from '@hermes/plugin-sdk'
import { type ComponentType, type ReactNode, useEffect, useState } from 'react'

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
import { DECISION_KINDS, DecisionDetails } from './decision-card'
import { parseDecision } from './decision-model'
import { $inboxFocus, DetailPanel, KIND_META, ListRow } from './inbox-card'
import { INBOX } from './inbox-copy'
import {
  buildInbox,
  countByKind,
  INBOX_KINDS,
  type InboxExtras,
  type InboxItem,
  type InboxKind,
  snooze
} from './inbox-model'
import { journalDecision } from './journal-record'
import { useRules, useWatchdog } from './team-queries'
import type { AgentControl, KanbanBoard, KanbanControls } from './types'
import { errText, type KanbanText, usd, useKanban } from './ui'
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

interface ActionProps {
  item: InboxItem
  k: KanbanText
  onOpen: (id: string) => void
  agent?: AgentControl
}

function OpenButton({ item, k, onOpen }: ActionProps) {
  return item.task ? (
    <Button className="self-start" onClick={() => onOpen(item.task!.id)} size="sm" variant="ghost">
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

    const ok = await settle(async () => {
      await addComment(id, answer.trim())
      await patchTask(id, { status: 'ready' })
    }, k.inbox.done.answered)

    if (ok) {
      await journalDecision(id, 'answered', answer)
    }

    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Textarea
        aria-label={k.inbox.answerLabel}
        className="min-h-24 text-[0.9375rem]"
        onChange={event => setAnswer(event.target.value)}
        placeholder={k.inbox.answerPlaceholder}
        value={answer}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy || !answer.trim()} onClick={() => void send()}>
          <Codicon name="send" size="0.8rem" />
          {k.inbox.answer}
        </Button>
        <span className="text-[0.8125rem] text-(--ui-text-tertiary)">{INBOX.choice.answer}</span>
      </div>
      <OpenButton {...props} />
    </div>
  )
}

/** The owner's reason for a decision: optional, and kept in the project's journal. */
function ReasonField({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  return (
    <Input
      aria-label={INBOX.reason.label}
      className="h-9 text-[0.875rem]"
      onChange={event => onChange(event.target.value)}
      placeholder={INBOX.reason.placeholder}
      value={value}
    />
  )
}

function ReviewActions(props: ActionProps) {
  const { item, k } = props
  const settle = useSettle()
  const [changes, setChanges] = useState<null | string>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const id = item.task!.id

  const run = async (
    write: () => Promise<unknown>,
    done: string,
    outcome: 'approved' | 'changes_requested',
    why: string
  ) => {
    setBusy(true)

    if (await settle(write, done)) {
      await journalDecision(id, outcome, why)
    }

    setBusy(false)
  }

  const agentSays = parseDecision(item.task!.latest_summary || item.task!.body)

  const tile = (button: ReactNode, hint: string, extra: string) => (
    <div className="flex flex-col gap-1.5 rounded-xl border border-(--ui-stroke-tertiary) p-3">
      {button}
      <p className="text-[0.8125rem] leading-snug text-(--ui-text-tertiary)">{hint}</p>
      {extra && (
        <p className="text-[0.8125rem] leading-snug text-(--ui-text-secondary)">{INBOX.choice.agentSays(extra)}</p>
      )}
    </div>
  )

  if (changes !== null) {
    return (
      <div className="flex flex-col gap-2.5">
        <Textarea
          aria-label={k.inbox.requestChanges}
          autoFocus
          className="min-h-24 text-[0.9375rem]"
          onChange={event => setChanges(event.target.value)}
          placeholder={k.inbox.changesPlaceholder}
          value={changes}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={busy || !changes.trim()}
            onClick={() =>
              void run(
                async () => {
                  await addComment(id, changes.trim())
                  await patchTask(id, { status: 'ready' })
                },
                k.inbox.done.sentBack,
                'changes_requested',
                changes
              )
            }
          >
            <Codicon name="reply" size="0.8rem" />
            {k.inbox.sendBack}
          </Button>
          <Button onClick={() => setChanges(null)} variant="ghost">
            {k.inbox.cancel}
          </Button>
          <OpenButton {...props} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ReasonField onChange={setReason} value={reason} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        {tile(
          <Button
            className="w-full bg-(--ui-green) text-white hover:bg-(--ui-green)/90"
            disabled={busy}
            onClick={() => void run(() => patchTask(id, { status: 'done' }), k.inbox.done.approved, 'approved', reason)}
          >
            <Codicon name="check" size="0.85rem" />
            {k.inbox.approve}
          </Button>,
          INBOX.choice.approve,
          agentSays.approve
        )}
        {tile(
          <Button className="w-full" disabled={busy} onClick={() => setChanges('')} variant="outline">
            <Codicon name="reply" size="0.85rem" />
            {k.inbox.requestChanges}
          </Button>,
          INBOX.choice.changes,
          agentSays.decline
        )}
      </div>
      <OpenButton {...props} />
    </div>
  )
}

function BlockedActions(props: ActionProps) {
  const { item, k } = props
  const settle = useSettle()
  const [reason, setReason] = useState('')

  const unblock = async () => {
    if (await settle(() => patchTask(item.task!.id, { status: 'ready' }), k.inbox.done.unblocked)) {
      await journalDecision(item.task!.id, 'unblocked', reason)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ReasonField onChange={setReason} value={reason} />
      <div className="flex items-center gap-2">
        <Button onClick={() => void unblock()} size="sm" variant="outline">
          <Codicon name="debug-continue" size="0.75rem" />
          {k.inbox.unblock}
        </Button>
        <OpenButton {...props} />
      </div>
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

/** The title and the one-line question a list row and the detail show for a thing in the Inbox. */
function cardText(item: InboxItem, k: KanbanText, agent?: AgentControl): { ask: string; title: string } {
  const decision = !!item.task && DECISION_KINDS.has(item.kind)
  const said = decision ? parseDecision(item.task!.latest_summary || item.task!.body) : null
  const ask = said?.ask || (item.kind === 'question' ? said?.report : '') || itemBody(item, k, agent)

  const title =
    item.kind === 'budget' ? INBOX.budgetTitle(item.agent) : item.task?.title || item.finding?.task_title || item.agent

  return { ask: ask ?? '', title }
}

function InboxDetail({
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
  const Actions = ACTIONS[item.kind]
  const agent = controls?.agents.find(entry => entry.profile === item.agent)
  const { title } = cardText(item, k, agent)

  return (
    <DetailPanel
      item={item}
      k={k}
      key={item.id}
      later={() => $inboxSnoozed.set(snooze($inboxSnoozed.get(), item.id))}
      title={title}
    >
      {item.task && DECISION_KINDS.has(item.kind) ? (
        <DecisionDetails item={item} />
      ) : (
        <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-(--ui-text-secondary)">
          {itemBody(item, k, agent)}
        </p>
      )}
      <Actions agent={agent} item={item} k={k} onOpen={onOpen} />
    </DetailPanel>
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
  const focus = useValue($inboxFocus)
  const [filter, setFilter] = useState<'all' | InboxKind>('all')
  const [chosen, setChosen] = useState<null | string>(null)
  const items = buildInbox(board, controls, snoozed, Date.now(), extras)
  const counts = countByKind(items)
  const shown = filter === 'all' ? items : items.filter(item => item.kind === filter)

  // Arriving from the Chat ("Answer in Inbox"): open on that task, once.
  useEffect(() => {
    const match = focus ? items.find(item => item.task?.id === focus) : undefined

    if (match) {
      setFilter('all')
      setChosen(match.id)
      $inboxFocus.set(null)
    }
  }, [focus, items])

  const current = shown.find(item => item.id === chosen) ?? shown[0]

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

  if (!items.length) {
    return (
      <div className="grid flex-1 place-items-center px-4" data-kanban-inbox="">
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-(--ui-stroke-secondary) px-10 py-12 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-(--ui-green)/12 text-(--ui-green)">
            <Codicon name="check-all" size="1.1rem" />
          </span>
          <p className="text-[0.9375rem] font-medium text-foreground">{k.inbox.emptyTitle}</p>
          <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{k.inbox.emptyBody}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-4 pt-3 pb-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:overflow-hidden"
      data-kanban-inbox=""
    >
      <aside className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
        <header className="flex flex-col gap-0.5 px-1">
          <h2 className="text-xl font-semibold text-foreground">{k.inbox.title}</h2>
          <p className="text-[0.875rem] text-(--ui-text-secondary)">{k.inbox.subtitle(items.length)}</p>
        </header>
        <div className="flex flex-wrap gap-1">
          {chip('all', k.inbox.all, items.length)}
          {INBOX_KINDS.filter(kind => counts[kind] > 0).map(kind => chip(kind, k.inbox.kinds[kind], counts[kind]))}
        </div>
        <ol className="flex flex-col gap-1">
          {shown.map((item, index) => {
            const agent = controls?.agents.find(entry => entry.profile === item.agent)
            const { ask, title } = cardText(item, k, agent)

            return (
              <ListRow
                active={item.id === current?.id}
                ask={ask}
                first={index === 0}
                item={item}
                k={k}
                key={item.id}
                onSelect={() => setChosen(item.id)}
                title={title}
              />
            )
          })}
        </ol>
      </aside>
      <main className="min-h-0 lg:overflow-y-auto">
        {current && <InboxDetail controls={controls} item={current} k={k} onOpen={onOpen} />}
      </main>
    </div>
  )
}
