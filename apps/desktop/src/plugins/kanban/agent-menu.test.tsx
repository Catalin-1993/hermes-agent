/** The composer's "+" menu offers each agent, and picking one writes its @mention into the message. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgentMenuRows, mentionOf } from './agent-menu'
import type * as KanbanApi from './api'

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  fetchProfiles: vi.fn(async () => ({
    profiles: [
      { description: '', description_auto: false, is_default: true, name: 'default' },
      { description: '', description_auto: false, display_name: 'Setter', is_default: false, name: 'setter' },
      { description: '', description_auto: false, is_default: false, name: 'max' }
    ]
  }))
}))

afterEach(cleanup)

describe('agent rows in the composer menu', () => {
  it('adds one row per agent (not the default one) and inserts its @mention when picked', async () => {
    const dispose = vi.fn()
    const register = vi.fn(() => dispose)

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AgentMenuRows register={register} />
      </QueryClientProvider>
    )

    await waitFor(() => expect(register).toHaveBeenCalledTimes(2))

    const rows = register.mock.calls.map(call => call[0] as { data: { label: string; run: (c: unknown) => void } })

    expect(rows.map(row => row.data.label)).toEqual(['Agent: Setter', 'Agent: max'])

    const insertText = vi.fn()

    rows[0]!.data.run({ insertText })
    expect(insertText).toHaveBeenCalledWith('@setter ')
  })

  it('writes @hermes for the default profile', () => {
    expect(mentionOf({ is_default: true, name: 'default' })).toBe('hermes')
    expect(mentionOf({ is_default: false, name: 'max' })).toBe('max')
  })
})
