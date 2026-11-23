/**
 * Brain (Pro Mode): the Context tab — what the agent works with: how full the context is and what the chat has
 * used (the model menu's own Context / Usage header), the tools it called in this chat, and the way to its skills,
 * memory and connectors.
 */

import { useStore } from '@nanostores/react'
import { useNavigate } from 'react-router'

import { ModelUsageHeader } from '@/app/chat/composer/model-usage'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { $currentModel, $messages } from '@/store/session'

import { CAPABILITIES_ROUTE } from '../routes'

import { Card } from './pro-ui'

function useToolsUsed(): string[] {
  const messages = useStore($messages)
  const names = new Set<string>()

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      const tool = part as { toolName?: string; type?: string }

      if (tool.type === 'tool-call' && tool.toolName) {
        names.add(tool.toolName.replace(/^mcp__/, '').replace(/[_.]+/g, ' '))
      }
    }
  }

  return [...names].slice(0, 24)
}

export function ContextTab() {
  const { t } = useI18n()
  const copy = t.pro.context
  const model = useStore($currentModel)
  const tools = useToolsUsed()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-2.5">
      <Card label={copy.model}>
        <p className="truncate text-[0.8125rem] text-foreground">{model || '—'}</p>
      </Card>
      <div className="overflow-hidden rounded-xl bg-(--ui-bg-quaternary,var(--chrome-action-hover))">
        <ModelUsageHeader />
      </div>
      <Card label={copy.toolsUsed}>
        {tools.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tools.map(tool => (
              <span
                className="rounded-md bg-(--ui-bg-elevated,var(--ui-bg-editor)) px-2 py-0.5 text-xs text-(--ui-text-secondary)"
                key={tool}
              >
                {tool}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-(--ui-text-tertiary)">{copy.noTools}</p>
        )}
      </Card>
      <Button className="justify-start gap-2" onClick={() => navigate(CAPABILITIES_ROUTE)} variant="secondary">
        <Codicon name="symbol-misc" size="0.875rem" />
        {copy.capabilities}
        <Codicon className="ml-auto" name="arrow-right" size="0.75rem" />
      </Button>
    </div>
  )
}
