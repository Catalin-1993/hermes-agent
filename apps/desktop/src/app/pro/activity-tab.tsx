/**
 * Brain (Pro Mode): the Activity tab — what the agent sees (the page open in the in-app browser it drives), what it
 * is doing step by step, and the tools and skills it is using in this chat.
 */

import { useStore } from '@nanostores/react'

import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { $visiblePreviewTabs, openBrowserTab } from '@/store/preview'

import { useRecentActions } from './activity-model'
import { Card, Dot, Empty } from './pro-ui'

export function ActivityTab() {
  const { t } = useI18n()
  const copy = t.pro.activity
  const page = useStore($visiblePreviewTabs).find(tab => tab.target.kind === 'url')
  const actions = useRecentActions(40)
  const recent = actions.slice(0, 8)
  const using = [...new Set(actions.map(action => action.using))].slice(0, 16)

  return (
    <div className="flex flex-col gap-2.5">
      <Card label={copy.sees}>
        <button
          className="flex min-w-0 items-center gap-2.5 rounded-lg bg-(--ui-bg-elevated,var(--ui-bg-editor)) p-2.5 text-left transition-colors hover:bg-(--chrome-action-hover)"
          onClick={openBrowserTab}
          type="button"
        >
          <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="globe" size="1rem" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[0.8125rem] text-foreground">
              {page ? page.target.label || page.target.url : copy.noPage}
            </span>
            <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
              {page ? page.target.url : copy.openBrowser}
            </span>
          </span>
          <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="arrow-right" size="0.75rem" />
        </button>
      </Card>

      {recent.length > 0 ? (
        <Card label={copy.doing}>
          <ul className="flex flex-col gap-1.5">
            {recent.map(action => (
              <li className="flex items-center gap-2 text-[0.8125rem]" key={action.id}>
                <Dot tone={action.failed ? 'failed' : action.done ? 'done' : 'now'} />
                <span className="min-w-0 truncate text-foreground">{action.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty icon="pulse" text={copy.empty} />
      )}

      {using.length > 0 && (
        <Card label={copy.using}>
          <div className="flex flex-wrap gap-1.5">
            {using.map(name => (
              <span
                className="rounded-md bg-(--ui-bg-elevated,var(--ui-bg-editor)) px-2 py-0.5 text-xs text-(--ui-text-secondary) first-letter:uppercase"
                key={name}
              >
                {name}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
