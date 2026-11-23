/**
 * Brain (Pro Mode): the right-hand panel — four tabs, Board first: Board · Screen · Changes · Context.
 * Changes is the app's own review pane (changed files, diffs, undo), with a way to the full file tree.
 */

import { useState } from 'react'

import { ReviewPaneContent } from '@/app/contrib/panes'
import { revealTreePane } from '@/components/pane-shell/tree/store'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'

import { BoardTab } from './board-tab'
import { ContextTab } from './context-tab'
import { Segmented } from './pro-ui'
import { ScreenTab } from './screen-tab'

type ProTab = 'board' | 'changes' | 'context' | 'screen'

export function ProPanel() {
  const { t } = useI18n()
  const copy = t.pro
  const [tab, setTab] = useState<ProTab>('board')

  return (
    <div className="flex h-full min-h-0 flex-col" data-slot="pro-panel">
      <div className="shrink-0 px-3 pt-2.5 pb-2">
        <Segmented
          onChange={setTab}
          options={[
            { label: copy.tabs.board, value: 'board' },
            { label: copy.tabs.screen, value: 'screen' },
            { label: copy.tabs.changes, value: 'changes' },
            { label: copy.tabs.context, value: 'context' }
          ]}
          value={tab}
        />
      </div>
      {tab === 'changes' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <button
            className="mx-3 mb-1.5 flex shrink-0 items-center gap-1.5 self-start rounded-md px-1.5 py-0.5 text-xs text-(--ui-text-tertiary) hover:text-foreground"
            onClick={() => revealTreePane('files')}
            type="button"
          >
            <Codicon name="files" size="0.75rem" />
            {copy.allFiles}
          </button>
          <div className="min-h-0 flex-1">
            <ReviewPaneContent />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {tab === 'board' ? <BoardTab /> : tab === 'screen' ? <ScreenTab /> : <ContextTab />}
        </div>
      )}
    </div>
  )
}
