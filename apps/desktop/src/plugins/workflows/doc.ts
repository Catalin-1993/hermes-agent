/**
 * Pure edits of a workflow document — what the canvas and the inspector do to it. Every function
 * returns a new document; the editor keeps them in an undo history. The backend normalises again on
 * save, so these only need to keep the canvas honest while the owner works.
 */

import type { NodeConfigs, NodeKind, WorkflowDoc, WorkflowEdge, WorkflowNode } from './api'
import { CARD_H, CARD_W, DEFAULT_CONFIG, isVisual, nodeSize, VISUAL_SIZE } from './kinds'

const token = () => Math.random().toString(16).slice(2, 12)

export const newNodeId = () => `n_${token()}`
const newEdgeId = () => `e_${token()}`

export function findNode(doc: WorkflowDoc, id: null | string | undefined): undefined | WorkflowNode {
  return id ? doc.nodes.find(node => node.id === id) : undefined
}

/** True when a link `source → target` would be refused: a loop, a visual item, the trigger as target. */
export function connectRefused(doc: WorkflowDoc, source: string, target: string): boolean {
  const a = findNode(doc, source)
  const b = findNode(doc, target)

  if (!a || !b || a.id === b.id || isVisual(a.kind) || isVisual(b.kind) || b.kind === 'trigger') {
    return true
  }

  const outgoing = new Map<string, string[]>()

  for (const edge of doc.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
  }

  const stack = [target]
  const seen = new Set<string>()

  while (stack.length) {
    const current = stack.pop()!

    if (current === source) {
      return true
    }

    if (!seen.has(current)) {
      seen.add(current)
      stack.push(...(outgoing.get(current) ?? []))
    }
  }

  return false
}

export function connect(doc: WorkflowDoc, source: string, target: string, branch: WorkflowEdge['branch']): WorkflowDoc {
  if (connectRefused(doc, source, target)) {
    return doc
  }

  const sourceNode = findNode(doc, source)!
  const edgeBranch = sourceNode.kind === 'condition' ? (branch ?? 'yes') : null

  if (doc.edges.some(e => e.source === source && e.target === target && e.branch === edgeBranch)) {
    return doc
  }

  return { ...doc, edges: [...doc.edges, { branch: edgeBranch, id: newEdgeId(), source, target }] }
}

/** Where a step linked after `after` goes: to its right, below the steps already there. */
function placeAfter(doc: WorkflowDoc, after: WorkflowNode) {
  const x = after.x + nodeSize(after).w + 96
  const taken = doc.nodes.filter(n => Math.abs(n.x - x) < CARD_W && n.y >= after.y - 4)
  const y = taken.length ? Math.max(...taken.map(n => n.y + nodeSize(n).h)) + 32 : after.y

  return { x, y }
}

export function addNode(
  doc: WorkflowDoc,
  kind: Exclude<NodeKind, 'trigger'>,
  options: { after?: string; at: { x: number; y: number }; branch?: WorkflowEdge['branch']; id?: string }
): { doc: WorkflowDoc; id: string } {
  const visual = isVisual(kind)
  const size = visual ? VISUAL_SIZE[kind as keyof typeof VISUAL_SIZE] : { h: CARD_H, w: CARD_W }
  const found = findNode(doc, options.after)
  const after = found && !visual && !isVisual(found.kind) ? found : undefined
  const position = after ? placeAfter(doc, after) : { x: options.at.x - size.w / 2, y: options.at.y - size.h / 2 }
  const id = options.id ?? newNodeId()

  const node: WorkflowNode = {
    config: DEFAULT_CONFIG[kind](),
    id,
    kind,
    title: '',
    x: Math.round(position.x),
    y: Math.round(position.y),
    ...(visual ? size : {})
  }

  const next: WorkflowDoc = { ...doc, nodes: [...doc.nodes, node] }

  return { doc: after ? connect(next, after.id, id, options.branch ?? null) : next, id }
}

export function moveNodes(doc: WorkflowDoc, moves: Record<string, { x: number; y: number }>): WorkflowDoc {
  return {
    ...doc,
    nodes: doc.nodes.map(node =>
      moves[node.id] ? { ...node, x: Math.round(moves[node.id].x), y: Math.round(moves[node.id].y) } : node
    )
  }
}

export function resizeNode(doc: WorkflowDoc, id: string, w: number, h: number): WorkflowDoc {
  return { ...doc, nodes: doc.nodes.map(n => (n.id === id ? { ...n, h: Math.round(h), w: Math.round(w) } : n)) }
}

export function updateNode<K extends NodeKind>(
  doc: WorkflowDoc,
  id: string,
  patch: { config?: Partial<NodeConfigs[K]>; title?: string }
): WorkflowDoc {
  return {
    ...doc,
    nodes: doc.nodes.map(node =>
      node.id === id
        ? {
            ...node,
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.config ? { config: { ...node.config, ...patch.config } } : {})
          }
        : node
    )
  }
}

export function removeNodes(doc: WorkflowDoc, ids: string[]): WorkflowDoc {
  const gone = new Set(ids.filter(id => findNode(doc, id)?.kind !== 'trigger'))

  return {
    ...doc,
    edges: doc.edges.filter(e => !gone.has(e.source) && !gone.has(e.target)),
    nodes: doc.nodes.filter(n => !gone.has(n.id))
  }
}

export function removeEdge(doc: WorkflowDoc, id: string): WorkflowDoc {
  return { ...doc, edges: doc.edges.filter(e => e.id !== id) }
}

export function duplicateNode(
  doc: WorkflowDoc,
  id: string,
  newId = newNodeId()
): { doc: WorkflowDoc; id: null | string } {
  const node = findNode(doc, id)

  if (!node || node.kind === 'trigger') {
    return { doc, id: null }
  }

  const copy = { ...node, config: structuredClone(node.config), id: newId, x: node.x + 32, y: node.y + 32 }

  return { doc: { ...doc, nodes: [...doc.nodes, copy] }, id: copy.id }
}

/** The box around every node, for "fit". */
export function bounds(doc: WorkflowDoc) {
  if (!doc.nodes.length) {
    return { maxX: 0, maxY: 0, minX: 0, minY: 0 }
  }

  return doc.nodes.reduce(
    (box, node) => {
      const { h, w } = nodeSize(node)

      return {
        maxX: Math.max(box.maxX, node.x + w),
        maxY: Math.max(box.maxY, node.y + h),
        minX: Math.min(box.minX, node.x),
        minY: Math.min(box.minY, node.y)
      }
    },
    { maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity }
  )
}

/** Step ids in the order a run would reach them (for listing a run's steps). */
export function runOrder(doc: Pick<WorkflowDoc, 'edges' | 'nodes'>): string[] {
  const runnable = doc.nodes.filter(n => !isVisual(n.kind))
  const incoming = new Map(runnable.map(n => [n.id, 0]))

  for (const edge of doc.edges) {
    if (incoming.has(edge.target) && incoming.has(edge.source)) {
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
    }
  }

  const byPosition = (a: WorkflowNode, b: WorkflowNode) => a.x - b.x || a.y - b.y
  const order: string[] = []
  const left = new Map(incoming)

  while (left.size) {
    const free = runnable.filter(n => left.get(n.id) === 0).sort(byPosition)
    const current = free[0] ?? runnable.filter(n => left.has(n.id)).sort(byPosition)[0]

    order.push(current.id)
    left.delete(current.id)

    for (const edge of doc.edges) {
      if (edge.source === current.id && left.has(edge.target)) {
        left.set(edge.target, (left.get(edge.target) ?? 1) - 1)
      }
    }
  }

  return order
}
