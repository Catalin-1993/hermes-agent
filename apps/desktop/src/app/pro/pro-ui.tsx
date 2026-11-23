/** Brain (Pro Mode): the small pieces every Pro panel tab is drawn with — one card, one dot, one switch. */

import { type ReactNode, useEffect, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import type { NoteStatus } from './board-model'

/** One colour per status, the same everywhere: done green, now blue, next grey, talked only purple, failed red. */
export const STATUS_TONE: Record<NoteStatus, string> = {
  done: 'var(--ui-green, #3fb950)',
  failed: 'var(--ui-red, #f85149)',
  next: 'var(--ui-text-tertiary)',
  now: 'var(--ui-accent, #4c8dff)',
  talked: 'var(--ui-purple, #a371f7)'
}

export function Dot({ className, tone }: { className?: string; tone: NoteStatus }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={
        tone === 'next' ? { boxShadow: `inset 0 0 0 1.5px ${STATUS_TONE.next}` } : { background: STATUS_TONE[tone] }
      }
    />
  )
}

export function Card({ children, label, trailing }: { children: ReactNode; label: string; trailing?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-(--ui-bg-quaternary,var(--chrome-action-hover)) p-3">
      <header className="flex min-h-5 items-center justify-between gap-2 text-[0.6875rem] text-(--ui-text-tertiary)">
        <h3 className="font-medium tracking-wide uppercase">{label}</h3>
        {trailing}
      </header>
      {children}
    </section>
  )
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Codicon className="text-(--ui-text-tertiary)" name={icon} size="1.25rem" />
      <p className="max-w-60 text-xs leading-relaxed text-(--ui-text-tertiary)">{text}</p>
    </div>
  )
}

export function Segmented<T extends string>({
  onChange,
  options,
  value
}: {
  onChange: (value: T) => void
  options: { label: string; value: T }[]
  value: T
}) {
  return (
    <div
      className="flex min-w-0 gap-0.5 rounded-full bg-(--ui-bg-quaternary,var(--chrome-action-hover)) p-0.5"
      role="tablist"
    >
      {options.map(option => (
        <button
          aria-selected={option.value === value}
          className={cn(
            'h-6 min-w-0 truncate rounded-full px-2.5 text-xs transition-colors',
            option.value === value
              ? 'bg-(--ui-bg-elevated,var(--ui-bg-editor)) text-foreground shadow-sm'
              : 'text-(--ui-text-secondary) hover:text-foreground'
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="tab"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** "2 min ago" for `at`, refreshed every half minute; undefined while there is nothing to date. */
export function useAgo(at: number | undefined): string | undefined {
  const { locale } = useI18n()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)

    return () => window.clearInterval(id)
  }, [])

  if (!at) {
    return undefined
  }

  const seconds = Math.round((at - now) / 1000)
  const format = new Intl.RelativeTimeFormat(locale || 'en', { numeric: 'auto', style: 'short' })

  for (const [unit, size] of [
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60]
  ] as const) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit)
    }
  }

  return format.format(0, 'minute')
}
