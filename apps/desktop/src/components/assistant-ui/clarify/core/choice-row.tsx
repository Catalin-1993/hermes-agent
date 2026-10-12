'use client'

import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { bareChoice, RECOMMENDED_LABEL } from '@/store/clarify'

export const letterFor = (index: number): string => String.fromCharCode(65 + index)

// The backend tags the agent's preferred option (`mark_recommended`); the card
// renders the label in tertiary text so the option itself still reads first.
export function ChoiceLabel({ choice }: { choice: string }) {
  const bare = bareChoice(choice)

  if (bare === choice) {
    return <>{choice}</>
  }

  return (
    <>
      {bare} <span className="text-(--ui-text-tertiary)">{RECOMMENDED_LABEL}</span>
    </>
  )
}

// Each option is a soft row of its own: a well on hover, a ring under the keyboard cursor, an accent
// tint once chosen (the agent cards' line — components/ui/hermes-card.tsx).
export const OPTION_ROW_CLASS =
  'flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition-[background-color,border-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-50'

export const OPTION_IDLE_CLASS = 'border-(--card-well-stroke) bg-(--card-well)'

export const OPTION_ACTIVE_CLASS =
  'border-[color-mix(in_srgb,var(--ui-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--ui-accent)_5%,var(--card-well))]'

const OPTION_SELECTED_CLASS =
  'border-[color-mix(in_srgb,var(--ui-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--ui-accent)_9%,transparent)] text-(--ui-text-primary)'

export function KeyBadge({
  char,
  disabled,
  preview,
  selected
}: {
  char: string
  disabled?: boolean
  preview?: boolean
  selected: boolean
}) {
  // The "Other" row is a <label>, which has no :disabled state of its own —
  // dim its badge alongside the disabled textarea so it matches the options.
  return (
    <Kbd
      className={cn(
        'mt-px size-5 shrink-0 justify-center rounded-full border-(--card-well-stroke) bg-(--card-surface) p-0 text-[0.625rem] font-semibold text-(--ui-text-tertiary) shadow-none',
        disabled && 'opacity-50',
        selected && 'border-(--ui-accent) bg-(--ui-accent) text-white',
        !selected && preview && 'border-(--ui-accent) text-(--ui-accent)'
      )}
      size="sm"
    >
      {char}
    </Kbd>
  )
}

/** A letter-badged option row. */
export function ChoiceButton({
  active = false,
  char,
  choice,
  disabled,
  keyShortcuts,
  onClick,
  selected
}: {
  active?: boolean
  char: string
  choice: string
  disabled?: boolean
  keyShortcuts?: string
  onClick: () => void
  selected?: boolean
}) {
  // `active` is the keyboard cursor on the live card (arrow-key navigation);
  // it highlights the row and previews its key badge.
  return (
    <button
      aria-current={active || undefined}
      aria-keyshortcuts={keyShortcuts}
      aria-pressed={selected}
      className={cn(
        OPTION_ROW_CLASS,
        OPTION_IDLE_CLASS,
        'text-(--ui-text-secondary) enabled:hover:border-(--card-stroke) enabled:hover:text-(--ui-text-primary)',
        active && OPTION_ACTIVE_CLASS,
        active && 'text-(--ui-text-primary)',
        selected && OPTION_SELECTED_CLASS
      )}
      data-choice
      data-highlighted={active || undefined}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <KeyBadge char={char} preview={active} selected={Boolean(selected)} />
      <span className="flex-1 wrap-anywhere">
        <ChoiceLabel choice={choice} />
      </span>
    </button>
  )
}
