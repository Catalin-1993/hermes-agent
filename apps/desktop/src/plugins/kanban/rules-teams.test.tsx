/**
 * The Rules view and the ready-made teams do what they show: a quick-start preset saves the rule it
 * names, a rule's switch turns it off in place, and the team gallery creates the team the owner
 * picked. Real components, only the REST layer mocked.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Test harness supplies the host's locale registration, as plugin loading does.
// eslint-disable-next-line no-restricted-imports
import { registerPluginLocales } from '@/i18n/plugin-i18n'

import type * as KanbanApi from './api'
import { installTeam, saveRule } from './api'
import { KANBAN_LOCALES } from './i18n'
import { TeamViewBody } from './team-views'
import type { BoardRule, KanbanBoard, RulesState, TeamTemplate } from './types'

const rule: BoardRule = {
  action: 'verifier',
  agents: ['analist'],
  enabled: true,
  id: 7,
  keywords: [],
  min_priority: null,
  name: 'Risk checks the analyst',
  verifier: 'risc'
}

const state: RulesState = { holds: {}, rules: [rule] }

const investing: TeamTemplate = {
  icon: 'graph-line',
  id: 'investing',
  members: [
    { budget_usd: 10, description: 'Leads', exists: false, name: 'invest-lead', reports_to: '', title: 'Head of investments' },
    { budget_usd: 15, description: 'Analyses', exists: true, name: 'market-analyst', reports_to: 'invest-lead', title: 'Market analyst' }
  ],
  rules: [{ action: 'owner', name: 'Buy or sell decisions need my approval' }]
}

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  fetchActivity: vi.fn(async () => ({ by_profile: {}, days: [], events: [], now: 0, success_rate: null, totals: {} })),
  fetchControls: vi.fn(async () => ({ agents: [], all_paused: false, all_paused_at: null, month_start: 0 })),
  fetchProfiles: vi.fn(async () => ({
    profiles: ['analist', 'risc'].map(name => ({ description: '', description_auto: false, is_default: false, name }))
  })),
  fetchRules: vi.fn(async () => state),
  fetchTeamTemplates: vi.fn(async () => ({ templates: [investing] })),
  installTeam: vi.fn(async () => ({ budgets: {}, created: ['invest-lead'], kept: ['market-analyst'], rules: [], template: 'investing' })),
  saveRule: vi.fn(async () => state)
}))

const board: KanbanBoard = { assignees: [], columns: [], latest_event_id: 0, now: 0, tenants: [] }

let disposeLocales: () => void = () => undefined

beforeEach(() => {
  disposeLocales = registerPluginLocales('kanban', KANBAN_LOCALES)
})

afterEach(() => {
  cleanup()
  disposeLocales()
  vi.clearAllMocks()
})

const wrap = (view: 'org' | 'rules') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TeamViewBody board={board} onOpen={() => undefined} view={view} />
    </QueryClientProvider>
  )

describe('rules and ready-made teams', () => {
  it('saves the buy/sell preset as an owner rule watching for trade words', async () => {
    wrap('rules')

    fireEvent.click(await screen.findByRole('button', { name: 'Buy or sell decisions need my approval' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save rule' }))

    await waitFor(() => expect(saveRule).toHaveBeenCalledTimes(1))
    const [saved, id] = vi.mocked(saveRule).mock.calls[0]
    expect(id).toBeUndefined()
    expect(saved.action).toBe('owner')
    expect(saved.keywords).toEqual(expect.arrayContaining(['buy', 'sell', 'cumpăr', 'vând']))
  })

  it("turns a rule off from its switch, keeping the rest of it", async () => {
    wrap('rules')

    fireEvent.click(await screen.findByRole('switch', { name: 'Rule on' }))

    await waitFor(() =>
      expect(saveRule).toHaveBeenCalledWith(
        { action: 'verifier', agents: ['analist'], enabled: false, keywords: [], min_priority: null, name: rule.name, verifier: 'risc' },
        7
      )
    )
  })

  it('creates the picked ready-made team', async () => {
    wrap('org')

    fireEvent.click(await screen.findByRole('button', { name: 'Add a ready-made team' }))
    expect(await screen.findByText('yours already, kept')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create 1 agent' }))

    await waitFor(() => expect(installTeam).toHaveBeenCalledWith('investing'))
  })
})
