import type { ComponentProps, CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The card the agent hands the user when it needs something — an approval, a question, a consent, an
 * offer — and the surface every inline widget sits on. One design line for all of them: a soft raised
 * surface (`--card-*` in styles.css, light and dark), a tinted icon tile that says what kind of moment
 * this is, a calm header, inset wells for the details, and a footer of pill buttons.
 *
 * The parts compose freely; a card that lives inside another surface (the approval stack) uses the
 * parts without `HermesCard` itself.
 */

export type CardTone = 'accent' | 'danger' | 'neutral' | 'success' | 'warning'

const TONE: Record<CardTone, string> = {
  accent: 'var(--ui-accent)',
  danger: 'var(--ui-red)',
  neutral: 'var(--ui-text-secondary)',
  success: 'var(--ui-green)',
  warning: 'var(--ui-orange)'
}

/** The raised surface on its own — for hosts that draw it themselves (the approval card stack). */
export const CARD_SURFACE_CLASS = 'rounded-3xl border border-(--card-stroke) bg-(--card-surface) shadow-(--card-shadow)'

/** Pill buttons in a card footer. */
export const CARD_BUTTON_CLASS = 'h-8 rounded-full px-3.5 text-[0.8125rem]'

const toneStyle = (tone: CardTone): CSSProperties => ({ '--tone': TONE[tone] }) as CSSProperties

export function HermesCard({ children, className, ...props }: ComponentProps<'article'>) {
  return (
    <article
      className={cn(
        CARD_SURFACE_CLASS,
        'relative min-w-0 overflow-hidden text-(--ui-text-primary) duration-300 animate-in fade-in-0 slide-in-from-bottom-1',
        className
      )}
      {...props}
    >
      {children}
    </article>
  )
}

export function HermesCardIcon({
  children,
  className,
  size = 'md',
  tone = 'accent'
}: {
  children: ReactNode
  className?: string
  size?: 'md' | 'sm'
  tone?: CardTone
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-[color-mix(in_srgb,var(--tone)_12%,transparent)] text-(--tone) shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--tone)_14%,transparent)]',
        size === 'md' ? 'size-9 rounded-[0.8rem]' : 'size-7 rounded-[0.6rem]',
        className
      )}
      style={toneStyle(tone)}
    >
      {children}
    </span>
  )
}

export function HermesCardHeader({
  aside,
  className,
  eyebrow,
  icon,
  title,
  tone = 'accent'
}: {
  aside?: ReactNode
  className?: string
  eyebrow?: ReactNode
  icon?: ReactNode
  title: ReactNode
  tone?: CardTone
}) {
  return (
    <header className={cn('flex min-w-0 items-center gap-3 px-4 pt-4', className)}>
      {icon && <HermesCardIcon tone={tone}>{icon}</HermesCardIcon>}
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="m-0 truncate text-[0.6875rem] font-medium tracking-[0.01em] text-(--ui-text-tertiary)">
            {eyebrow}
          </p>
        )}
        <p className="m-0 text-[0.875rem] font-semibold leading-snug tracking-[-0.01em] text-(--ui-text-primary)">
          {title}
        </p>
      </div>
      {aside}
    </header>
  )
}

export function HermesCardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex min-w-0 flex-col gap-3 px-4 pt-3.5', className)} {...props} />
}

/** An inset region inside a card: the command, the target item, a preview. */
export function HermesCardWell({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('min-w-0 rounded-2xl border border-(--card-well-stroke) bg-(--card-well) px-3 py-2.5', className)}
      {...props}
    />
  )
}

/** A labelled fact in a card's `<dl>`. */
export function HermesCardField({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[0.6875rem] font-medium tracking-[0.01em] text-(--ui-text-tertiary)">{label}</dt>
      <dd className="m-0 min-w-0 text-[0.8125rem] leading-relaxed text-(--ui-text-primary)">{children}</dd>
    </div>
  )
}

export function HermesCardActions({
  children,
  className,
  note,
  ...props
}: ComponentProps<'footer'> & { note?: ReactNode }) {
  return (
    <footer className={cn('flex min-w-0 items-center gap-3 px-4 pt-3.5 pb-4', className)} {...props}>
      <span className="min-w-0 flex-1 text-[0.6875rem] leading-snug text-(--ui-text-tertiary)">{note}</span>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </footer>
  )
}
