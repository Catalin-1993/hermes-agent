import { describe, expect, it } from 'vitest'

import { answerLine, isOwner, lastMessage, pickAgent, questionTask, teamFeed, threadLines } from './chat-model'

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

describe('pickAgent', () => {
  const team = [
    { name: 'lead', reports: ['designer', 'risc'], title: 'Project lead' },
    { description: 'Draws screens, colors and icons', name: 'designer', reports_to: 'lead', title: 'Product designer' },
    { description: 'Checks the risk of every trade', name: 'risc', reports_to: 'lead', title: 'Risk analyst' }
  ]

  it('sends a question to the agent whose role it is about', () => {
    expect(pickAgent('Ce culori folosim în designul paginii?', team)).toMatchObject({ agent: 'designer', why: 'match' })
    expect(pickAgent('How big is the risk on this trade?', team)).toMatchObject({ agent: 'risc', why: 'match' })
  })

  it('honours a named agent, and falls back to the lead', () => {
    expect(pickAgent('@risc can you look at the icons?', team)).toMatchObject({ agent: 'risc', why: 'mention' })
    expect(pickAgent('Salut, ce mai faceți?', team)).toMatchObject({ agent: 'lead', why: 'lead' })
    expect(pickAgent('anything', [])).toBeNull()
  })
})

describe('questions and answers', () => {
  it('turns a question into a card for the agent, and shows a done card result as its answer', () => {
    const card = questionTask('Ce culori folosim?\nPe scurt.', 'designer')

    expect(card).toMatchObject({ assignee: 'designer', title: 'Question: Ce culori folosim?' })
    expect(card.body).toContain('> Pe scurt.')
    expect(
      answerLine('q', { assignee: 'designer', completed_at: 9, result: 'Albastru.', status: 'done' })
    ).toMatchObject({
      author: 'designer',
      body: 'Albastru.',
      mine: false
    })
    expect(answerLine('q', { assignee: 'designer', result: 'Albastru.', status: 'running' })).toBeNull()
    expect(isOwner('desktop')).toBe(true)
  })
})
