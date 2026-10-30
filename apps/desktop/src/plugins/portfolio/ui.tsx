/**
 * What every Portfolio page is built from, in the sizes of its design: a serif page title over a one-line
 * subtitle, 20px cards, small round count pills, bordered buttons, one field height. Colours stay the app's
 * own tokens, so the page follows the theme; only the layout, the sizes and the type are the design's.
 */

import { cn } from '@hermes/plugin-sdk'
import type { ComponentProps, ReactNode } from 'react'

/** The serif the app already uses for its name and greeting, upright here, as the design sets its titles. */
export const DISPLAY = 'font-[family-name:var(--dt-font-display)] font-normal'

/** A card: 20px corners, the app's surface and hairline. Padding is `CARD_PAD` or `CARD_PAD_SM`. */
export const CARD = cn(
  'not-prose relative flex min-w-0 flex-col gap-0 rounded-[20px] border border-(--card-stroke) bg-(--card-surface) p-0 shadow-(--card-shadow)'
)

/** A main-column card's padding: every card's content starts on the same edge. */
export const CARD_PAD = 'px-6 py-5'

/** A side-column card's padding: the narrow cards beside the main column. */
export const CARD_PAD_SM = 'p-3.5'

/** The 1px-divided cells of a stat strip or a table head share this hairline. */
export const HAIRLINE = 'border-(--card-well-stroke)'

export const H2 = 'm-0 text-[0.9375rem] leading-snug font-medium text-(--ui-text-primary)'
export const H2_LARGE = 'm-0 text-[1.0625rem] leading-snug font-medium tracking-[-0.01em] text-(--ui-text-primary)'
export const MUTED = 'text-(--ui-text-tertiary)'

/** The soft fill behind a gain or a loss: the pill that carries a change. */
export const toneFill = (value: number) =>
  value > 0
    ? 'bg-[color-mix(in_srgb,var(--ui-green)_12%,transparent)]'
    : value < 0
      ? 'bg-[color-mix(in_srgb,var(--ui-red)_12%,transparent)]'
      : 'bg-(--card-well)'

/** A bordered button, 32px high (`h-8`); `BTN_PRIMARY` is the 36px one for the primary action of a card. */
export const BTN =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-(--card-stroke) bg-(--card-well) px-3 text-[0.8125rem] font-medium text-(--ui-text-primary) transition-colors hover:bg-(--card-well-hover,var(--card-well)) hover:border-(--ui-text-quaternary) disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-(--ui-accent)'

export const BTN_PRIMARY =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-(--ui-text-primary) px-4 text-[0.84375rem] font-semibold text-(--ui-bg-editor,var(--card-surface)) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

/** An input, select or textarea: 34px, 10px corners, a well fill. */
export const FIELD =
  'h-[2.125rem] w-full min-w-0 rounded-[10px] border border-(--card-stroke) bg-(--card-well) px-3 text-[0.84375rem] text-(--ui-text-primary) placeholder:text-(--ui-text-tertiary) focus:outline-none focus-visible:border-(--ui-text-tertiary)'

export const LABEL = 'text-[0.78125rem] text-(--ui-text-secondary)'

/** The page's head: the serif title, one line under it, and the page's own controls at the right. */
export function PageHeader({
  children,
  subtitle,
  title
}: {
  children?: ReactNode
  subtitle: ReactNode
  title: string
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className={cn(DISPLAY, 'm-0 text-[2.125rem] leading-[1.05] tracking-[-0.01em] text-(--ui-text-primary)')}>
          {title}
        </h1>
        <p className="m-0 text-[0.8125rem] text-(--ui-text-secondary)">{subtitle}</p>
      </div>
      {children}
    </header>
  )
}

/** A card's title row: the title (and an optional line under it) at the left, its action at the right. */
export function CardHead({
  children,
  large = false,
  subtitle,
  title
}: {
  children?: ReactNode
  large?: boolean
  subtitle?: ReactNode
  title: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className={large ? H2_LARGE : H2}>{title}</h2>
        {subtitle && (
          <p className={cn('m-0', large ? 'text-[0.84375rem] text-(--ui-text-secondary)' : 'text-[0.8125rem]', MUTED)}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

/** A small round number beside a title. */
export function CountPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-(--card-well) px-2 py-0.5 text-xs font-medium tabular-nums text-(--ui-text-secondary)">
      {children}
    </span>
  )
}

/** A dashed block that says there is nothing here yet. */
export function EmptyDashed({ children, className }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[14px] border border-dashed border-(--card-stroke) p-3.5 text-[0.84375rem] leading-relaxed text-(--ui-text-secondary)',
        className
      )}
    >
      {children}
    </div>
  )
}

/** A quiet note on a darker well: how something works, where a file lives. */
export function Note({ children, className }: ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-xl bg-(--card-well) p-3 text-[0.78125rem] leading-relaxed', MUTED, className)}>
      {children}
    </div>
  )
}
