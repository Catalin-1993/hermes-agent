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

/** One line of the Inbox's to-do list: what kind of thing, who asks, the title and the question in a line. */
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
          'flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
          active
            ? 'border-(--ui-stroke-secondary) bg-(--ui-bg-elevated) shadow-[0_1px_2px_rgb(0_0_0/0.3)]'
            : 'border-transparent hover:bg-(--chrome-action-hover)'
        )}
        onClick={onSelect}
        style={active ? { boxShadow: `inset 3px 0 0 ${meta.tone}` } : undefined}
        type="button"
      >
        <span
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
        >
          <Codicon name={meta.icon} size="0.95rem" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[0.75rem]">
            <span className="font-semibold" style={{ color: meta.tone }}>
              {k.inbox.badge[item.kind]}
            </span>
            {first && (
              <span className="rounded-full bg-(--ui-control-active-background) px-1.5 text-[0.625rem] font-medium text-foreground">
                {INBOX.startHere}
              </span>
            )}
            {item.since > 0 && <span className="ml-auto shrink-0 text-(--ui-text-quaternary)">{ago(item.since)}</span>}
          </span>
          <span className="truncate text-[0.875rem] font-semibold text-foreground">{title}</span>
          {ask && <span className="line-clamp-2 text-[0.8125rem] leading-snug text-(--ui-text-tertiary)">{ask}</span>}
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
        className="flex items-start gap-3.5 border-b border-(--ui-stroke-tertiary) px-5 py-4"
        style={{
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${meta.tone} 9%, transparent), transparent)`
        }}
      >
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 16%, transparent)`, color: meta.tone }}
        >
          <Codicon name={meta.icon} size="1.2rem" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 text-[0.8125rem]">
            <span className="font-semibold" style={{ color: meta.tone }}>
              {k.inbox.badge[item.kind]}
            </span>
            {item.agent && (
              <span className="inline-flex items-center gap-1 text-(--ui-text-tertiary)">
                <Avatar name={item.agent} size="0.9375rem" />
                {item.agent}
              </span>
            )}
            {item.since > 0 && <span className="text-(--ui-text-quaternary)">{ago(item.since)}</span>}
          </span>
          <h2 className="text-[1.25rem] leading-snug font-semibold text-foreground">{title}</h2>
          {item.heldBy && (
            <span className="flex items-center gap-1.5 text-[0.8125rem] text-(--ui-text-tertiary)">
              <Codicon name="law" size="0.85rem" />
              {k.rules.heldBy(item.heldBy)}
            </span>
          )}
        </div>
        <button
          className="shrink-0 cursor-pointer text-[0.8125rem] text-(--ui-text-tertiary) underline-offset-2 hover:text-foreground hover:underline"
          onClick={later}
          type="button"
        >
          {k.inbox.later}
        </button>
      </header>
      <div className="flex flex-col gap-5 px-5 py-5">
        <p
          className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[0.9375rem] leading-snug text-foreground"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 10%, transparent)` }}
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
