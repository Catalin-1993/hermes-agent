/**
 * The watchdog's findings on screen: what looks stuck, in words, with the action that unsticks it —
 * restart a silent or runaway card, wake the dispatcher for one nobody took, open the agent that is
 * spending fast, or open the card. The Overview shows them all as a panel; the Inbox lists the ones
 * that need a decision (`inbox-model`).
 */

import { Button, Codicon, host, useQueryClient, useValue } from '@hermes/plugin-sdk'

import {
  $agentFile,
  $boardSlug,
  boardKeyPrefix,
  nudgeDispatcher,
  reclaimTask,
  useKanbanScope,
  watchdogKey
} from './api'
import { useWatchdog } from './team-queries'
import type { WatchFinding, WatchKind } from './types'
import { ago, Avatar, errText, type KanbanText, usd, useKanban } from './ui'

export const WATCH_META: Record<WatchKind, { icon: string; tone: string }> = {
  budget_pace: { icon: 'credit-card', tone: '#fb923c' },
  failing: { icon: 'error', tone: '#f87171' },
  slow: { icon: 'watch', tone: '#fbbf24' },
  stalled: { icon: 'debug-disconnect', tone: '#f87171' },
  unclaimed: { icon: 'inbox', tone: '#a78bfa' },
  waiting: { icon: 'history', tone: 'var(--ui-text-tertiary)' }
}

const SHOWN: Record<WatchKind, (value: number) => string> = {
  budget_pace: usd,
  failing: value => String(Math.round(value)),
  slow: value => value.toFixed(1),
  stalled: value => String(Math.round(value)),
  unclaimed: value => String(Math.round(value)),
  waiting: value => String(Math.round(value))
}

/** The finding in one sentence. */
export const watchDetail = (k: KanbanText, finding: WatchFinding) =>
  k.watch.detail[finding.kind](SHOWN[finding.kind](finding.value))

/** The one action that unsticks a finding, or null when opening the card is all there is. */
export function WatchAction({ finding, k }: { finding: WatchFinding; k: KanbanText }) {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  const run = async (write: () => Promise<unknown>, done: string) => {
    try {
      await write()
      host.notify({ kind: 'success', message: done })
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })
    }

    void qc.invalidateQueries({ queryKey: watchdogKey(scope, slug) })
    void qc.invalidateQueries({ queryKey: boardKeyPrefix(scope) })
  }

  if (finding.kind === 'stalled' || finding.kind === 'slow') {
    return (
      <Button onClick={() => void run(() => reclaimTask(finding.task_id), k.watch.restarted)} size="sm" variant="outline">
        <Codicon name="debug-restart" size="0.75rem" />
        {k.watch.restart}
      </Button>
    )
  }

  if (finding.kind === 'unclaimed') {
    return (
      <Button onClick={() => void run(nudgeDispatcher, k.watch.nudged)} size="sm" variant="outline">
        <Codicon name="rocket" size="0.75rem" />
        {k.watch.nudge}
      </Button>
    )
  }

  if (finding.kind === 'budget_pace') {
    return (
      <Button onClick={() => $agentFile.set(finding.profile)} size="sm" variant="outline">
        <Codicon name="person" size="0.75rem" />
        {k.watch.openAgent}
      </Button>
    )
  }

  return null
}

function Row({ finding, k, onOpen }: { finding: WatchFinding; k: KanbanText; onOpen: (id: string) => void }) {
  const meta = WATCH_META[finding.kind]

  return (
    <li className="flex items-start gap-2.5 py-2" data-watch={finding.id}>
      <span
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
      >
        <Codicon name={meta.icon} size="0.8rem" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-1.5 text-[0.75rem]">
          <span className="font-medium" style={{ color: meta.tone }}>
            {k.watch.kinds[finding.kind]}
          </span>
          <span className="truncate text-foreground">{finding.task_title || finding.profile}</span>
          {finding.profile && finding.task_title && (
            <span className="inline-flex items-center gap-1 text-(--ui-text-tertiary)">
              <Avatar name={finding.profile} size="0.875rem" />
              {finding.profile}
            </span>
          )}
          {finding.since > 0 && <span className="text-(--ui-text-quaternary)">· {ago(finding.since)}</span>}
        </div>
        <p className="text-[0.75rem] text-(--ui-text-tertiary)">{watchDetail(k, finding)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <WatchAction finding={finding} k={k} />
        {finding.task_id && (
          <Button onClick={() => onOpen(finding.task_id)} size="sm" variant="ghost">
            {k.watch.open}
          </Button>
        )}
      </div>
    </li>
  )
}

/** The Overview's watchdog panel: a green "all clear", or every finding with its action. */
export function WatchdogPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const k = useKanban()
  const { data } = useWatchdog()

  if (!data) {
    return null
  }

  const findings = data.findings
  const tone = findings.length ? '#f87171' : 'var(--ui-green)'

  return (
    <section
      className="flex flex-col gap-1 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) px-3.5 py-3"
      data-kanban-watchdog=""
    >
      <header className="flex items-center gap-2">
        <Codicon name={findings.length ? 'pulse' : 'pass-filled'} size="0.9rem" style={{ color: tone }} />
        <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-(--ui-text-tertiary)">
          {k.watch.title}
        </span>
        <span className="text-[0.75rem] text-(--ui-text-secondary)">
          {findings.length ? k.watch.count(findings.length) : k.watch.allClear}
        </span>
      </header>
      {findings.length > 0 && (
        <ul className="flex flex-col divide-y divide-(--ui-stroke-tertiary)">
          {findings.slice(0, 8).map(finding => (
            <Row finding={finding} k={k} key={finding.id} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  )
}
