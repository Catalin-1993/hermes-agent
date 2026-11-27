/**
 * The step picker: from the toolbar's Add (placed after the selected step, or in the middle of the
 * view) and from a click on a step's output port (placed and linked right after it, on that branch).
 */

import { cn, Popover, PopoverContent, PopoverTrigger } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'

import type { NodeKind } from './api'
import { COPY } from './copy'
import { KIND_ICON, KIND_TONE, STEP_KINDS, VISUAL_KINDS } from './kinds'
import { KindTile } from './ui'

type AddKind = Exclude<NodeKind, 'trigger'>

function Item({ kind, onPick }: { kind: AddKind; onPick: (kind: AddKind) => void }) {
  return (
    <button
      className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1 text-left transition-colors hover:bg-(--card-well)"
      onClick={() => onPick(kind)}
      title={COPY.kinds[kind].hint}
      type="button"
    >
      <KindTile icon={KIND_ICON[kind]} size="sm" tone={KIND_TONE[kind]} />
      <span className="flex min-w-0 flex-col">
        <span className="text-[0.8125rem] font-medium text-(--ui-text-primary)">{COPY.kinds[kind].label}</span>
        <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">{COPY.kinds[kind].hint}</span>
      </span>
    </button>
  )
}

export function AddMenuBody({
  after,
  onPick,
  steps = true
}: {
  after?: string
  onPick: (kind: AddKind) => void
  steps?: boolean
}) {
  return (
    <div className="flex w-68 flex-col gap-0.5 p-1">
      {after && <span className="px-2 pt-1 text-[0.71875rem] text-(--ui-text-tertiary)">{COPY.add.after(after)}</span>}
      <span className="px-2 pt-1.5 text-[0.65625rem] font-semibold tracking-[0.06em] text-(--ui-text-tertiary) uppercase">
        {COPY.add.steps}
      </span>
      {STEP_KINDS.map(kind => (
        <Item key={kind} kind={kind} onPick={onPick} />
      ))}
      {steps && (
        <>
          <span className="px-2 pt-2 text-[0.65625rem] font-semibold tracking-[0.06em] text-(--ui-text-tertiary) uppercase">
            {COPY.add.visual}
          </span>
          {VISUAL_KINDS.map(kind => (
            <Item key={kind} kind={kind} onPick={onPick} />
          ))}
        </>
      )}
    </div>
  )
}

/** The port's own menu, opened at a screen point. */
export function FloatingAddMenu({
  after,
  at,
  onClose,
  onPick
}: {
  after: string
  at: { x: number; y: number }
  onClose: () => void
  onPick: (kind: AddKind) => void
}) {
  return (
    <Popover onOpenChange={open => !open && onClose()} open>
      <PopoverTrigger asChild>
        <span className="pointer-events-none fixed size-px" style={{ left: at.x, top: at.y }} />
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('w-auto p-0')} side="right" sideOffset={12}>
        <AddMenuBody after={after} onPick={onPick} steps={false} />
      </PopoverContent>
    </Popover>
  )
}

export function MenuItem({
  children,
  danger,
  detail,
  disabled,
  icon,
  onClick
}: {
  children: ReactNode
  danger?: boolean
  /** A second, quieter line: what the item acts on, or why it cannot yet. */
  detail?: ReactNode
  disabled?: boolean
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-[0.8125rem] transition-colors enabled:hover:bg-(--card-well) disabled:cursor-default disabled:opacity-45',
        danger ? 'text-(--ui-red)' : 'text-(--ui-text-primary)'
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="grid size-4 shrink-0 place-items-center text-(--ui-text-secondary)">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{children}</span>
        {detail && <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">{detail}</span>}
      </span>
    </button>
  )
}
