/**
 * The Inbox's two halves: on the left a short to-do list (what kind of thing, the title, the question in a line;
 * the first says "Start here"), on the right the chosen one in full — a "What to do" line, the details and the
 * buttons to settle it.
 */

import { atom, cn, Codicon } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'

import { INBOX } from './inbox-copy'
import type { InboxItem } from './inbox-model'
import type { InboxKind } from './inbox-model'
import { ago, Avatar, type KanbanText } from './ui'

/** A task the Inbox should open on next (set by the Chat's "Answer in Inbox"); cleared once the Inbox reads it. */
export const $inboxFocus = atom<null | string>(null)

export const KIND_META: Record<InboxKind, { icon: string; tone: string }> = {
  blocked: { icon: 'error', tone: '#f87171' },
  budget: { icon: 'credit-card', tone: '#fb923c' },
  problem: { icon: 'warning', tone: '#f87171' },
  question: { icon: 'comment-discussion', tone: '#60a5fa' },
  review: { icon: 'eye', tone: '#fbbf24' },
  watch: { icon: 'pulse', tone: '#a78bfa' }
}

/** One line of the Inbox's to-do list: the title with how long ago, then the kind and who asks, then the question. */
export function ListRow({
  active,
  ask,
  first,
  item,
  k,
  onSelect,
  title
}: {
  active: boolean
  ask: string
  first: boolean
  item: InboxItem
  k: KanbanText
  onSelect: () => void
  title: string
}) {
  const meta = KIND_META[item.kind]

  return (
    <li data-inbox-item={item.id}>
      <button
        aria-current={active ? 'true' : undefined}
        className={cn(
          'relative flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
          active
            ? 'bg-(--ui-bg-elevated) shadow-[inset_0_0_0_1px_var(--ui-stroke-secondary)]'
            : 'hover:bg-(--chrome-action-hover)'
        )}
        onClick={onSelect}
        type="button"
      >
        {active && (
          <span
            aria-hidden
            className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full"
            style={{ backgroundColor: meta.tone }}
          />
        )}
        <span
          className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
        >
          <Codicon name={meta.icon} size="0.85rem" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-foreground">{title}</span>
            {item.since > 0 && (
              <span className="ml-auto shrink-0 text-[0.6875rem] text-(--ui-text-quaternary) tabular-nums">
                {ago(item.since)}
              </span>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[0.6875rem]">
            <span className="shrink-0 font-semibold" style={{ color: meta.tone }}>
              {k.inbox.badge[item.kind]}
            </span>
            {item.agent && <span className="truncate text-(--ui-text-tertiary)">· {item.agent}</span>}
            {first && (
              <span className="ml-auto shrink-0 rounded bg-(--ui-control-active-background) px-1.5 text-[0.625rem] font-medium text-foreground">
                {INBOX.startHere}
              </span>
            )}
          </span>
          {ask && <span className="line-clamp-1 text-[0.75rem] text-(--ui-text-tertiary)">{ask}</span>}
        </span>
      </button>
    </li>
  )
}

/** The chosen thing in full, on the right: a heading, "What to do", the details and the buttons. */
export function DetailPanel({
  children,
  item,
  k,
  later,
  title
}: {
  children: ReactNode
  item: InboxItem
  k: KanbanText
  later: () => void
  title: string
}) {
  const meta = KIND_META[item.kind]

  return (
    <article
      className="flex flex-col overflow-hidden rounded-2xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated)"
      data-inbox-detail={item.id}
    >
      <header
        className="flex flex-col gap-2 border-b border-(--ui-stroke-tertiary) px-6 pt-5 pb-4"
        style={{
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${meta.tone} 8%, transparent), transparent)`
        }}
      >
        <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold"
            style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 15%, transparent)`, color: meta.tone }}
          >
            <Codicon name={meta.icon} size="0.8rem" />
            {k.inbox.badge[item.kind]}
          </span>
          {item.agent && (
            <span className="inline-flex items-center gap-1.5 text-(--ui-text-secondary)">
              <Avatar name={item.agent} size="1rem" />
              {item.agent}
            </span>
          )}
          {item.since > 0 && <span className="text-(--ui-text-quaternary)">· {ago(item.since)}</span>}
          <button
            className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground"
            onClick={later}
            type="button"
          >
            <Codicon name="watch" size="0.8rem" />
            {k.inbox.later}
          </button>
        </div>
        <h2 className="text-[1.25rem] leading-snug font-semibold tracking-tight text-foreground">{title}</h2>
        {item.heldBy && (
          <span className="flex items-center gap-1.5 text-[0.75rem] text-(--ui-text-tertiary)">
            <Codicon name="law" size="0.8rem" />
            {k.rules.heldBy(item.heldBy)}
          </span>
        )}
      </header>
      <div className="flex flex-col gap-5 px-6 py-5">
        <p
          className="flex items-start gap-2.5 rounded-lg border-l-[3px] px-3.5 py-2.5 text-[0.875rem] leading-snug text-foreground"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 8%, transparent)`, borderLeftColor: meta.tone }}
        >
          <Codicon className="mt-0.5 shrink-0" name="arrow-right" size="1rem" style={{ color: meta.tone }} />
          <span>
            <span className="font-semibold">{INBOX.whatToDo}: </span>
            {INBOX.hint[item.kind]}
          </span>
        </p>
        {children}
      </div>
    </article>
  )
}
