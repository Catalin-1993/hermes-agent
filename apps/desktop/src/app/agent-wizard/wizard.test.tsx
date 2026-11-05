/** New agent: five steps with a live card, Create Agent makes the profile and only the changes on top. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hermesApi } from '@/api/client'
import { $gateway } from '@/store/gateway'

import { NewAgentDialog } from './wizard'

vi.mock('@/api/client', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hermesApi: vi.fn(async () => ({}))
}))

vi.mock('@/store/notifications', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notify: vi.fn(() => ''),
  notifyError: vi.fn()
}))

vi.mock('@/store/profile', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  refreshProfiles: vi.fn(async () => [])
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

const onClose = vi.fn()

beforeEach(() => {
  $gateway.set({ request } as never)
})

afterEach(() => {
  cleanup()
  request.mockClear()
  onClose.mockClear()
  vi.mocked(hermesApi).mockClear()
  $gateway.set(null)
})

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NewAgentDialog onClose={onClose} open profiles={[{ name: 'lead' }]} />
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

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const methods = request.mock.calls.map(([method]) => method)
    expect(methods).toEqual(['profiles.describe', 'profiles.create', 'profiles.configure', 'cli.exec'])
    expect(request).toHaveBeenCalledWith('profiles.configure', { enabled_toolsets: ['web'], name: 'scout' })
    expect(request).toHaveBeenCalledWith('cli.exec', {
      argv: ['-p', 'scout', 'config', 'set', 'memory.memory_enabled', 'false']
    })
    expect(hermesApi).not.toHaveBeenCalled()
  })
})
