/**
 * The pieces of the Chat page, drawn the way Hermes' own chat draws a conversation: your messages in the app's user
 * bubble on the right, an agent's answer as plain text under its name, what happened to a task as a quiet line in
 * the middle, and the floating composer at the bottom.
 */

import {
  cn,
  Codicon,
  MessageTextContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea
} from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import { CHAT } from './chat-copy'
import { type AgentPick, type ChatLine, isQuestion } from './chat-model'
import type { KanbanTask } from './types'
import { ago, Avatar, useKanban } from './ui'

export const AUTO = '__auto__'

/** Lines of one author on one task, close together, read as one message: only the first carries the name. */
export function startsGroup(line: ChatLine, prev: ChatLine | undefined) {
  if (!prev || prev.kind !== 'message' || line.kind !== 'message') {
    return true
  }

  return prev.author !== line.author || prev.taskId !== line.taskId || line.at - prev.at > 300
}

function TaskChip({ onThread, title }: { onThread?: () => void; title?: string }) {
  if (!title) {
    return null
  }

  return (
    <button
      className="max-w-56 cursor-pointer truncate rounded-md px-1.5 py-px text-[0.6875rem] text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground"
      onClick={onThread}
      type="button"
    >
      {CHAT.on(title)}
    </button>
  )
}

function Markdown({ text }: { text: string }) {
  return (
    <div
      className="min-w-0 text-[0.875rem] leading-relaxed text-foreground [&_.aui-md>:first-child]:mt-0 [&_.aui-md>:last-child]:mb-0"
      data-selectable-text="true"
    >
      <MessageTextContent media={false} text={text} />
    </div>
  )
}

export function Line({
  head,
  line,
  onThread,
  role,
  title
}: {
  head: boolean
  line: ChatLine
  onThread?: () => void
  role?: string
  title?: string
}) {
  const k = useKanban()

  if (line.kind === 'event') {
    return (
      <div className="flex items-center justify-center gap-1.5 py-0.5 text-[0.6875rem] text-(--ui-text-quaternary)">
        <span>{k.overview.feed[line.event]}</span>
        {title && <span className="max-w-60 truncate text-(--ui-text-tertiary)">{title}</span>}
        <span>· {ago(line.at)}</span>
      </div>
    )
  }

  if (line.mine) {
    return (
      <div className={cn('flex flex-col items-end gap-1', head && 'mt-2')}>
        <div className="standalone-glass max-w-[80%] rounded-xl border bg-(--dt-user-bubble) px-3 py-2 text-left text-[0.875rem] leading-relaxed whitespace-pre-line text-foreground">
          {line.body}
        </div>
        <span className="flex items-center gap-1 text-[0.6875rem] text-(--ui-text-quaternary)">
          <TaskChip onThread={onThread} title={title} />
          {ago(line.at)}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-2.5', head && 'mt-2')}>
      <span className="w-6 shrink-0">{head && <Avatar name={line.author} size="1.5rem" />}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {head && (
          <span className="flex min-w-0 items-center gap-1.5 text-[0.75rem]">
            <span className="font-semibold text-foreground">{line.author}</span>
            {role && <span className="truncate text-(--ui-text-tertiary)">{role}</span>}
            <span className="text-(--ui-text-quaternary)">· {ago(line.at)}</span>
            <TaskChip onThread={onThread} title={title} />
          </span>
        )}
        <Markdown text={line.body} />
      </div>
    </div>
  )
}

/** One row of the left list: a lead (avatar or icon), a name, a quiet second line. */
export function ListRow({
  active,
  dot,
  lead,
  name,
  note,
  onSelect,
  testId
}: {
  active: boolean
  dot?: boolean
  lead: ReactNode
  name: string
  note: string
  onSelect: () => void
  testId?: string
}) {
  return (
    <button
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
        active ? 'bg-(--ui-control-active-background)' : 'hover:bg-(--chrome-action-hover)'
      )}
      data-chat-thread={testId}
      onClick={onSelect}
      type="button"
    >
      {lead}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-foreground">{name}</span>
          {dot && <span className="size-1.5 shrink-0 rounded-full bg-[#ef4444]" />}
        </span>
        <span className="block truncate text-[0.6875rem] text-(--ui-text-tertiary)">{note}</span>
      </span>
    </button>
  )
}

/** A message as one plain line for the list: markdown marks dropped. */
const plain = (text: string) =>
  text
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const lastText = (last: ChatLine | null, fallback: string) =>
  last && last.kind === 'message' ? `${last.mine ? CHAT.you : last.author}: ${plain(last.body)}` : fallback

export function TaskLead({ task }: { task: KanbanTask }) {
  if (isQuestion(task.title)) {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-(--ui-bg-tertiary) text-(--ui-text-secondary)">
        <Codicon name="question" size="0.8rem" />
      </span>
    )
  }

  return task.assignee ? (
    <Avatar name={task.assignee} size="1.5rem" />
  ) : (
    <Codicon className="size-6 shrink-0" name="circle-outline" size="0.9rem" />
  )
}

export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="px-2 pt-3 pb-1 text-[0.625rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
    {children}
  </div>
)

function routeNote(pick: AgentPick | null) {
  if (!pick) {
    return ''
  }

  const why =
    pick.why === 'mention' ? CHAT.named : pick.why === 'lead' ? CHAT.lead : CHAT.because(pick.matched.join(', '))

  return `${CHAT.goesTo(pick.agent)} · ${why}`
}

export interface ComposerProps {
  agents: string[]
  /** Who a team question goes to, worked out from the text (team mode only). */
  route: (text: string) => AgentPick | null
  onSend: (text: string, to: string) => Promise<string | void>
  placeholder: string
  team: boolean
}

/** Hermes' floating composer: the text, then a row of controls ending in the round send button. */
export function Composer({ agents, onSend, placeholder, route, team }: ComposerProps) {
  const [text, setText] = useState('')
  const [to, setTo] = useState(AUTO)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState(false)
  const ready = Boolean(text.trim()) && !busy
  const pick = team && to === AUTO && text.trim() ? route(text) : null

  const send = async () => {
    setBusy(true)
    setNote('')

    try {
      setNote((await onSend(text.trim(), to)) ?? '')
      setError(false)
      setText('')
    } catch (failure) {
      setNote(failure instanceof Error ? failure.message : String(failure))
      setError(true)
    }

    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="rounded-xl border border-(--composer-stroke) bg-(--composer-fill) shadow-(--composer-float-shadow)">
        <Textarea
          aria-label={placeholder}
          className="max-h-40 min-h-11 resize-none border-0 bg-transparent px-3 pt-2.5 pb-1 text-[0.875rem] shadow-none focus-visible:ring-0"
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && ready) {
              event.preventDefault()
              void send()
            }
          }}
          placeholder={placeholder}
          value={text}
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          {team && (
            <Select onValueChange={setTo} value={to}>
              <SelectTrigger
                aria-label={CHAT.to}
                className="h-7 max-w-56 rounded-full border-(--ui-stroke-tertiary) bg-transparent px-2.5 text-[0.75rem]"
              >
                <span className="mr-1 text-(--ui-text-tertiary)">{CHAT.to}</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO}>{CHAT.auto}</SelectItem>
                {agents.map(agent => (
                  <SelectItem key={agent} value={agent}>
                    {agent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-(--ui-text-tertiary)">{routeNote(pick)}</span>
          <button
            aria-label={CHAT.send}
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/90 disabled:cursor-default disabled:bg-foreground/30"
            disabled={!ready}
            onClick={() => void send()}
            type="button"
          >
            <Codicon name="arrow-up" size="0.875rem" />
          </button>
        </div>
      </div>
      {note && (
        <span className={cn('px-1 text-[0.6875rem]', error ? 'text-destructive' : 'text-(--ui-text-tertiary)')}>
          {note}
        </span>
      )}
    </div>
  )
}
