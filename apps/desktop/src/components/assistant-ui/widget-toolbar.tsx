import { type ReactNode, useState } from 'react'

import { saveWidgetToLibrary } from '@/app/library/chat-bridge'
import { Codicon } from '@/components/ui/codicon'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { Bookmark } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { WidgetPagePicker } from './widget-page-picker'

const TOOL_BUTTON_CLASS =
  'grid size-6 place-items-center rounded-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated)/90 text-(--ui-text-tertiary) backdrop-blur-md transition-colors hover:text-(--ui-text-primary)'

/**
 * The two things a finished widget offers, shown on hover in its corner: what internet access it has
 * (and the way to take it back), and keeping it in the Library — as a page of its own or at the end of
 * one the owner picks. Sits in a `group/widget`.
 */
interface WidgetToolbarProps {
  expanded?: boolean
  globe: ReactNode
  html: null | string
  /** Offered when the host can show the widget full screen. */
  onExpandedChange?: (expanded: boolean) => void
}

export function WidgetToolbar({ expanded = false, globe, html, onExpandedChange }: WidgetToolbarProps) {
  const { t } = useI18n()
  const label = t.inlineWidget.addToPage
  const sizeLabel = expanded ? t.library.editor.interactiveCollapse : t.library.editor.interactiveExpand
  const [open, setOpen] = useState(false)

  if (!html) {
    return null
  }

  return (
    <span
      className={cn(
        'absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover/widget:opacity-100 focus-within:opacity-100',
        (open || expanded) && 'opacity-100',
        expanded && 'top-3 right-3'
      )}
    >
      {globe}
      {onExpandedChange && (
        <Tip label={sizeLabel}>
          <button
            aria-label={sizeLabel}
            className={TOOL_BUTTON_CLASS}
            onClick={() => onExpandedChange(!expanded)}
            type="button"
          >
            <Codicon name={expanded ? 'screen-normal' : 'screen-full'} size="0.8125rem" />
          </button>
        </Tip>
      )}
      {!expanded && (
        <Popover onOpenChange={setOpen} open={open}>
          <Tip label={label}>
            <PopoverTrigger asChild>
              <button aria-label={label} className={TOOL_BUTTON_CLASS} type="button">
                <Bookmark className="size-3.5" />
              </button>
            </PopoverTrigger>
          </Tip>
          <PopoverContent align="end" className="w-64 p-0" side="bottom">
            <WidgetPagePicker
              onPick={page => {
                setOpen(false)
                void saveWidgetToLibrary(html, page ?? undefined)
              }}
            />
          </PopoverContent>
        </Popover>
      )}
    </span>
  )
}
