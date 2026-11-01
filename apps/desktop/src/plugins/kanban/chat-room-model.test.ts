/** The room's arithmetic: threads as roots with replies, who is working, and the notes. */
import { describe, expect, it } from 'vitest'

import type { ChatLine } from './chat-model'
import { approvalKind, roomNotes, threadRoots, workingNames, workingText } from './chat-room-model'
import type { BoardGoal, JournalEntry, KanbanTask } from './types'

const msg = (id: string, author: string, at: number, mine = false): ChatLine => ({
  at,
  author,
  body: `m${id}`,
  id,
  kind: 'message',
  mine,
  taskId: 't'
})

describe('room', () => {
  it('makes each task a root: its first message, the replies after it, newest thread last', () => {
    const tasks = [
      { assignee: 'ana', created_at: 10, id: 'a', status: 'running', title: 'A' },
      { assignee: 'max', created_at: 5, id: 'b', status: 'todo', title: 'B' }
    ] as KanbanTask[]

    const roots = threadRoots(
      tasks,
      new Map([['a', [msg('1', 'you', 20, true), msg('2', 'ana', 30), msg('3', 'ana', 40)]]])
    )

    expect(roots.map(root => root.task.id)).toEqual(['b', 'a'])
    expect(roots[1]).toMatchObject({ body: 'm1', mine: true, participants: ['ana'], replies: 2 })
    expect(roots[0]).toMatchObject({ author: 'max', body: 'B', replies: 0 })
  })

  it('names who works, and which decision a card waits on', () => {
    expect(workingText([])).toBe('')
    expect(workingText(['ana', 'ana'])).toBe('ana is working…')
    expect(workingText(['ana', 'max'])).toBe('ana and max are working…')
    expect(workingText(['a', 'b', 'c', 'd'])).toBe('a, b and 2 more are working…')
    expect(workingNames([{ assignee: 'ana', id: 'x', status: 'running' } as KanbanTask])).toEqual(['ana'])
    expect(approvalKind({ id: 'x', status: 'review' } as KanbanTask)).toBe('review')
    expect(approvalKind({ block_kind: 'needs_input', id: 'x', status: 'blocked' } as KanbanTask)).toBe('question')
    expect(approvalKind({ id: 'x', status: 'running' } as KanbanTask)).toBeNull()
  })

  it('notes the objective, the newest decisions only, and what is open', () => {
    const goals = [{ id: 1, status: 'active', title: 'Goal', why: 'Because' }] as BoardGoal[]

    const journal = [
      { date: '2026-10-01T10:00', title: 'old', type: 'decision' },
      { date: '2026-10-05T10:00', title: 'report', type: 'report' },
      { date: '2026-10-09T10:00', title: 'new', type: 'decision' }
    ] as JournalEntry[]

    const tasks = [{ status: 'review' }, { status: 'running' }, { status: 'ready' }] as KanbanTask[]
    const notes = roomNotes(goals, journal, tasks)

    expect(notes.objective).toEqual({ title: 'Goal', why: 'Because' })
    expect(notes.decisions.map(entry => entry.title)).toEqual(['new', 'old'])
    expect(notes.open).toEqual({ needYou: 1, running: 1, waiting: 1 })
  })
})
