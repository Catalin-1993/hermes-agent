/**
 * Workflows — a canvas of steps that start from a trigger: Agent, LLM, Condition, Approval, Answer
 * and Output, plus text, notes and shapes on the board. A full page with a sidebar row and a palette
 * entry; its data and its runs come from the plugin's own router
 * (`plugins/workflows/dashboard/plugin_api.py`), and every run goes on in its own process.
 *
 * Ships OFF by default: it waits in Capabilities ▸ Plugins and registers nothing until the owner
 * turns it on. While on, it announces what a run needs or did — an approval waiting, an answer to
 * give, a run that ended, an Output step's notification — wherever the owner is in the app.
 */

import {
  type HermesPlugin,
  host,
  PALETTE_AREA,
  type PaletteContribution,
  type RouteContribution,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  type SidebarNavContribution
} from '@hermes/plugin-sdk'

import { bindWorkflowsApi, fetchEvents, type WorkflowEvent } from './api'
import { COPY } from './copy'
import { WorkflowsPage } from './page'

export const WORKFLOWS_ROUTE = '/workflows'

const POLL_MS = 15_000

function announce(event: WorkflowEvent, seen: Set<string>) {
  const key = `${event.run_id}:${event.type}:${event.status ?? event.node_id ?? ''}`

  if (seen.has(key)) {
    return
  }

  seen.add(key)
  const action = { label: COPY.notify.open, onClick: () => host.navigate(WORKFLOWS_ROUTE) }

  if (event.type === 'notification') {
    host.notify({ action, kind: 'info', message: event.message ?? '', title: event.workflow })

    return
  }

  const messages: Partial<Record<string, () => void>> = {
    failed: () =>
      host.notify({
        action,
        detail: event.error ?? undefined,
        kind: 'error',
        message: COPY.notify.failed(event.workflow)
      }),
    succeeded: () => host.notify({ action, kind: 'success', message: COPY.notify.succeeded(event.workflow) }),
    waiting: () => host.notify({ action, kind: 'warning', message: COPY.notify.waiting(event.workflow) })
  }

  messages[event.status ?? '']?.()
}

function startAnnouncer(): () => void {
  let since = Date.now() / 1000
  const seen = new Set<string>()
  let stopped = false

  const tick = async () => {
    try {
      const events = await fetchEvents(since)

      for (const event of events) {
        announce(event, seen)
        since = Math.max(since, event.at ?? since)
      }
    } catch {
      // The backend may be restarting; the next tick tries again.
    }
  }

  const timer = setInterval(() => !stopped && void tick(), POLL_MS)

  return () => {
    stopped = true
    clearInterval(timer)
  }
}

const plugin: HermesPlugin = {
  id: 'workflows',
  name: 'Workflows',
  description:
    'A canvas of steps that start from a trigger: agents, LLM prompts, conditions, approvals, answers and notifications, run by your own agents and schedules.',
  defaultEnabled: false,
  register(ctx) {
    ctx.onDispose(bindWorkflowsApi(ctx.rest))
    ctx.onDispose(startAnnouncer())

    ctx.registerMany([
      {
        id: 'page',
        area: ROUTES_AREA,
        data: { path: WORKFLOWS_ROUTE } satisfies RouteContribution,
        render: () => <WorkflowsPage />
      },
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        order: 42,
        data: { codicon: 'type-hierarchy-sub', label: COPY.nav, path: WORKFLOWS_ROUTE } satisfies SidebarNavContribution
      },
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: 'workflows.open',
          label: COPY.openPage,
          keywords: ['workflow', 'workflows', 'flux', 'automatizare', 'canvas', 'pași', 'aprobare'],
          run: () => host.navigate(WORKFLOWS_ROUTE)
        } satisfies PaletteContribution
      }
    ])
  }
}

export default plugin
