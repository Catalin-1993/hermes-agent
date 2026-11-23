/** Brain (Pro Mode): model replies become a board, a map and a catch-up — and a bad reply never breaks the panel. */
import { describe, expect, it } from 'vitest'

import {
  catchUpOf,
  chatBoardOf,
  jsonObjectOf,
  projectMapOf,
  sectionsInput,
  shellQuote,
  transcriptInput
} from './board-model'

describe('Pro board model', () => {
  it('reads a board out of a reply with prose around it, capping each list and dropping junk', () => {
    const reply = `Here you go:\n${JSON.stringify({
      done: ['Menu without lines', 42, '', 'Wake word'],
      failed: 'not a list',
      next: Array.from({ length: 9 }, (_, i) => `step ${i}`),
      talked: ['Safe for personal data'],
      where: 'The right panel is being built.'
    })}\nThanks`

    const board = chatBoardOf(reply, 12, 1000)

    expect(board).toEqual({
      at: 1000,
      basis: 12,
      notes: {
        done: ['Menu without lines', 'Wake word'],
        failed: [],
        next: ['step 0', 'step 1', 'step 2', 'step 3', 'step 4', 'step 5'],
        now: [],
        talked: ['Safe for personal data']
      },
      where: 'The right panel is being built.'
    })
    expect(chatBoardOf('no json at all', 3)).toBeNull()
    expect(jsonObjectOf('[1, 2]')).toBeNull()
  })

  it('reads a project map, keeping only known branch states and named rows', () => {
    const map = projectMapOf(
      JSON.stringify({
        branches: [
          { name: 'main-kbw61z', note: 'Everything shipped', state: 'merged' },
          { name: 'feat/local-voice', note: 'Needs tests', state: 'weird' },
          { note: 'no name' }
        ],
        decisions: [{ date: '2026-11-22', text: 'Sherpa for the wake word' }],
        idea: 'A personal agent that is easy to follow.',
        milestones: [
          { done: true, name: 'HUD' },
          { done: 'yes', name: 'Right panel' }
        ]
      }),
      5
    )

    expect(map?.branches).toEqual([
      { name: 'main-kbw61z', note: 'Everything shipped', state: 'merged' },
      { name: 'feat/local-voice', note: 'Needs tests', state: 'active' }
    ])
    expect(map?.milestones).toEqual([
      { done: true, name: 'HUD' },
      { done: false, name: 'Right panel' }
    ])
    expect(map?.parked).toEqual([])
  })

  it('reads a catch-up with a sentence of detail per item', () => {
    const result = catchUpOf(
      JSON.stringify({
        items: [
          { detail: 'Say “Hey Brain” to start talking.', status: 'done', title: 'Wake word works' },
          { detail: 'Waiting for your test on the Mac.', status: 'later', title: 'Recorder test' }
        ],
        summary: 'Two things moved forward.'
      }),
      100,
      200
    )

    expect(result).toEqual({
      at: 200,
      items: [
        { detail: 'Say “Hey Brain” to start talking.', status: 'done', title: 'Wake word works' },
        { detail: 'Waiting for your test on the Mac.', status: 'next', title: 'Recorder test' }
      ],
      since: 100,
      summary: 'Two things moved forward.'
    })
  })

  it('keeps the newest messages within budget and quotes paths for the shell', () => {
    const input = transcriptInput(
      [
        { role: 'user', text: 'old '.repeat(5000) },
        { role: 'assistant', text: 'Done: the menu is simpler.' },
        { role: 'user', text: 'Great, next the panel.' }
      ],
      ['[completed] Menu']
    )

    expect(input).toContain('Agent: Done: the menu is simpler.')
    expect(input).toContain('Person: Great, next the panel.')
    expect(input).toContain('- [completed] Menu')
    expect(sectionsInput({ Empty: '  ', Log: 'a' })).toBe('## Log\na')
    expect(shellQuote("/Users/cata/it's here")).toBe(`'/Users/cata/it'\\''s here'`)
  })
})
