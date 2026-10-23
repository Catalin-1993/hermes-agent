/**
 * Goals and the agent rhythm do what they show: a goal's ring is its done share and "Plan with" hands
 * it to its owner, a new goal saves what was typed, and the Rhythm tab turns the check-ins on and
 * asks for one now. Real components, only the REST layer mocked.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Test harness supplies the host's locale registration, as plugin loading does.
// eslint-disable-next-line no-restricted-imports
import { registerPluginLocales } from '@/i18n/plugin-i18n'

import type * as KanbanApi from './api'
import { checkInNow, planGoal, saveGoal, saveRhythm } from './api'
import { daysUntil } from './goals-view'
import { useKanban } from './i18n'
import { KANBAN_LOCALES } from './i18n'
import { perDay, RhythmTab } from './rhythm-tab'
import { TeamViewBody } from './team-views'
import type { BoardGoal, KanbanBoard } from './types'

const goal: BoardGoal = {
  blocked: 0,
  cards: [
    { assignee: 'sef', completed_at: 1, created_by: null, id: 'a', status: 'done', title: 'Plan rebalansare' },
    { assignee: 'analist', completed_at: null, created_by: null, id: 'b', status: 'ready', title: 'Vinde 10% ETH' }
  ],
  created_at: 0,
  done: 1,
  id: 3,
  linked: ['a'],
  open: 1,
  owner: 'sef',
  percent: 50,
  running: 0,
  status: 'active',
  target_date: null,
  title: 'Portofoliu rebalansat',
  total: 2,
  why: 'Riscul e prea concentrat'
}

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  checkInNow: vi.fn(async () => ({})),
  fetchGoals: vi.fn(async () => ({ goals: [goal] })),
  fetchProfiles: vi.fn(async () => ({
    profiles: ['sef', 'analist'].map(name => ({ description: '', description_auto: false, is_default: false, name }))
  })),
  fetchRhythms: vi.fn(async () => ({ rhythms: {} })),
  planGoal: vi.fn(async () => ({ goals: [goal], task_id: 'p' })),
  saveGoal: vi.fn(async () => ({ goals: [goal] })),
  saveRhythm: vi.fn(async (profile: string, patch: object) => ({ ...patch, profile }))
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

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
  )

function Rhythm() {
  return <RhythmTab k={useKanban()} name="analist" onOpen={() => undefined} />
}

describe('goals', () => {
  it('shows the done share and hands the goal to its owner to plan', async () => {
    wrap(<TeamViewBody board={board} onOpen={() => undefined} view="goals" />)

    expect(await screen.findByText('50%')).toBeTruthy()
    expect(screen.getByText('1 of 2 cards done')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Plan with sef' }))

    await waitFor(() => expect(planGoal).toHaveBeenCalledWith(3))
  })

  it('saves a new goal with what was typed', async () => {
    wrap(<TeamViewBody board={board} onOpen={() => undefined} view="goals" />)

    fireEvent.click(await screen.findByRole('button', { name: 'New goal' }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Bring the portfolio back to the plan'), {
      target: { value: 'Randament 8% pe an' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))

    await waitFor(() =>
      expect(saveGoal).toHaveBeenCalledWith(
        { owner: null, status: 'active', target_date: null, title: 'Randament 8% pe an', why: '' },
        undefined
      )
    )
  })

  it('counts days to a target date from today', () => {
    expect(daysUntil('2026-10-30', new Date(2026, 9, 23, 18))).toBe(7)
    expect(daysUntil('2026-10-20', new Date(2026, 9, 23))).toBe(-3)
  })
})

describe('rhythm', () => {
  it('turns the check-ins on and asks for one now', async () => {
    wrap(<Rhythm />)

    fireEvent.click(await screen.findByRole('switch', { name: 'Check in regularly' }))
    await waitFor(() => expect(saveRhythm).toHaveBeenCalledWith('analist', { enabled: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Check in now' }))
    await waitFor(() => expect(checkInNow).toHaveBeenCalledWith('analist'))
  })

  it('counts the check-ins a day within the active hours', () => {
    expect(perDay({ end_hour: 20, every_minutes: 240, start_hour: 8 })).toBe(3)
    expect(perDay({ end_hour: 0, every_minutes: 60, start_hour: 0 })).toBe(24)
    expect(perDay({ end_hour: 2, every_minutes: 120, start_hour: 22 })).toBe(2)
  })
})
