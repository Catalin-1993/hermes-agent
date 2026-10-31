/**
 * The Org chart and the agent file do what they show: a card dropped on a manager is saved as
 * reporting there (and a drop that would make a loop saves nothing), a card opens its agent's file
 * with its numbers, and the Instructions tab saves the agent's SOUL.md. Real components, only the
 * REST layer mocked.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Test harness supplies the host's locale registration, as plugin loading does.
// eslint-disable-next-line no-restricted-imports
import { registerPluginLocales } from '@/i18n/plugin-i18n'

import type * as KanbanApi from './api'
import { $agentFile, saveAgentInstructions, saveProfileOrg } from './api'
import { KANBAN_LOCALES } from './i18n'
import { TeamViewBody } from './team-views'
import type { AgentFile, KanbanBoard, KanbanProfile } from './types'

const profile = (name: string, reports_to = '', title = '', reports: string[] = []): KanbanProfile => ({
  description: '',
  description_auto: false,
  is_default: false,
  name,
  reports,
  reports_to,
  title
})

const profiles = [
  profile('sef', '', 'Șef de echipă', ['analist']),
  profile('analist', 'sef', 'Analist'),
  profile('nou')
]

const file: AgentFile = {
  has_instructions: true,
  instructions: 'Fii prudent.',
  now: 1_000,
  open_cards: { ready: 1 },
  profile: 'analist',
  runs: [
    {
      ended_at: 900,
      id: 1,
      note: 'BTC peste medie',
      outcome: 'completed',
      started_at: 600,
      task_id: 't1',
      task_title: 'Analiză BTC'
    }
  ],
  schedule: [],
  stats: { blocked: 0, completed: 3, failed: 1, median_seconds: 300, other: 0, success_rate: 75 },
  toolsets: null,
  window_days: 30
}

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  fetchActivity: vi.fn(async () => ({ by_profile: {}, days: [], events: [], now: 0, success_rate: null, totals: {} })),
  fetchAgentFile: vi.fn(async () => file),
  fetchControls: vi.fn(async () => ({ agents: [], all_paused: false, all_paused_at: null, month_start: 0 })),
  fetchProfiles: vi.fn(async () => ({ profiles })),
  saveAgentInstructions: vi.fn(async () => ({})),
  saveProfileOrg: vi.fn(async () => ({}))
}))

const board: KanbanBoard = { assignees: [], columns: [], latest_event_id: 0, now: 0, tenants: [] }

let disposeLocales: () => void = () => undefined

beforeEach(() => {
  disposeLocales = registerPluginLocales('kanban', KANBAN_LOCALES)
})

afterEach(() => {
  cleanup()
  disposeLocales()
  $agentFile.set(null)
  vi.clearAllMocks()
})

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TeamViewBody board={board} onOpen={() => undefined} view="org" />
    </QueryClientProvider>
  )

// The name also appears in "How your team works"; the card is the one inside [data-org-card].
const card = async (name: string) =>
  (await screen.findAllByText(name)).map(el => el.closest('[data-org-card]')).find(Boolean) as HTMLElement

function drag(from: HTMLElement, to: HTMLElement) {
  const dataTransfer = { dropEffect: '', effectAllowed: '', setData: () => undefined }

  fireEvent.dragStart(from, { dataTransfer })
  fireEvent.dragOver(to, { dataTransfer })
  fireEvent.drop(to, { dataTransfer })
}

describe('org chart', () => {
  it('saves a card dropped on a manager as reporting there', async () => {
    wrap()

    drag(await card('nou'), await card('sef'))

    await waitFor(() => expect(saveProfileOrg).toHaveBeenCalledWith('nou', { reports_to: 'sef' }))
  })

  it('saves nothing for a drop that would put a manager under its own report', async () => {
    wrap()

    drag(await card('sef'), await card('analist'))

    expect(saveProfileOrg).not.toHaveBeenCalled()
  })

  it('opens the agent file with its numbers, and saves its instructions', async () => {
    wrap()

    fireEvent.click(await card('analist'))

    expect(await screen.findByText('75%')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Instructions' }))
    fireEvent.change(await screen.findByDisplayValue('Fii prudent.'), { target: { value: 'Fii foarte prudent.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(saveAgentInstructions).toHaveBeenCalledWith('analist', 'Fii foarte prudent.'))
  })
})
