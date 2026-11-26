/**
 * What the Workflows page is built from: the same card, button and field sizes as the app's other
 * full pages, the theme's own tokens for every colour, and the run / step status marks.
 */

import { cn, Codicon, GlyphSpinner } from '@hermes/plugin-sdk'
import type { ComponentProps, ReactNode } from 'react'

import type { RunStatus, StepStatus } from './api'
import { COPY } from './copy'

export const DISPLAY = 'font-[family-name:var(--dt-font-display)] font-normal'

export const PANEL = 'bg-(--card-surface) border-(--card-stroke)'

export const BTN =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-(--card-stroke) bg-(--card-well) px-3 text-[0.8125rem] font-medium text-(--ui-text-primary) transition-colors hover:border-(--ui-text-quaternary) disabled:cursor-not-allowed disabled:opacity-50'

export const BTN_PRIMARY =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] bg-(--ui-text-primary) px-3.5 text-[0.8125rem] font-semibold text-(--ui-bg-editor,var(--card-surface)) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

export const BTN_GHOST =
  'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[9px] text-(--ui-text-secondary) transition-colors hover:bg-(--card-well) hover:text-(--ui-text-primary) disabled:cursor-not-allowed disabled:opacity-40'

export const BTN_DANGER =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-[color-mix(in_srgb,var(--ui-red)_35%,transparent)] px-3 text-[0.8125rem] font-medium text-(--ui-red) transition-colors hover:bg-[color-mix(in_srgb,var(--ui-red)_10%,transparent)]'

export const FIELD =
  'h-[2.125rem] w-full min-w-0 rounded-[10px] border border-(--card-stroke) bg-(--card-well) px-3 text-[0.84375rem] text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:border-(--ui-text-tertiary)'

export const TEXTAREA =
  'min-h-24 w-full min-w-0 resize-y rounded-[10px] border border-(--card-stroke) bg-(--card-well) px-3 py-2 text-[0.84375rem] leading-relaxed text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:border-(--ui-text-tertiary)'

export const LABEL = 'text-[0.75rem] font-medium text-(--ui-text-secondary)'
export const HINT = 'm-0 text-[0.71875rem] leading-relaxed text-(--ui-text-tertiary)'
export const MONO = 'font-[family-name:var(--dt-font-mono,ui-monospace)]'

export function Field({ children, hint, label }: { children: ReactNode; hint?: ReactNode; label: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      {children}
      {hint && <span className={HINT}>{hint}</span>}
    </label>
  )
}

export function Section({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section className="flex flex-col gap-3.5 border-b border-(--card-well-stroke) px-4 py-4 last:border-b-0">
      {title && (
        <h3 className="m-0 text-[0.6875rem] font-semibold tracking-[0.06em] text-(--ui-text-tertiary) uppercase">
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}

/** The coloured square that carries a kind's icon: on cards, in menus, in the inspector head. */
export function KindTile({ icon, size = 'md', tone }: { icon: string; size?: 'lg' | 'md' | 'sm'; tone: string }) {
  const box = { lg: 'size-9 rounded-[11px]', md: 'size-8 rounded-[10px]', sm: 'size-6 rounded-[7px]' }[size]
  const glyph = { lg: '1.0625rem', md: '0.9375rem', sm: '0.75rem' }[size]

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', box)}
      style={{
        background: `color-mix(in srgb, ${tone} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 28%, transparent)`,
        color: tone
      }}
    >
      <Codicon name={icon} size={glyph} />
    </span>
  )
}

const STATUS_TONE: Record<RunStatus | StepStatus, string> = {
  cancelled: 'var(--ui-text-tertiary)',
  failed: 'var(--ui-red)',
  pending: 'var(--ui-text-quaternary, var(--ui-text-tertiary))',
  queued: 'var(--ui-text-tertiary)',
  rejected: 'var(--ui-red)',
  running: 'var(--ui-blue)',
  skipped: 'var(--ui-text-quaternary, var(--ui-text-tertiary))',
  succeeded: 'var(--ui-green)',
  waiting: 'var(--ui-orange)'
}

const STATUS_ICON: Record<RunStatus | StepStatus, string> = {
  cancelled: 'circle-slash',
  failed: 'error',
  pending: 'circle-large-outline',
  queued: 'clock',
  rejected: 'close',
  running: 'loading',
  skipped: 'debug-step-over',
  succeeded: 'pass',
  waiting: 'bell'
}

export const statusTone = (status: RunStatus | StepStatus) => STATUS_TONE[status]

export function StatusMark({ size = '0.875rem', status }: { size?: string; status: RunStatus | StepStatus }) {
  if (status === 'running') {
    return (
      <span className="inline-flex shrink-0 items-center" style={{ color: STATUS_TONE.running }}>
        <GlyphSpinner />
      </span>
    )
  }

  return <Codicon className="shrink-0" name={STATUS_ICON[status]} size={size} style={{ color: STATUS_TONE[status] }} />
}

export function StatusPill({ kind, status }: { kind: 'run' | 'step'; status: RunStatus | StepStatus }) {
  const label = kind === 'run' ? COPY.runs.status[status as RunStatus] : COPY.runs.stepStatus[status as StepStatus]

  const tone = STATUS_TONE[status]

  return (
    <span
      className="inline-flex h-[1.375rem] shrink-0 items-center gap-1 rounded-full px-2 text-[0.6875rem] font-medium"
      style={{ background: `color-mix(in srgb, ${tone} 13%, transparent)`, color: tone }}
    >
      <StatusMark size="0.75rem" status={status} />
      {label}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-(--card-stroke) bg-(--card-well) px-1 font-sans text-[0.625rem] text-(--ui-text-tertiary)">
      {children}
    </kbd>
  )
}

export function IconButton({
  className,
  icon,
  label,
  ...props
}: ComponentProps<'button'> & { icon: string; label: string }) {
  return (
    <button aria-label={label} className={cn(BTN_GHOST, className)} title={label} type="button" {...props}>
      <Codicon name={icon} size="0.9375rem" />
    </button>
  )
}

export function ago(seconds: null | number | undefined): string {
  if (!seconds) {
    return ''
  }

  const diff = Date.now() / 1000 - seconds

  if (diff < 45) {
    return 'acum'
  }

  if (diff < 3600) {
    return `acum ${Math.round(diff / 60)} min`
  }

  if (diff < 86_400) {
    return `acum ${Math.round(diff / 3600)} h`
  }

  return new Date(seconds * 1000).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

export function clock(seconds: null | number | undefined): string {
  return seconds
    ? new Date(seconds * 1000).toLocaleString('ro-RO', {
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short'
      })
    : ''
}
