import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import { ACCESS_META, ACCESS_ORDER, AccessBadge } from './access'
import type { LibraryVisibility } from './data'

const HINT_KEY = { ask: 'askHint', open: 'openHint', private: 'privateHint' } as const

/** The owner's per-item rule for Hermes, as a menu: each level with what it means. */
export function AccessMenu({
  onChange,
  size = 'badge',
  visibility
}: {
  onChange: (next: LibraryVisibility) => void
  size?: 'badge' | 'button'
  visibility: LibraryVisibility
}) {
  const { t } = useI18n()
  const copy = t.library.access

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {size === 'button' ? (
          <Button aria-label={copy.label} size="sm" variant="secondary">
            <Codicon className={ACCESS_META[visibility].tone} name={ACCESS_META[visibility].icon} size="0.8125rem" />
            {copy[visibility]}
            <Codicon className="opacity-60" name="chevron-down" size="0.6875rem" />
          </Button>
        ) : (
          <button
            aria-label={copy.label}
            className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={event => event.stopPropagation()}
            type="button"
          >
            <AccessBadge className="hover:bg-(--ui-control-hover-background)" visibility={visibility} />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72" onClick={event => event.stopPropagation()}>
        {ACCESS_ORDER.map(level => (
          <DropdownMenuItem
            className="items-start gap-2.5 py-2"
            key={level}
            onSelect={() => level !== visibility && onChange(level)}
          >
            <Codicon className={cn('mt-0.5', ACCESS_META[level].tone)} name={ACCESS_META[level].icon} size="0.875rem" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs font-medium text-(--ui-text-primary)">{copy[level]}</span>
              <span className="text-[0.6875rem] leading-snug text-(--ui-text-tertiary)">{copy[HINT_KEY[level]]}</span>
            </span>
            {level === visibility && <Codicon className="mt-0.5 text-(--ui-accent)" name="check" size="0.8125rem" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
