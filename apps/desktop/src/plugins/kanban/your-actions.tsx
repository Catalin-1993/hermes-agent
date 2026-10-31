/**
 * "Needs you" on the Overview: what waits on the owner, beside the Watchdog and in the same rows — the kind, who
 * asks, the question in a line, and "Review", which opens it in the Inbox with everything to settle it.
 */

import { Button, Codicon, useValue } from '@hermes/plugin-sdk'

import { ActionRow, Panel, RowList } from './action-row'
import { $boardView, $inboxSnoozed } from './api'
import { DECISION_KINDS } from './decision-card'
import { parseDecision } from './decision-model'
import { itemBody, useControls, useInboxExtras } from './inbox'
import { $inboxFocus, KIND_META } from './inbox-card'
import { INBOX } from './inbox-copy'
import { buildInbox, type InboxItem } from './inbox-model'
import { PROJECT } from './project-copy'
import type { AgentControl, KanbanBoard } from './types'
import { type KanbanText, useKanban } from './ui'

const SHOWN = 5

const openInInbox = (taskId: null | string) => {
  $inboxFocus.set(taskId)
  $boardView.set('inbox')
}

function rowText(item: InboxItem, k: KanbanText, agent?: AgentControl) {
  const decision = !!item.task && DECISION_KINDS.has(item.kind)
  const ask = (decision && parseDecision(item.task!.latest_summary || item.task!.body).ask) || itemBody(item, k, agent)

  const title =
    item.kind === 'budget' ? INBOX.budgetTitle(item.agent) : item.task?.title || item.finding?.task_title || item.agent

  return { ask, title }
}

export function YourActions({ board }: { board: KanbanBoard }) {
  const k = useKanban()
  const { data: controls } = useControls()
  const extras = useInboxExtras()
  const snoozed = useValue($inboxSnoozed)
  const items = buildInbox(board, controls, snoozed, Date.now(), extras)
  const copy = PROJECT.actions

  return (
    <div data-your-actions="">
      <Panel
        count={items.length}
        icon="bell-dot"
        link={
          items.length > 0 && (
            <Button className="h-7 text-[0.75rem]" onClick={() => openInInbox(null)} size="sm" variant="ghost">
              {items.length > SHOWN ? copy.more(items.length - SHOWN) : copy.inbox}
              <Codicon name="arrow-right" size="0.75rem" />
            </Button>
          )
        }
        note={items.length ? undefined : copy.empty}
        title={copy.title}
        tone={items.length ? '#f87171' : 'var(--ui-green)'}
      >
        {items.length > 0 && (
          <RowList>
            {items.slice(0, SHOWN).map(item => {
              const meta = KIND_META[item.kind]
              const agent = controls?.agents.find(entry => entry.profile === item.agent)
              const { ask, title } = rowText(item, k, agent)

              return (
                <ActionRow
                  actions={
                    <Button
                      className="h-7"
                      onClick={() => openInInbox(item.task?.id ?? null)}
                      size="sm"
                      variant="outline"
                    >
                      {copy.review}
                    </Button>
                  }
                  agent={item.kind === 'budget' ? null : item.agent}
                  detail={ask}
                  icon={meta.icon}
                  id={item.id}
                  key={item.id}
                  kind={k.inbox.badge[item.kind]}
                  since={item.since}
                  title={title}
                  tone={meta.tone}
                />
              )
            })}
          </RowList>
        )}
      </Panel>
    </div>
  )
}
