/**
 * Brain (Pro Mode): the right-hand panel — the agent on top (pet or photo, name, what it is doing, Stop), a bar of
 * three icon tabs under it, and the tab's page:
 * - Progress: where the work stands — Where we are, Catch me up, steps, the chat's whiteboard, the Project map.
 * - Activity: what the agent sees and does, step by step, and the tools and skills it uses.
 * - Changes: the app's own review (diffs, commit, push) and, one tap away and back, all the files.
 *
 * It wears the sidebar surface exactly as the Files pane does: transparent on a docked rail, so the window's
 * lit-from-the-top gradient runs behind it, while a narrow window's floating column paints its own opaque fill.
 */

import { useState } from 'react'

import { FilesPane, ReviewPaneContent } from '@/app/contrib/panes'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import { ActivityTab } from './activity-tab'
import { AgentHeader } from './agent-header'
import { Segmented } from './pro-ui'
import { ProgressTab } from './progress-tab'

type ProTab = 'activity' | 'changes' | 'progress'

const TABS: { icon: string; id: ProTab }[] = [
  { icon: 'checklist', id: 'progress' },
  { icon: 'pulse', id: 'activity' },
  { icon: 'git-compare', id: 'changes' }
]

function IconTabs({ onChange, value }: { onChange: (tab: ProTab) => void; value: ProTab }) {
  const { t } = useI18n()

  return (
    <div
      className="flex gap-0.5 rounded-full bg-(--ui-bg-quaternary,var(--chrome-action-hover)) p-1"
      data-slot="pro-tabs"
      role="tablist"
    >
      {TABS.map(tab => (
        <button
          aria-selected={tab.id === value}
          className={cn(
            'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[0.6875rem] transition-colors',
            tab.id === value
              ? 'bg-(--ui-bg-elevated,var(--ui-bg-editor)) text-foreground shadow-sm'
              : 'text-(--ui-text-tertiary) hover:text-foreground'
          )}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          role="tab"
          type="button"
        >
          <Codicon name={tab.icon} size="1rem" />
          <span className="max-w-full truncate">{t.pro.tabs[tab.id]}</span>
        </button>
      ))}
    </div>
  )
}

function ChangesTab() {
  const { t } = useI18n()
  const [view, setView] = useState<'changed' | 'files'>('changed')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="px-3">
        <Segmented
          onChange={setView}
          options={[
            { label: t.pro.changed, value: 'changed' },
            { label: t.pro.allFiles, value: 'files' }
          ]}
          value={view}
        />
      </div>
      <div className="min-h-0 flex-1">{view === 'changed' ? <ReviewPaneContent /> : <FilesPane />}</div>
    </div>
  )
}

export function ProPanel() {
  const [tab, setTab] = useState<ProTab>('progress')

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-(--ui-sidebar-surface-background)"
      data-slot="pro-panel"
    >
      <AgentHeader />
      <div className="shrink-0 px-3 pt-2 pb-2.5">
        <IconTabs onChange={setTab} value={tab} />
      </div>
      {tab === 'changes' ? (
        <ChangesTab />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {tab === 'progress' ? <ProgressTab /> : <ActivityTab />}
        </div>
      )}
    </div>
  )
}
