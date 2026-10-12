import { describe, expect, it } from 'vitest'

import type { SessionInfo } from '@/types/hermes'

import { arrangeChats } from './chats-arrange'
import { type ChatGroup, groupByChat } from './chats-view'
import type { LibraryItem } from './data'

const item = (id: string, sessionId: null | string, updatedAt: number, parentId: null | string = null) =>
  ({ id, kind: 'page', parent_id: parentId, session_id: sessionId, title: id, updated_at: updatedAt }) as LibraryItem

const session = (id: string, lineage: string[] = []) =>
  ({ _lineage_ids: lineage, _lineage_root_id: id, id: lineage.at(-1) ?? id, title: id }) as unknown as SessionInfo

describe('groupByChat', () => {
  it('keeps one group per conversation across compression, newest work first, owner items out', () => {
    const groups = groupByChat(
      [item('plan', 'chat-a', 10), item('notes', 'chat-b', 30), item('budget', 'chat-a-2', 20), item('mine', null, 99)],
      [session('chat-a', ['chat-a', 'chat-a-2']), session('chat-b')]
    )

    expect(groups.map(group => [group.chatId, group.items.map(entry => entry.id)])).toEqual([
      ['chat-b', ['notes']],
      ['chat-a', ['budget', 'plan']]
    ])
  })

  it('lets a page stand for the blocks beneath it', () => {
    const [group] = groupByChat(
      [item('page', 'c', 5), item('block', 'c', 6, 'page'), item('loose', 'c', 4, 'elsewhere')],
      []
    )

    expect(group.items.map(entry => entry.id)).toEqual(['page', 'loose'])
  })
})

describe('arrangeChats', () => {
  const rows = (id: string, title: string, at: number, extra: Partial<LibraryItem> = {}) =>
    ({
      created_at: at,
      excerpt: '',
      id,
      kind: 'page',
      session_id: id,
      size: 1,
      tags: [],
      title,
      updated_at: at,
      visibility: 'ask',
      ...extra
    }) as LibraryItem

  const group = (chatId: string, items: LibraryItem[]) =>
    ({ chatId, items, session: null, updatedAt: Math.max(...items.map(i => i.updated_at)) }) as ChatGroup

  const groups = [
    group('a', [rows('p1', 'Launch plan', 10), rows('p2', 'Budget', 30)]),
    group('b', [rows('p3', 'Notes', 20, { created_by: 'agent' })])
  ]
  const title = (g: ChatGroup) => (g.chatId === 'a' ? 'Mobile app' : 'Research')
  const none = {
    filters: { access: [], createdBy: [], tag: null, types: [] },
    order: null,
    query: '',
    sort: 'updated' as const
  }

  it('orders chats by their newest item and items newest first', () => {
    const out = arrangeChats(groups, none, title)

    expect(out.map(g => g.chatId)).toEqual(['a', 'b'])
    expect(out[0].items.map(i => i.id)).toEqual(['p2', 'p1'])
  })

  it('searches items and chat titles, dropping chats with nothing left', () => {
    expect(arrangeChats(groups, { ...none, query: 'budget' }, title).map(g => g.chatId)).toEqual(['a'])
    expect(arrangeChats(groups, { ...none, query: 'research' }, title)[0].items.map(i => i.id)).toEqual(['p3'])
    expect(arrangeChats(groups, { ...none, query: 'zzz' }, title)).toEqual([])
  })

  it('filters by who made it, and sorts by name', () => {
    expect(
      arrangeChats(groups, { ...none, filters: { ...none.filters, createdBy: ['agent'] } }, title).map(g => g.chatId)
    ).toEqual(['b'])
    expect(arrangeChats(groups, { ...none, sort: 'name' }, title).map(g => g.chatId)).toEqual(['a', 'b'])
    expect(arrangeChats(groups, { ...none, order: 'asc', sort: 'name' }, title)[0].items.map(i => i.id)).toEqual([
      'p2',
      'p1'
    ])
  })
})
