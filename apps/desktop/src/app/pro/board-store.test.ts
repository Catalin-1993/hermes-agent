/** Brain (Pro Mode): the project's git history is read inside the chat on screen (the canonical gateway asks for
 *  one), a reply cut off mid-way still becomes a map, and with no chat open the person is told what to do. */
import { afterEach, describe, expect, it, vi } from 'vitest'

const gateway = vi.hoisted(() => ({ calls: [] as { method: string; params: Record<string, unknown> }[] }))

vi.mock('@/store/active-route-request', () => ({
  requestGatewayForActiveRoute: async (_profile: string, method: string, params: Record<string, unknown>) => {
    gateway.calls.push({ method, params })

    return { code: 0, stdout: method === 'shell.exec' ? '2026-11-23 feat: Pro panel' : '' }
  }
}))

const oneshot = vi.hoisted(() => ({ replies: [] as string[] }))

vi.mock('@/lib/oneshot', () => ({ requestOneShot: async () => oneshot.replies.shift() ?? '' }))

const { $activeSessionId } = await import('@/store/session')
const { $boardErrors, $projectMaps, writeProjectMap } = await import('./board-store')

afterEach(() => {
  gateway.calls = []
  $activeSessionId.set(null)
  $projectMaps.set({})
  $boardErrors.set({})
})

describe('project map', () => {
  it('reads git inside the chat on screen and keeps a map whose reply was cut off', async () => {
    $activeSessionId.set('run-1')
    oneshot.replies.push('{"idea": "A personal agent.", "milestones": [{"name": "HUD", "done": true}, {"name": "Pro pa')

    const map = await writeProjectMap('/Users/cata/brain')

    expect(gateway.calls.every(call => call.params.session_id === 'run-1')).toBe(true)
    expect(gateway.calls[0]?.params.command).toContain("git -C '/Users/cata/brain'")
    expect(map?.idea).toBe('A personal agent.')
    expect(map?.milestones[0]).toEqual({ done: true, name: 'HUD' })
  })

  it('asks once more when the first reply is unreadable', async () => {
    $activeSessionId.set('run-1')
    oneshot.replies.push('Sorry, here is the map you asked for.', '{"idea": "Second try."}')

    expect((await writeProjectMap('/p'))?.idea).toBe('Second try.')
  })

  it('says to open a chat when none is on screen, instead of failing with invalid params', async () => {
    await writeProjectMap('/p')

    expect($boardErrors.get()['map:/p']).toMatch(/Open a chat/)
    expect(gateway.calls).toEqual([])
  })
})
