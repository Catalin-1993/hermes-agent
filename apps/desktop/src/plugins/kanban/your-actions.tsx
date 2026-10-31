/**
 * "Your actions" on the Overview: what waits on the owner, right under the project header — each decision
 * with who asks, why, and a button into it. The Inbox keeps the full actions (answer, approve, send back);
 * this is the short list, so the first thing you see is what to do next.
 */

import { Button, cn, Codicon, useValue } from '@hermes/plugin-sdk'

import { $boardView, $inboxSnoozed } from './api'
import { DECISION_KINDS } from './decision-card'
import { parseDecision } from './decision-model'
import { itemBody, useControls, useInboxExtras } from './inbox'
import { $inboxFocus, KIND_META } from './inbox-card'
import { INBOX } from './inbox-copy'
import { buildInbox } from './inbox-model'
import { PROJECT } from './project-copy'
import type { KanbanBoard } from './types'
import { ago, Avatar, useKanban } from './ui'

const SHOWN = 4

export function YourActions({
  board,
  compact = false
}: {
  board: KanbanBoard
  /** Inside a panel (the Overview's row): lighter rows, no outer cards. */
  compact?: boolean
}) {
  const k = useKanban()
  const { data: controls } = useControls()
  const extras = useInboxExtras()
  const snoozed = useValue($inboxSnoozed)
  const items = buildInbox(board, controls, snoozed, Date.now(), extras)
  const copy = PROJECT.actions
  const openInbox = () => $boardView.set('inbox')

  return (
    <section
      className={cn(
        'flex flex-col',
        compact ? 'gap-1 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) px-3.5 py-3' : 'gap-3'
      )}
      data-your-actions=""
    >
      <header className="flex items-center gap-2">
        {compact && <Codicon className="text-[#f87171]" name="bell-dot" size="0.9rem" />}
        <h3 className="text-[0.75rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
          {copy.title}
        </h3>
        {items.length > 0 && (
          <span className="rounded-full bg-(--ui-control-active-background) px-1.5 text-[0.6875rem] font-medium text-foreground tabular-nums">
            {items.length}
          </span>
        )}
      </header>
      {items.length ? (
        <ul className={cn('flex flex-col', compact ? 'divide-y divide-(--ui-stroke-tertiary)' : 'gap-2')}>
          {items.slice(0, SHOWN).map(item => {
            const meta = KIND_META[item.kind]
            const agent = controls?.agents.find(entry => entry.profile === item.agent)

            return (
              <li
                className={cn(
                  'flex items-center gap-3.5',
                  compact ? 'py-2.5' : 'rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3.5'
                )}
                data-action-item={item.id}
                key={item.id}
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
                >
                  <Codicon name={meta.icon} size="1rem" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-(--ui-text-tertiary)">
                    <span className="font-semibold" style={{ color: meta.tone }}>
                      {k.inbox.badge[item.kind]}
                    </span>
                    {item.agent && (
                      <span className="inline-flex items-center gap-1">
                        <Avatar name={item.agent} size="0.875rem" />
                        {item.agent}
                      </span>
                    )}
                    {item.since > 0 && <span className="text-(--ui-text-quaternary)">{ago(item.since)}</span>}
                  </span>
                  <span className="truncate text-[0.9375rem] font-medium text-foreground">
                    {item.kind === 'budget'
                      ? INBOX.budgetTitle(item.agent)
                      : item.task?.title || item.finding?.task_title || item.agent}
                  </span>
                  <span className="line-clamp-2 text-[0.8125rem] text-(--ui-text-secondary)">
                    {(item.task &&
                      DECISION_KINDS.has(item.kind) &&
                      parseDecision(item.task.latest_summary || item.task.body).ask) ||
                      itemBody(item, k, agent)}
                  </span>
                </div>
                <Button
                  onClick={() => {
                    // The Inbox opens on this one, with everything to settle it.
                    $inboxFocus.set(item.task?.id ?? null)
                    openInbox()
                  }}
                  size="sm"
                  variant="outline"
                >
                  {copy.review}
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-(--ui-stroke-secondary) px-4 py-4">
          <span className="grid size-9 place-items-center rounded-full bg-(--ui-green)/12 text-(--ui-green)">
            <Codicon name="check-all" size="1rem" />
          </span>
          <span className="flex flex-col">
            <span className="text-[0.875rem] font-medium text-foreground">{copy.empty}</span>
            <span className="text-[0.75rem] text-(--ui-text-tertiary)">{copy.emptyHint}</span>
          </span>
        </div>
      )}
      {items.length > 0 && (
        <div>
          <Button onClick={openInbox} size="sm" variant="ghost">
            {items.length > SHOWN ? copy.more(items.length - SHOWN) : copy.inbox}
            <Codicon name="arrow-right" size="0.8rem" />
          </Button>
        </div>
      )}
    </section>
  )
}
