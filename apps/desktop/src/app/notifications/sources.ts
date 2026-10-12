import { translateNow } from '@/i18n'
import { sessionTitle } from '@/lib/chat-runtime'
import { formatDuration } from '@/lib/statusbar'
import { markFeedSessionRead, recordFeedItem } from '@/store/notification-feed'
import { $cronSessions } from '@/store/session'
import { sessionOwnerRouteFromRow } from '@/store/session-request-router'
import { $focusedRuntimeId, $focusedStoredSessionId, storedSessionIdForRuntimeId } from '@/store/session-states'
import { $subagentsBySession, type SubagentProgress } from '@/store/subagents'
import { isAuxiliaryWindow } from '@/store/windows'

/** Epoch ms, whatever the source wrote (session rows carry seconds). */
const asMs = (at: number) => (at < 1e12 ? at * 1000 : at)

const windowFocused = () => typeof document !== 'undefined' && document.hasFocus()

const watching = (runtimeId: string) => runtimeId === $focusedRuntimeId.get() && windowFocused()

function agentDetail(agent: SubagentProgress): string | undefined {
  const parts = [
    agent.filesWritten.length > 0 ? translateNow('notificationFeed.filesWritten', agent.filesWritten.length) : '',
    agent.durationSeconds ? formatDuration(agent.durationSeconds * 1000) : ''
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : undefined
}

/**
 * The feed's two sources that never pass through a notification — scheduled-job runs (each run is its
 * own `source: 'cron'` session, listed as it ends; its preview is what the job produced) and agents
 * finishing their tasks — and the one way a row reads itself: looking at its session, by opening it
 * from anywhere or by coming back to the window it is focused in. Only what ends after the window
 * opened counts: history is not news. Started once by the controller, in the primary window.
 */
export function watchFeedSources(openedAt = Date.now()): () => void {
  if (isAuxiliaryWindow()) {
    return () => undefined
  }

  const reportedRuns = new Set<string>()
  const settledAgents = new Set<string>()

  const stopRuns = $cronSessions.subscribe(rows => {
    for (const row of rows) {
      if (reportedRuns.has(row.id) || !row.ended_at || asMs(row.ended_at) < openedAt) {
        continue
      }

      reportedRuns.add(row.id)
      recordFeedItem({
        body: row.preview ?? undefined,
        key: row.id,
        kind: 'scheduled',
        target: { kind: 'session', owner: sessionOwnerRouteFromRow(row), storedSessionId: row.id },
        title: sessionTitle(row)
      })
    }
  })

  const stopAgents = $subagentsBySession.subscribe(bySession => {
    for (const [runtimeId, agents] of Object.entries(bySession)) {
      for (const agent of agents) {
        if (settledAgents.has(agent.id) || (agent.status !== 'completed' && agent.status !== 'failed')) {
          continue
        }

        settledAgents.add(agent.id)

        if (asMs(agent.updatedAt) < openedAt || watching(runtimeId)) {
          continue
        }

        const parent = storedSessionIdForRuntimeId(runtimeId)
        const opens = agent.sessionId || parent

        recordFeedItem({
          body: agent.summary,
          detail: agentDetail(agent),
          failed: agent.status === 'failed',
          key: agent.id,
          kind: 'agent',
          target: opens ? { kind: 'session', storedSessionId: opens } : undefined,
          title: agent.goal
        })
      }
    }
  })

  const seeFocused = () => {
    const storedId = $focusedStoredSessionId.get()

    if (storedId && windowFocused()) {
      markFeedSessionRead(storedId)
    }
  }

  const stopSeeing = $focusedStoredSessionId.subscribe(seeFocused)
  window.addEventListener('focus', seeFocused)

  return () => {
    stopRuns()
    stopAgents()
    stopSeeing()
    window.removeEventListener('focus', seeFocused)
  }
}
