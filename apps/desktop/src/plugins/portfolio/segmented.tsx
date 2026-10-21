/** A row of pill options, one selected — the chart's mode, range and interval switches. */

import { cn } from '@hermes/plugin-sdk'

export function Segmented<T extends string>({
  label,
  onSelect,
  options,
  value
}: {
  label: string
  onSelect: (next: T) => void
  options: { disabled?: boolean; id: T; text: string; title?: string }[]
  value: T
}) {
  return (
    <div aria-label={label} className="flex rounded-full bg-(--card-well) p-0.5 text-[0.75rem]" role="radiogroup">
      {options.map(option => (
        <button
          aria-checked={option.id === value}
          className={cn(
            'h-6 cursor-pointer rounded-full px-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
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
