/**
 * The wizard's two trips to the backend: reading what a new agent starts with (the default profile, which it is
 * cloned from) and carrying out Create Agent's plan. The profile is made first; every later step is its own write,
 * so one that fails is reported by name while the agent still exists and can be finished from its page.
 */

import { hermesApi } from '@/api/client'
import { $gateway } from '@/store/gateway'

import type { CreatePlan, Toggle, WizardBase } from './model'

const KANBAN = '/api/plugins/kanban'

/** One gateway call (the same door the rest of the app uses). */
function request<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const gateway = $gateway.get()

  return gateway ? gateway.request<T>(method, params) : Promise.reject(new Error('Brain gateway unavailable'))
}

// The team routes live on the Kanban backend, which serves them whether or not the Kanban page is switched on.
const saveProfileOrg = (name: string, body: { reports_to?: string; title?: string }) =>
  hermesApi({ body, method: 'PATCH', path: `${KANBAN}/profiles/${encodeURIComponent(name)}/org` })

const saveRhythm = (profile: string, body: object) =>
  hermesApi({ body, method: 'PUT', path: `${KANBAN}/rhythm/${encodeURIComponent(profile)}` })

const setControl = (body: { monthly_budget_usd: number; profile: string }) =>
  hermesApi({ body, method: 'POST', path: `${KANBAN}/controls` })

interface Described {
  mcp_servers?: { enabled: boolean; name: string; transport?: string }[]
  skills?: { enabled: boolean; name: string }[]
  toolsets?: { description?: string; enabled: boolean; label?: string; name: string; tool_count?: number }[]
}

const byName = (a: Toggle, b: Toggle) => (a.label ?? a.name).localeCompare(b.label ?? b.name)

export async function fetchWizardBase(): Promise<WizardBase> {
  const described = await request<Described>('profiles.describe', { name: 'default' })

  return {
    integrations: (described.mcp_servers ?? [])
      .map(server => ({ description: server.transport, enabled: server.enabled, name: server.name }))
      .sort(byName),
    skills: (described.skills ?? []).map(skill => ({ enabled: skill.enabled, name: skill.name })).sort(byName),
    toolsets: (described.toolsets ?? []).map(toolset => ({
      count: toolset.tool_count,
      description: toolset.description,
      enabled: toolset.enabled,
      label: toolset.label || toolset.name,
      name: toolset.name
    }))
  }
}

/** Steps that did not save, by name (empty = everything landed). */
export async function runPlan(plan: CreatePlan): Promise<string[]> {
  await request('profiles.create', plan.create)
  const missed: string[] = []

  const step = async (label: string, write: () => Promise<unknown>) => {
    try {
      await write()
    } catch {
      missed.push(label)
    }
  }

  if (Object.keys(plan.configure).length) {
    await step('tools', async () => {
      const result = await request<{ ok?: boolean }>('profiles.configure', { name: plan.name, ...plan.configure })

      if (result.ok === false) {
        throw new Error('not applied')
      }
    })
  }

  for (const [key, value] of plan.sets) {
    await step(key, async () => {
      const result = await request<{ code?: number }>('cli.exec', {
        argv: ['-p', plan.name, 'config', 'set', key, value]
      })

      if (result.code !== 0) {
        throw new Error('config set failed')
      }
    })
  }

  if (plan.org.title || plan.org.reports_to) {
    await step('team place', () => saveProfileOrg(plan.name, plan.org))
  }

  if (plan.budget !== null) {
    await step('budget', () => setControl({ monthly_budget_usd: plan.budget!, profile: plan.name }))
  }

  if (plan.rhythm) {
    await step('schedule', () => saveRhythm(plan.name, plan.rhythm!))
  }

  return missed
}
