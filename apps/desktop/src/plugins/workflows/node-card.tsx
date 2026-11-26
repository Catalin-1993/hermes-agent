/**
 * One node on the canvas. Steps are cards of one size with an input port on the left and an output
 * port on the right (a Condition has two: Da above, Nu below). Text, notes and shapes are free-sized
 * items behind the steps, edited in place with a double click, never connected.
 */

import { cn, Codicon } from '@hermes/plugin-sdk'
import { memo, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'

import type { NodeConfigs, StepStatus, WorkflowNode } from './api'
import { COPY } from './copy'
import { CARD_H, CARD_W, KIND_ICON, KIND_TONE, nodeLabel, nodeSummary, NOTE_FILL, TRIGGER_ICON } from './kinds'
import { KindTile, StatusMark, statusTone } from './ui'

export type Port = 'in' | 'no' | 'out' | 'yes'

export interface NodeHandlers {
  onNodePointerDown: (event: ReactPointerEvent, node: WorkflowNode) => void
  onPortPointerDown: (event: ReactPointerEvent, node: WorkflowNode, port: Port) => void
  onResizePointerDown: (event: ReactPointerEvent, node: WorkflowNode) => void
  onInlineEdit: (node: WorkflowNode, text: string) => void
}

interface NodeCardProps extends NodeHandlers {
  agentLabel: (name: string) => string
  connecting: boolean
  problem?: string
  selected: boolean
  status?: StepStatus
  node: WorkflowNode
}

function PortDot({
  label,
  node,
  onPointerDown,
  port,
  style
}: {
  label?: string
  node: WorkflowNode
  onPointerDown: NodeHandlers['onPortPointerDown']
  port: Port
  style: React.CSSProperties
}) {
  const input = port === 'in'

  return (
    <span
      className={cn('wf-port absolute z-10 flex items-center', input ? '-left-[7px]' : '-right-[7px]')}
      data-wf-port={port}
      onPointerDown={event => onPointerDown(event, node, port)}
      style={style}
    >
      {label && (
        <span
          className="pointer-events-none absolute bottom-[calc(100%+2px)] left-2.5 rounded-full px-1.5 text-[0.625rem] leading-4 font-semibold"
          style={{
            background: `color-mix(in srgb, ${port === 'yes' ? 'var(--ui-green)' : 'var(--ui-red)'} 14%, transparent)`,
            color: port === 'yes' ? 'var(--ui-green)' : 'var(--ui-red)'
          }}
        >
          {label}
        </span>
      )}
      <span className="wf-port-dot" />
    </span>
  )
}

function StepCard({ agentLabel, connecting, node, problem, selected, status, ...handlers }: NodeCardProps) {
  const tone = KIND_TONE[node.kind]

  const icon =
    node.kind === 'trigger' ? TRIGGER_ICON[(node.config as NodeConfigs['trigger']).type] : KIND_ICON[node.kind]

  const summary = nodeSummary(node, agentLabel)

  return (
    <div
      className={cn(
        'wf-card group absolute flex flex-col gap-2 rounded-[16px] border px-3.5 py-3',
        selected && 'wf-card-selected',
        connecting && 'wf-card-connectable',
        status === 'skipped' && 'opacity-55'
      )}
      data-wf-node={node.id}
      onPointerDown={event => handlers.onNodePointerDown(event, node)}
      style={{
        height: CARD_H,
        left: node.x,
        top: node.y,
        width: CARD_W,
        ...(status && status !== 'pending'
          ? { borderColor: `color-mix(in srgb, ${statusTone(status)} 55%, var(--card-stroke))` }
          : {})
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <KindTile icon={icon} tone={tone} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[0.625rem] font-semibold tracking-[0.07em] text-(--ui-text-tertiary) uppercase">
            {COPY.kinds[node.kind].label}
          </span>
          <span className="truncate text-[0.875rem] leading-snug font-medium text-(--ui-text-primary)">
            {nodeLabel(node)}
          </span>
        </div>
        {status && status !== 'pending' ? (
          <StatusMark status={status} />
        ) : problem ? (
          <span title={problem}>
            <Codicon className="text-(--ui-yellow)" name="warning" size="0.875rem" />
          </span>
        ) : null}
      </div>
      <p className="m-0 line-clamp-2 text-[0.75rem] leading-[1.45] text-(--ui-text-secondary)">{summary}</p>

      {node.kind !== 'trigger' && (
        <PortDot node={node} onPointerDown={handlers.onPortPointerDown} port="in" style={{ top: CARD_H / 2 - 7 }} />
      )}
      {node.kind === 'condition' ? (
        <>
          <PortDot
            label={COPY.branch.yes}
            node={node}
            onPointerDown={handlers.onPortPointerDown}
            port="yes"
            style={{ top: CARD_H * 0.36 - 7 }}
          />
          <PortDot
            label={COPY.branch.no}
            node={node}
            onPointerDown={handlers.onPortPointerDown}
            port="no"
            style={{ top: CARD_H * 0.72 - 7 }}
          />
        </>
      ) : (
        <PortDot node={node} onPointerDown={handlers.onPortPointerDown} port="out" style={{ top: CARD_H / 2 - 7 }} />
      )}
    </div>
  )
}

function InlineText({
  className,
  onDone,
  value
}: {
  className: string
  onDone: (text: null | string) => void
  value: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <textarea
      className={cn('h-full w-full resize-none bg-transparent outline-none', className)}
      defaultValue={value}
      onBlur={event => onDone(event.currentTarget.value)}
      onKeyDown={event => {
        event.stopPropagation()

        if (event.key === 'Escape') {
          onDone(null)
        }

        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.currentTarget.blur()
        }
      }}
      onPointerDown={event => event.stopPropagation()}
      ref={ref}
    />
  )
}

function ShapeOutline({ config }: { config: NodeConfigs['shape'] }) {
  const stroke = NOTE_FILL[config.color]

  const common = {
    fill: `color-mix(in srgb, ${stroke} 6%, transparent)`,
    stroke: `color-mix(in srgb, ${stroke} 60%, transparent)`,
    strokeDasharray: config.color === 'default' ? '6 5' : undefined,
    strokeWidth: 1.5,
    vectorEffect: 'non-scaling-stroke' as const
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {config.shape === 'ellipse' && <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />}
      {config.shape === 'diamond' && <polygon points="50,0 100,50 50,100 0,50" {...common} />}
      {config.shape === 'rectangle' && <rect height="100" rx="4" ry="4" width="100" {...common} />}
    </svg>
  )
}

function VisualItem({ node, selected, ...handlers }: NodeCardProps) {
  const [editing, setEditing] = useState(false)
  const box = { height: node.h, left: node.x, top: node.y, width: node.w }

  const done = (text: null | string) => {
    setEditing(false)

    if (text !== null) {
      handlers.onInlineEdit(node, text)
    }
  }

  const body = (() => {
    if (node.kind === 'note') {
      const config = node.config as NodeConfigs['note']
      const fill = NOTE_FILL[config.color]

      return (
        <div
          className="h-full w-full rounded-[6px] p-3 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-(--ui-text-primary) shadow-(--card-shadow)"
          style={{ background: `color-mix(in srgb, ${fill} 22%, var(--card-surface))` }}
        >
          {editing ? (
            <InlineText className="text-[0.8125rem] leading-relaxed" onDone={done} value={config.text} />
          ) : (
            config.text || <span className="text-(--ui-text-tertiary)">{COPY.kinds.note.label}</span>
          )}
        </div>
      )
    }

    if (node.kind === 'text') {
      const config = node.config as NodeConfigs['text']
      const style = { fontSize: config.size, lineHeight: 1.15 }

      return editing ? (
        <InlineText
          className="font-[family-name:var(--dt-font-display)] text-(--ui-text-primary)"
          onDone={done}
          value={config.text}
        />
      ) : (
        <div
          className="font-[family-name:var(--dt-font-display)] whitespace-pre-wrap text-(--ui-text-primary)"
          style={style}
        >
          {config.text || COPY.kinds.text.label}
        </div>
      )
    }

    const config = node.config as NodeConfigs['shape']

    return (
      <>
        <ShapeOutline config={config} />
        <span className="absolute top-2 left-3 text-[0.75rem] font-medium text-(--ui-text-secondary)">
          {editing ? <InlineText className="text-[0.75rem]" onDone={done} value={config.label} /> : config.label}
        </span>
      </>
    )
  })()

  return (
    <div
      className={cn('wf-visual absolute', selected && 'wf-visual-selected')}
      data-wf-node={node.id}
      onDoubleClick={() => setEditing(true)}
      onPointerDown={event => handlers.onNodePointerDown(event, node)}
      style={box}
    >
      {node.kind === 'text' ? (
        <div className="h-full w-full" style={{ fontSize: (node.config as NodeConfigs['text']).size }}>
          {body}
        </div>
      ) : (
        body
      )}
      {selected && (
        <span
          className="wf-resize absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-[3px] border border-(--ui-accent) bg-(--card-surface)"
          onPointerDown={event => handlers.onResizePointerDown(event, node)}
        />
      )}
    </div>
  )
}

export const NodeCard = memo(function NodeCard(props: NodeCardProps) {
  return props.node.kind === 'text' || props.node.kind === 'note' || props.node.kind === 'shape' ? (
    <VisualItem {...props} />
  ) : (
    <StepCard {...props} />
  )
})
