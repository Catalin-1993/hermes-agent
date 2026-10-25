/**
 * A row of options, one selected — the chart's mode, range and interval switches, the page's variant.
 * In the design's sizes: a 10px well with a hairline holding 30px options; `large` is the 12px, 34px one
 * a page uses for its own choice (the variant), and `fill` makes the options share the row.
 */

import { cn } from '@hermes/plugin-sdk'

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
        large ? 'rounded-xl p-1' : 'rounded-[10px] p-[3px]',
        fill && 'w-full'
      )}
      role="radiogroup"
    >
      {options.map(option => (
        <button
          aria-checked={option.id === value}
          className={cn(
            'shrink-0 cursor-pointer font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            large ? 'h-[34px] rounded-[9px] px-4 text-[0.84375rem]' : 'h-[30px] rounded-lg px-3 text-[0.8125rem]',
            fill && 'flex-1',
            option.id === value
              ? 'bg-(--card-surface) text-(--ui-text-primary) shadow-(--card-shadow)'
              : 'text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
          )}
          disabled={option.disabled}
          key={option.id}
          onClick={() => onSelect(option.id)}
          role="radio"
          title={option.title}
          type="button"
        >
          {option.text}
        </button>
      ))}
    </div>
  )
}
