/**
 * Brain (Pro Mode): the Screen tab — what the agent is looking at and doing: its state (working / idle, with Stop),
 * the page open in the in-app browser it drives, and its last actions in plain words.
 */

import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { requestGatewayForActiveRoute } from '@/store/active-route-request'
import { $visiblePreviewTabs, openBrowserTab } from '@/store/preview'
import { $activeGatewayProfile } from '@/store/profile'
import { $activeSessionId, $busy, $messages } from '@/store/session'

import { Card, Dot, Empty } from './pro-ui'

const MAX_ACTIONS = 6

/** The agent's newest tool calls in this chat, newest first, as readable names. */
function useRecentActions(): { done: boolean; id: string; name: string }[] {
  const messages = useStore($messages)
  const actions: { done: boolean; id: string; name: string }[] = []

  for (let i = messages.length - 1; i >= 0 && actions.length < MAX_ACTIONS; i -= 1) {
    const parts = messages[i]?.parts ?? []

    for (let j = parts.length - 1; j >= 0 && actions.length < MAX_ACTIONS; j -= 1) {
      const part = parts[j] as { completedAt?: unknown; toolCallId?: string; toolName?: string; type?: string }

      if (part.type === 'tool-call' && part.toolName) {
        actions.push({
          done: part.completedAt !== undefined,
          id: part.toolCallId ?? `${i}:${j}`,
          name: part.toolName.replace(/^mcp__/, '').replace(/[_.]+/g, ' ')
        })
      }
    }
  }

  return actions
}

export function ScreenTab() {
  const { t } = useI18n()
  const copy = t.pro.screen
  const busy = useStore($busy)
  const sessionId = useStore($activeSessionId)
  const page = useStore($visiblePreviewTabs).find(tab => tab.target.kind === 'url')
  const actions = useRecentActions()

  const stop = () => {
    if (sessionId) {
      void requestGatewayForActiveRoute($activeGatewayProfile.get(), 'session.interrupt', { session_id: sessionId })
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Card label={copy.status}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[0.8125rem] text-foreground">
            <Dot className={busy ? 'animate-pulse' : undefined} tone={busy ? 'now' : 'next'} />
            {busy ? copy.working : copy.idle}
          </span>
          {busy && (
            <Button onClick={stop} size="sm" variant="secondary">
              <span className="size-2 rounded-[2px] bg-(--ui-red,#f85149)" />
              {copy.stop}
            </Button>
          )}
        </div>
      </Card>

      <Card label={copy.browser}>
        {page ? (
          <button
            className="flex min-w-0 items-center gap-2.5 rounded-lg bg-(--ui-bg-elevated,var(--ui-bg-editor)) p-2.5 text-left transition-colors hover:bg-(--chrome-action-hover)"
            onClick={openBrowserTab}
            type="button"
          >
            <Codicon className="text-(--ui-text-tertiary)" name="globe" size="1rem" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[0.8125rem] text-foreground">{page.target.label || page.target.url}</span>
              <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">{page.target.url}</span>
            </span>
            <Codicon className="ml-auto text-(--ui-text-tertiary)" name="arrow-right" size="0.75rem" />
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-(--ui-text-tertiary)">{copy.noPage}</p>
            <Button onClick={openBrowserTab} size="sm" variant="secondary">
              {copy.openBrowser}
            </Button>
          </div>
        )}
      </Card>

      {actions.length > 0 ? (
        <Card label={copy.activity}>
          <ul className="flex flex-col gap-1.5">
            {actions.map(action => (
              <li className="flex items-center gap-2 text-[0.8125rem]" key={action.id}>
                <Dot tone={action.done ? 'done' : 'now'} />
                <span className="truncate text-foreground first-letter:uppercase">{action.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty icon="eye" text={copy.noActivity} />
      )}
    </div>
  )
}
