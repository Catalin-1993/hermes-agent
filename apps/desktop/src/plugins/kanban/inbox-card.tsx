/**
 * One thing in the Inbox, as a card a first-time user can follow: a plain heading (what kind of thing it is, who
 * it is from, how long ago), the task's title, and — once opened — a "What to do" line, the details and the
 * buttons. Closed, a card is one tidy row with the question in a line; the first one starts open and says
 * "Start here".
 */

import { cn, Codicon } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'

import { INBOX } from './inbox-copy'
import type { InboxItem } from './inbox-model'
import type { InboxKind } from './inbox-model'
import { ago, Avatar, type KanbanText } from './ui'

export const KIND_META: Record<InboxKind, { icon: string; tone: string }> = {
  blocked: { icon: 'error', tone: '#f87171' },
  budget: { icon: 'credit-card', tone: '#fb923c' },
  problem: { icon: 'warning', tone: '#f87171' },
  question: { icon: 'comment-discussion', tone: '#60a5fa' },
  review: { icon: 'eye', tone: '#fbbf24' },
  watch: { icon: 'pulse', tone: '#a78bfa' }
}

export function CardShell({
  ask,
  children,
  first,
  item,
  k,
  later,
  onToggle,
  open,
  title
}: {
  ask: string
  children: ReactNode
  first: boolean
  item: InboxItem
  k: KanbanText
  later: () => void
  onToggle: () => void
  open: boolean
  title: string
}) {
  const meta = KIND_META[item.kind]

  return (
    <li
      className="overflow-hidden rounded-2xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated)"
      data-inbox-item={item.id}
    >
      <button
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3.5 p-4 text-left transition-colors hover:bg-(--chrome-action-hover)"
        onClick={onToggle}
        type="button"
      >
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
        >
          <Codicon name={meta.icon} size="1.1rem" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem]">
            <span className="font-semibold" style={{ color: meta.tone }}>
              {k.inbox.badge[item.kind]}
            </span>
            {first && (
              <span className="rounded-full bg-(--ui-control-active-background) px-2 py-px text-[0.6875rem] font-medium text-foreground">
                {INBOX.startHere}
              </span>
            )}
            {item.agent && (
              <span className="inline-flex items-center gap-1 text-(--ui-text-tertiary)">
                <Avatar name={item.agent} size="0.9375rem" />
                {item.agent}
              </span>
            )}
            {item.since > 0 && <span className="text-(--ui-text-quaternary)">{ago(item.since)}</span>}
          </span>
          <span className="text-[1.0625rem] leading-snug font-semibold text-foreground">{title}</span>
          {!open && ask && <span className="line-clamp-1 text-[0.875rem] text-(--ui-text-secondary)">{ask}</span>}
        </span>
        <Codicon
          className="shrink-0 text-(--ui-text-tertiary)"
          name={open ? 'chevron-up' : 'chevron-down'}
          size="1rem"
        />
      </button>
      {open && (
        <div className="flex flex-col gap-5 border-t border-(--ui-stroke-tertiary) px-4 pt-4 pb-4">
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
          {item.heldBy && (
            <p className="-mt-2 flex items-center gap-1.5 text-[0.8125rem] text-(--ui-text-tertiary)">
              <Codicon name="law" size="0.85rem" />
              {k.rules.heldBy(item.heldBy)}
            </p>
          )}
          {children}
          <div className="flex justify-end">
            <button
              className={cn(
                'cursor-pointer text-[0.8125rem] text-(--ui-text-tertiary) underline-offset-2 hover:text-foreground hover:underline'
              )}
              onClick={later}
              type="button"
            >
              {k.inbox.later}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
