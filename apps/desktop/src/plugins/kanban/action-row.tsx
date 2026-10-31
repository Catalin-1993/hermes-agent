/**
 * The Overview's two lists — what may be stuck (Watchdog) and what waits on you (Needs you) — share one panel and
 * one row, so they read the same way: an icon in the kind's colour; the title, with how long ago on the right;
 * under it, the kind, who it concerns and the one-line detail; the buttons that settle it on the far right.
 */

import { cn, Codicon } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'

import { ago, Avatar } from './ui'

export function Panel({
  children,
  count,
  icon,
  link,
  note,
  title,
  tone
}: {
  children?: ReactNode
  count?: number
  icon: string
  /** A quiet "open the full list" on the right of the heading. */
  link?: ReactNode
  /** One line beside the title (an "all clear", a summary). */
  note?: string
  title: string
  tone: string
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated)">
      <header className="flex min-h-11 items-center gap-2 px-3.5 py-2">
        <Codicon name={icon} size="0.9rem" style={{ color: tone }} />
        <h3 className="text-[0.75rem] font-semibold tracking-[0.06em] text-(--ui-text-secondary) uppercase">{title}</h3>
        {count !== undefined && count > 0 && (
          <span
            className="rounded-full px-1.5 text-[0.6875rem] font-semibold tabular-nums"
            style={{ backgroundColor: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}
          >
            {count}
          </span>
        )}
        {note && <span className="truncate text-[0.75rem] text-(--ui-text-tertiary)">{note}</span>}
        {link && <span className="ml-auto shrink-0">{link}</span>}
      </header>
      {children}
    </section>
  )
}

export function RowList({ children }: { children: ReactNode }) {
  return (
    <ul className="flex flex-col divide-y divide-(--ui-stroke-tertiary) border-t border-(--ui-stroke-tertiary)">
      {children}
    </ul>
  )
}

export function ActionRow({
  actions,
  agent,
  detail,
  icon,
  id,
  kind,
  since,
  title,
  tone
}: {
  actions?: ReactNode
  agent?: null | string
  detail?: string
  icon: string
  id: string
  kind: string
  since?: number
  title: string
  tone: string
}) {
  return (
    <li
      className="group flex items-center gap-3 px-3.5 py-2 transition-colors hover:bg-(--ui-bg-quinary)"
      data-action-row={id}
    >
      <span
        className="grid size-7 shrink-0 place-items-center rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}
      >
        <Codicon name={icon} size="0.9rem" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-foreground">{title}</span>
          {since ? (
            <span className="ml-auto shrink-0 text-[0.6875rem] text-(--ui-text-quaternary) tabular-nums">
              {ago(since)}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-(--ui-text-tertiary)">
          <span className="shrink-0 font-medium" style={{ color: tone }}>
            {kind}
          </span>
          {agent && (
            <span className="inline-flex shrink-0 items-center gap-1">
              <span className="text-(--ui-text-quaternary)">·</span>
              <Avatar name={agent} size="0.875rem" />
              {agent}
            </span>
          )}
          {detail && (
            <span className={cn('min-w-0 truncate')}>
              <span className="text-(--ui-text-quaternary)">· </span>
              {detail}
            </span>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </li>
  )
}
