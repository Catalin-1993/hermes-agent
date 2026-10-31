import { describe, expect, it } from 'vitest'

import { isOwner, lastMessage, teamFeed, threadLines } from './chat-model'

const comment = (id: number, author: string, body: string, created_at: number) => ({ author, body, created_at, id })
const event = (id: number, kind: string, created_at: number) => ({ created_at, id, kind, payload: null })

describe('threadLines', () => {
  it('puts messages and work events in time order, the owner marked as mine', () => {
    const lines = threadLines(
      't1',
      [comment(1, 'analist', 'Am preluat BTC.', 20), comment(2, 'dashboard', 'Mulțumesc!', 40)],
      [event(1, 'claimed', 10), event(2, 'heartbeat', 15), event(3, 'completed', 50)]
    )

    expect(lines.map(line => line.id)).toEqual(['e1', 'c1', 'c2', 'e3'])
    expect(lines.find(line => line.id === 'c2')).toMatchObject({ kind: 'message', mine: true })
    expect(lines.find(line => line.id === 'c1')).toMatchObject({ mine: false })
  })
})

describe('teamFeed', () => {
  it('merges threads oldest first and keeps the newest lines', () => {
    const a = threadLines('a', [comment(1, 'x', 'one', 10), comment(2, 'x', 'three', 30)], [])
    const b = threadLines('b', [comment(3, 'y', 'two', 20)], [])

    expect(teamFeed([a, b], 10).map(line => line.at)).toEqual([10, 20, 30])
    expect(teamFeed([a, b], 2).map(line => line.at)).toEqual([20, 30])
  })
})

describe('owner and last message', () => {
  it('knows the owner by the app author name, and finds the newest message', () => {
    expect(isOwner('dashboard')).toBe(true)
    expect(isOwner('risc')).toBe(false)
    expect(lastMessage(threadLines('t', [comment(1, 'x', 'hi', 5)], [event(1, 'completed', 9)]))?.id).toBe('c1')
    expect(lastMessage([])).toBeNull()
  })
})
