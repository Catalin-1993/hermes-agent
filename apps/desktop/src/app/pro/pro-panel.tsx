/**
 * Brain (Pro Mode): the right-hand panel — the agent on top (small: face and name), a slim bar of three tabs under
 * it, and the tab's page:
 * - Progress: where the work stands — Where we are, Catch me up, steps, the chat's whiteboard, the Project map.
 * - Activity: what the agent sees and does, step by step, and the tools and skills it uses.
 * - Changes: one row — All files, then the review's scopes (Uncommitted, Branch, Last turn) — over the app's own
 *   review (diffs, commit, push) or the file tree.
 *
 * It wears the sidebar surface exactly as the Files pane does: transparent on a docked rail, so the window's
 * lit-from-the-top gradient runs behind it, while a narrow window's floating column paints its own opaque fill.
 */

import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { FilesPane, ReviewPaneContent } from '@/app/contrib/panes'
import { selectScope } from '@/app/right-sidebar/review/scope-row'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $reviewScope } from '@/store/review'

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
      className="mx-auto flex w-full max-w-72 gap-0.5 rounded-full bg-(--ui-bg-quaternary,var(--chrome-action-hover)) p-0.5"
      data-slot="pro-tabs"
      role="tablist"
    >
      {TABS.map(tab => (
        <button
          aria-selected={tab.id === value}
          className={cn(
            'flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 text-[0.6875rem] transition-colors',
            tab.id === value
              ? 'bg-(--ui-bg-elevated,var(--ui-bg-editor)) text-foreground shadow-sm'
              : 'text-(--ui-text-tertiary) hover:text-foreground'
          )}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          role="tab"
          type="button"
        >
          <Codicon className="shrink-0" name={tab.icon} size="0.8125rem" />
          <span className="max-w-full truncate">{t.pro.tabs[tab.id]}</span>
        </button>
      ))}
    </div>
  )
}

type ChangesView = 'branch' | 'files' | 'lastTurn' | 'uncommitted'

/** One row for the whole tab: All files first, then the review's three scopes (it hides its own scope row here). */
function ChangesTab() {
  const { t } = useI18n()
  const c = t.statusStack.coding
  const scope = useStore($reviewScope)
  const [files, setFiles] = useState(false)

  const pick = (view: ChangesView) => {
    setFiles(view === 'files')

    if (view !== 'files') {
      selectScope(view)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-slot="pro-changes">
      <div className="px-3">
        <Segmented<ChangesView>
          onChange={pick}
          options={[
            { label: t.pro.allFiles, value: 'files' },
            { label: c.scopeUncommitted, value: 'uncommitted' },
            { label: c.scopeBranch, value: 'branch' },
            { label: c.scopeLastTurn, value: 'lastTurn' }
          ]}
          value={files ? 'files' : scope}
        />
      </div>
      <div className="min-h-0 flex-1">{files ? <FilesPane /> : <ReviewPaneContent />}</div>
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
      <div className="shrink-0 px-3 pt-1.5 pb-2">
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
