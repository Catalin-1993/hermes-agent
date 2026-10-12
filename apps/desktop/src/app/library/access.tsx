import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import type { LibraryVisibility } from '@/store/library-consent'

/** Glyph + tone per access level: the same three marks in the list, the page header and the consent card. */
export const ACCESS_META: Record<LibraryVisibility, { icon: string; tone: string }> = {
  private: { icon: 'lock', tone: 'text-(--ui-text-tertiary)' },
  ask: { icon: 'shield', tone: 'text-[color-mix(in_srgb,var(--ui-yellow)_80%,var(--ui-text-primary))]' },
  open: { icon: 'eye', tone: 'text-[color-mix(in_srgb,var(--ui-green)_85%,var(--ui-text-primary))]' }
}

export const ACCESS_ORDER: readonly LibraryVisibility[] = ['private', 'ask', 'open']

/** A quiet, inert chip naming how Hermes may use an item. */
export function AccessBadge({ className, visibility }: { className?: string; visibility: LibraryVisibility }) {
  const { t } = useI18n()
  const meta = ACCESS_META[visibility]

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-(--ui-bg-quaternary) px-2 py-0.5 text-[0.6875rem] font-medium text-(--ui-text-secondary)',
        className
      )}
      data-access={visibility}
    >
      <Codicon className={meta.tone} name={meta.icon} size="0.75rem" />
      {t.library.access[visibility]}
    </span>
  )
}
