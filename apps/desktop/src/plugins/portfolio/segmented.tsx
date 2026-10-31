/**
 * A row of options, one selected — the chart's mode, range and interval switches, the page's variant.
 * In the design's sizes: a 10px well with a hairline holding 28px options; `large` is the 12px, 30px one
 * a page uses for its own choice (the variant), and `fill` makes the options share the row.
 */

import { cn, Tip } from '@hermes/plugin-sdk'
import { Fragment } from 'react'

export function Segmented<T extends string>({
  fill = false,
  label,
  large = false,
  onSelect,
  options,
  value
}: {
  fill?: boolean
  label: string
  large?: boolean
  onSelect: (next: T) => void
  options: { disabled?: boolean; id: T; text: string; title?: string }[]
  value: T
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        'flex max-w-full gap-0.5 overflow-x-auto border border-(--card-well-stroke) bg-(--card-well)',
        large ? 'rounded-xl p-[3px]' : 'rounded-[10px] p-[3px]',
        fill && 'w-full'
      )}
      role="radiogroup"
    >
      {options.map(option => {
        const button = (
          <button
            aria-checked={option.id === value}
            className={cn(
              'shrink-0 cursor-pointer font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              large ? 'h-[30px] rounded-[9px] px-3.5 text-[0.84375rem]' : 'h-7 rounded-lg px-3 text-[0.8125rem]',
              fill && 'flex-1',
              option.id === value
                ? 'bg-(--card-surface) text-(--ui-text-primary) shadow-(--card-shadow)'
                : 'text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
            )}
            disabled={option.disabled}
            onClick={() => onSelect(option.id)}
            role="radio"
            type="button"
          >
            {option.text}
          </button>
        )

        return option.title ? (
          <Tip key={option.id} label={option.title}>
            {button}
          </Tip>
        ) : (
          <Fragment key={option.id}>{button}</Fragment>
        )
      })}
    </div>
  )
}
