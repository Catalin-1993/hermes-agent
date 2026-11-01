/** New agent: five steps with a live card, Create Agent makes the profile and only the changes on top. */
import { host } from '@hermes/plugin-sdk'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentWizard } from './agent-wizard'
import type * as KanbanApi from './api'
import { $agentWizard, saveProfileOrg } from './api'

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof KanbanApi>()),
  saveProfileOrg: vi.fn(async () => ({})),
  saveRhythm: vi.fn(async () => ({})),
  setControl: vi.fn(async () => ({}))
}))

const request = vi.fn(async (method: string) =>
  method === 'profiles.describe'
    ? {
        mcp_servers: [],
        skills: [{ enabled: true, name: 'research' }],
        toolsets: [
          { enabled: true, label: 'Web', name: 'web', tool_count: 3 },
          { enabled: true, label: 'Terminal', name: 'terminal', tool_count: 2 }
        ]
      }
    : method === 'cli.exec'
      ? { code: 0 }
      : { ok: true }
)

beforeEach(() => {
  vi.spyOn(host, 'request').mockImplementation(request as typeof host.request)
  vi.spyOn(host, 'notify').mockImplementation(() => '')
  $agentWizard.set(true)
})

afterEach(() => {
  cleanup()
  request.mockClear()
  vi.restoreAllMocks()
})

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AgentWizard profiles={[{ description: '', description_auto: false, is_default: true, name: 'lead' }]} />
    </QueryClientProvider>
  )

describe('new agent wizard', () => {
  it('asks for a name before creating', () => {
    show()
    fireEvent.click(screen.getAllByText('Create Agent')[0]!)

    expect(screen.getByText('Give the agent a name.')).toBeTruthy()
    expect(request).not.toHaveBeenCalledWith('profiles.create', expect.anything())
  })

  it('fills the card as you go and creates the agent with only what changed', async () => {
    show()
    fireEvent.change(screen.getByPlaceholderText('e.g. Researcher'), { target: { value: 'Scout' } })
    expect(screen.getAllByText('Scout').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('Tools & integrations'))
    await screen.findByText('Terminal')
    fireEvent.click(screen.getByRole('switch', { name: 'Terminal' }))

    fireEvent.click(screen.getByText('Knowledge'))
    fireEvent.click(screen.getByRole('switch', { name: 'Memory' }))

    fireEvent.click(screen.getAllByText('Create Agent')[0]!)

    await waitFor(() => expect($agentWizard.get()).toBe(false))
    const methods = request.mock.calls.map(([method]) => method)
    expect(methods).toEqual(['profiles.describe', 'profiles.create', 'profiles.configure', 'cli.exec'])
    expect(request).toHaveBeenCalledWith('profiles.configure', { enabled_toolsets: ['web'], name: 'scout' })
    expect(request).toHaveBeenCalledWith('cli.exec', {
      argv: ['-p', 'scout', 'config', 'set', 'memory.memory_enabled', 'false']
    })
    expect(saveProfileOrg).not.toHaveBeenCalled()
  })
})
