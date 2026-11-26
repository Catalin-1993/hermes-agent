import { describe, expect, it } from 'vitest'

import type { WorkflowDoc } from './api'
import { addNode, connect, connectRefused, duplicateNode, removeNodes, runOrder } from './doc'
import { DEFAULT_CONFIG } from './kinds'

function doc(): WorkflowDoc {
  return {
    description: '',
    edges: [{ branch: null, id: 'e1', source: 't', target: 'a' }],
    name: 'Test',
    nodes: [
      { config: DEFAULT_CONFIG.trigger(), id: 't', kind: 'trigger', title: '', x: 0, y: 0 },
      { config: DEFAULT_CONFIG.agent(), id: 'a', kind: 'agent', title: '', x: 360, y: 0 },
      { config: DEFAULT_CONFIG.condition(), id: 'c', kind: 'condition', title: '', x: 720, y: 0 },
      { config: DEFAULT_CONFIG.note(), h: 100, id: 'n', kind: 'note', title: '', w: 100, x: 0, y: 300 }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}

describe('workflow document edits', () => {
  it('refuses links that would loop, touch a note, or end at the trigger', () => {
    const d = connect(doc(), 'a', 'c', null)

    expect(connectRefused(d, 'c', 'a')).toBe(true)
    expect(connectRefused(d, 'a', 'n')).toBe(true)
    expect(connectRefused(d, 'c', 't')).toBe(true)
    expect(connectRefused(d, 'c', 'c')).toBe(true)
    expect(connectRefused(doc(), 'a', 'c')).toBe(false)
  })

  it('gives a link out of a condition its branch, and never repeats a link', () => {
    let d = connect(doc(), 'a', 'c', null)
    d = addNode(d, 'output', { after: 'c', at: { x: 0, y: 0 }, branch: 'no' }).doc

    const out = d.edges.find(e => e.source === 'c')!
    expect(out.branch).toBe('no')
    expect(connect(d, 'a', 'c', null)).toBe(d)
  })

  it('places a new step to the right of the one it follows and links it', () => {
    const { doc: d, id } = addNode(doc(), 'llm', { after: 'a', at: { x: 0, y: 0 } })
    const node = d.nodes.find(n => n.id === id)!

    expect(node.x).toBeGreaterThan(360)
    expect(d.edges.some(e => e.source === 'a' && e.target === id)).toBe(true)
  })

  it('never deletes or duplicates the trigger, and drops the links of what it deletes', () => {
    const d = removeNodes(doc(), ['t', 'a'])

    expect(d.nodes.map(n => n.id)).toEqual(['t', 'c', 'n'])
    expect(d.edges).toEqual([])
    expect(duplicateNode(doc(), 't').id).toBeNull()
  })

  it('orders steps the way a run reaches them', () => {
    const d = connect(doc(), 'a', 'c', null)

    expect(runOrder(d)).toEqual(['t', 'a', 'c'])
  })
})
