/**
 * The workflow canvas: an endless dotted board with the steps on it.
 *
 * - Drag the board (or scroll) to move around; ⌘/Ctrl + scroll or pinch to zoom around the pointer.
 * - Drag a node to move it (8px grid); drag from a node's right port to another node to link them;
 *   click a port without dragging to add the next step there.
 * - Click a link to select it, Delete removes the selection, ⌘D duplicates, ⌘Z / ⇧⌘Z undo and redo.
 *
 * While a run is shown, each step carries its status and the links it took light up.
 */

import { cn, Codicon, Popover, PopoverContent, PopoverTrigger } from '@hermes/plugin-sdk'
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import type { StepStatus, Viewport, WorkflowEdge, WorkflowNode } from './api'
import { COPY } from './copy'
import { bounds, connect, connectRefused, findNode, moveNodes, resizeNode, updateNode } from './doc'
import type { Editor } from './editor-state'
import { isVisual, nodeSize, portPoint } from './kinds'
import { NodeCard, type NodeHandlers, type Port } from './node-card'
import { IconButton, Kbd } from './ui'

const GRID = 8
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2

const snap = (value: number) => Math.round(value / GRID) * GRID
const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

type Gesture =
  | { kind: 'connect'; moved: boolean; port: Port; source: string; startX: number; startY: number }
  | { kind: 'drag'; moved: boolean; origin: { x: number; y: number }; id: string; startX: number; startY: number }
  | { kind: 'pan'; moved: boolean; startX: number; startY: number; vx: number; vy: number }
  | { kind: 'resize'; h: number; id: string; startX: number; startY: number; w: number }

export interface CanvasProps {
  agentLabel: (name: string) => string
  editor: Editor
  /** Add a step linked after `nodeId` (on `branch` for a Condition): the add menu, at that port. */
  onQuickAdd: (nodeId: string, branch: WorkflowEdge['branch'], at: { x: number; y: number }) => void
  runStatus?: Map<string, StepStatus>
  viewportRef: React.MutableRefObject<{ center: () => { x: number; y: number } } | null>
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.max(56, Math.abs(b.x - a.x) * 0.5)

  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
}

function edgeTone(edge: WorkflowEdge, status?: Map<string, StepStatus>): null | string {
  const from = status?.get(edge.source)
  const to = status?.get(edge.target)

  if (!from || !to) {
    return null
  }

  if (from === 'succeeded' && to !== 'skipped' && to !== 'pending') {
    return to === 'failed' ? 'var(--ui-red)' : 'var(--ui-green)'
  }

  return null
}

function Edges({
  doc,
  onSelect,
  pending,
  selected,
  status
}: {
  doc: Editor['doc']
  onSelect: (id: string) => void
  pending: null | { from: { x: number; y: number }; to: { x: number; y: number } }
  selected: null | string
  status?: Map<string, StepStatus>
}) {
  return (
    <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" height="1" width="1">
      <defs>
        <marker id="wf-arrow" markerHeight="8" markerWidth="8" orient="auto-start-reverse" refX="7" refY="4">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--wf-edge)" />
        </marker>
        <marker id="wf-arrow-on" markerHeight="8" markerWidth="8" orient="auto-start-reverse" refX="7" refY="4">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--ui-accent)" />
        </marker>
      </defs>
      {doc.edges.map(edge => {
        const source = findNode(doc, edge.source)
        const target = findNode(doc, edge.target)

        if (!source || !target) {
          return null
        }

        const port = source.kind === 'condition' ? (edge.branch ?? 'yes') : 'out'
        const d = edgePath(portPoint(source, port), portPoint(target, 'in'))
        const on = selected === edge.id
        const tone = edgeTone(edge, status)
        const running = status?.get(edge.target) === 'running' && status.get(edge.source) === 'succeeded'

        return (
          <g key={edge.id}>
            <path
              className="pointer-events-auto cursor-pointer"
              d={d}
              fill="none"
              onPointerDown={event => {
                event.stopPropagation()
                onSelect(edge.id)
              }}
              stroke="transparent"
              strokeWidth={14}
            />
            <path
              className={cn('wf-edge', running && 'wf-edge-running')}
              d={d}
              fill="none"
              markerEnd={on ? 'url(#wf-arrow-on)' : 'url(#wf-arrow)'}
              stroke={on ? 'var(--ui-accent)' : (tone ?? 'var(--wf-edge)')}
              strokeWidth={on ? 2.25 : 1.75}
            />
          </g>
        )
      })}
      {pending && (
        <path
          className="wf-edge-draft"
          d={edgePath(pending.from, pending.to)}
          fill="none"
          stroke="var(--ui-accent)"
          strokeWidth={2}
        />
      )}
    </svg>
  )
}

function useWheel(ref: React.RefObject<HTMLDivElement | null>, onWheel: (event: WheelEvent) => void) {
  const handler = useRef(onWheel)
  handler.current = onWheel

  useEffect(() => {
    const element = ref.current

    if (!element) {
      return
    }

    const listener = (event: WheelEvent) => handler.current(event)
    element.addEventListener('wheel', listener, { passive: false })

    return () => element.removeEventListener('wheel', listener)
  }, [ref])
}

export function WorkflowCanvas({ agentLabel, editor, onQuickAdd, runStatus, viewportRef }: CanvasProps) {
  const { doc, edit, checkpoint, select, selection } = editor
  const container = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<Viewport>(doc.viewport)
  const gesture = useRef<Gesture | null>(null)

  const [draft, setDraft] = useState<null | {
    from: { x: number; y: number }
    source: string
    to: { x: number; y: number }
  }>(null)

  const problems = useMemo(() => new Map(editor.meta.problems.map(p => [p.node_id, p.message])), [editor.meta.problems])

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = container.current!.getBoundingClientRect()

      return { x: (clientX - rect.left - view.x) / view.zoom, y: (clientY - rect.top - view.y) / view.zoom }
    },
    [view]
  )

  const commitView = useRef<null | ReturnType<typeof setTimeout>>(null)

  const changeView = useCallback(
    (next: Viewport) => {
      setView(next)

      if (commitView.current) {
        clearTimeout(commitView.current)
      }

      commitView.current = setTimeout(() => editor.setViewport(next), 400)
    },
    [editor]
  )

  const fit = useCallback(() => {
    const element = container.current

    if (!element || !doc.nodes.length) {
      return
    }

    const box = bounds(doc)
    const { height, width } = element.getBoundingClientRect()
    const pad = 96

    const zoom = clampZoom(
      Math.min(1, (width - pad * 2) / (box.maxX - box.minX), (height - pad * 2) / (box.maxY - box.minY))
    )

    changeView({
      x: width / 2 - ((box.minX + box.maxX) / 2) * zoom,
      y: height / 2 - ((box.minY + box.maxY) / 2) * zoom,
      zoom
    })
  }, [changeView, doc])

  const zoomBy = useCallback(
    (factor: number, around?: { x: number; y: number }) => {
      const rect = container.current!.getBoundingClientRect()
      const point = around ?? { x: rect.width / 2, y: rect.height / 2 }
      const zoom = clampZoom(view.zoom * factor)
      const scale = zoom / view.zoom

      changeView({ x: point.x - (point.x - view.x) * scale, y: point.y - (point.y - view.y) * scale, zoom })
    },
    [changeView, view]
  )

  // A workflow opened for the first time (no saved view) is framed so every step shows.
  useLayoutEffect(() => {
    if (doc.viewport.x === 0 && doc.viewport.y === 0 && doc.viewport.zoom === 1) {
      fit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, [])

  // A step selected outside the view (just added, or picked from a problem) slides into it.
  const selectedId = selection?.type === 'node' ? selection.id : null

  useEffect(() => {
    const node = findNode(doc, selectedId)
    const element = container.current

    if (!node || !element) {
      return
    }

    const { height, width } = element.getBoundingClientRect()
    const { h, w } = nodeSize(node)
    const left = view.x + node.x * view.zoom
    const top = view.y + node.y * view.zoom
    const margin = 48

    if (
      left >= margin &&
      top >= margin &&
      left + w * view.zoom <= width - margin &&
      top + h * view.zoom <= height - margin
    ) {
      return
    }

    changeView({
      ...view,
      x: width / 2 - (node.x + w / 2) * view.zoom,
      y: height / 2 - (node.y + h / 2) * view.zoom
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the selection changes
  }, [selectedId])

  viewportRef.current = {
    center: () => {
      const rect = container.current?.getBoundingClientRect()

      return rect ? toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2) : { x: 0, y: 0 }
    }
  }

  useWheel(container, event => {
    event.preventDefault()
    const rect = container.current!.getBoundingClientRect()

    if (event.ctrlKey || event.metaKey) {
      zoomBy(Math.exp(-event.deltaY * 0.0022), { x: event.clientX - rect.left, y: event.clientY - rect.top })
    } else {
      changeView({ ...view, x: view.x - event.deltaX, y: view.y - event.deltaY })
    }
  })

  const handlers: NodeHandlers = useMemo(
    () => ({
      onInlineEdit: (node: WorkflowNode, text: string) => {
        const key = node.kind === 'shape' ? 'label' : 'text'
        edit(d => updateNode(d, node.id, { config: { [key]: text } }))
      },
      onNodePointerDown: (event: ReactPointerEvent, node: WorkflowNode) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('[data-wf-port]')) {
          return
        }

        event.stopPropagation()
        select({ id: node.id, type: 'node' })
        container.current?.setPointerCapture(event.pointerId)
        gesture.current = {
          id: node.id,
          kind: 'drag',
          moved: false,
          origin: { x: node.x, y: node.y },
          startX: event.clientX,
          startY: event.clientY
        }
      },
      onPortPointerDown: (event: ReactPointerEvent, node: WorkflowNode, port: Port) => {
        if (event.button !== 0 || port === 'in') {
          return
        }

        event.stopPropagation()
        container.current?.setPointerCapture(event.pointerId)
        gesture.current = {
          kind: 'connect',
          moved: false,
          port,
          source: node.id,
          startX: event.clientX,
          startY: event.clientY
        }
      },
      onResizePointerDown: (event: ReactPointerEvent, node: WorkflowNode) => {
        event.stopPropagation()
        container.current?.setPointerCapture(event.pointerId)
        checkpoint()
        gesture.current = {
          h: node.h ?? 100,
          id: node.id,
          kind: 'resize',
          startX: event.clientX,
          startY: event.clientY,
          w: node.w ?? 200
        }
      }
    }),
    [checkpoint, edit, select]
  )

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0 && event.button !== 1) {
      return
    }

    container.current?.focus({ preventScroll: true })
    select(null)
    container.current?.setPointerCapture(event.pointerId)
    gesture.current = {
      kind: 'pan',
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      vx: view.x,
      vy: view.y
    }
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    const g = gesture.current

    if (!g) {
      return
    }

    const dx = event.clientX - g.startX
    const dy = event.clientY - g.startY
    const far = Math.abs(dx) + Math.abs(dy) > 3

    if (g.kind === 'pan') {
      g.moved ||= far
      setView(current => ({ ...current, x: g.vx + dx, y: g.vy + dy }))
    } else if (g.kind === 'drag') {
      if (!g.moved && far) {
        g.moved = true
        checkpoint()
      }

      if (g.moved) {
        const position = { x: snap(g.origin.x + dx / view.zoom), y: snap(g.origin.y + dy / view.zoom) }
        edit(d => moveNodes(d, { [g.id]: position }), { record: false })
      }
    } else if (g.kind === 'resize') {
      edit(
        d => resizeNode(d, g.id, Math.max(48, snap(g.w + dx / view.zoom)), Math.max(28, snap(g.h + dy / view.zoom))),
        {
          record: false
        }
      )
    } else {
      g.moved ||= far
      const source = findNode(doc, g.source)

      if (source && g.moved) {
        setDraft({ from: portPoint(source, g.port), source: g.source, to: toWorld(event.clientX, event.clientY) })
      }
    }
  }

  const endConnect = (g: Extract<Gesture, { kind: 'connect' }>, event: ReactPointerEvent) => {
    setDraft(null)
    const branch = g.port === 'yes' || g.port === 'no' ? g.port : null

    if (!g.moved) {
      const source = findNode(doc, g.source)

      if (source) {
        const rect = container.current!.getBoundingClientRect()
        const point = portPoint(source, g.port)
        onQuickAdd(g.source, branch, {
          x: rect.left + view.x + point.x * view.zoom,
          y: rect.top + view.y + point.y * view.zoom
        })
      }

      return
    }

    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-wf-node]')
    const target = hit?.dataset.wfNode

    if (target && !connectRefused(doc, g.source, target)) {
      edit(d => connect(d, g.source, target, branch))
    }
  }

  const onPointerUp = (event: ReactPointerEvent) => {
    const g = gesture.current
    gesture.current = null

    if (!g) {
      return
    }

    if (g.kind === 'pan' && g.moved) {
      changeView({ ...view })
    } else if (g.kind === 'connect') {
      endConnect(g, event)
    }
  }

  const visual = doc.nodes.filter(n => isVisual(n.kind))
  const steps = doc.nodes.filter(n => !isVisual(n.kind))
  const selectedNode = selection?.type === 'node' ? selection.id : null

  const card = (node: WorkflowNode) => (
    <NodeCard
      agentLabel={agentLabel}
      connecting={Boolean(draft) && !connectRefused(doc, draft!.source, node.id)}
      key={node.id}
      node={node}
      problem={problems.get(node.id)}
      selected={selectedNode === node.id}
      status={runStatus?.get(node.id)}
      {...handlers}
    />
  )

  return (
    <div
      className="wf-canvas relative h-full w-full touch-none overflow-hidden outline-none select-none"
      data-wf-canvas=""
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      ref={container}
      style={{
        backgroundPosition: `${view.x}px ${view.y}px`,
        backgroundSize: `${20 * view.zoom}px ${20 * view.zoom}px`
      }}
      tabIndex={0}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        {visual.map(card)}
        <Edges
          doc={doc}
          onSelect={id => select({ id, type: 'edge' })}
          pending={draft}
          selected={selection?.type === 'edge' ? selection.id : null}
          status={runStatus}
        />
        {steps.map(card)}
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-0.5 rounded-[12px] border border-(--card-stroke) bg-(--card-surface) p-1 shadow-(--card-shadow)">
        <IconButton
          icon="zoom-out"
          label={COPY.toolbar.zoomOut}
          onClick={() => zoomBy(1 / 1.2)}
          onPointerDown={e => e.stopPropagation()}
        />
        <button
          className="h-8 min-w-12 rounded-[8px] px-1.5 text-[0.75rem] text-(--ui-text-secondary) tabular-nums hover:bg-(--card-well)"
          onClick={() => zoomBy(1 / view.zoom)}
          onPointerDown={e => e.stopPropagation()}
          type="button"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <IconButton
          icon="zoom-in"
          label={COPY.toolbar.zoomIn}
          onClick={() => zoomBy(1.2)}
          onPointerDown={e => e.stopPropagation()}
        />
        <span className="mx-0.5 h-5 w-px bg-(--card-well-stroke)" />
        <IconButton
          icon="screen-full"
          label={COPY.toolbar.fit}
          onClick={fit}
          onPointerDown={e => e.stopPropagation()}
        />
        {/* The keyboard shortcuts, one click away instead of a line that runs into the zoom bar. */}
        <Popover>
          <PopoverTrigger asChild>
            <IconButton icon="keyboard" label={COPY.shortcuts.title} onPointerDown={e => e.stopPropagation()} />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-2" side="top">
            <div className="mb-1.5 px-1 text-[0.6875rem] font-medium text-(--ui-text-tertiary)">{COPY.shortcuts.title}</div>
            {COPY.shortcuts.items.map(([keys, label]) => (
              <div className="flex items-center justify-between gap-3 px-1 py-1 text-[0.75rem] text-(--ui-text-secondary)" key={label}>
                {label}
                <span className="flex gap-1">
                  {keys.map(key => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {selection?.type === 'edge' && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-(--card-stroke) bg-(--card-surface) px-3 py-1.5 text-[0.75rem] text-(--ui-text-secondary) shadow-(--card-shadow)">
          <Codicon name="link" size="0.8125rem" />
          Legătură selectată · <span className="text-(--ui-text-primary)">Delete</span> o șterge
        </div>
      )}
    </div>
  )
}
