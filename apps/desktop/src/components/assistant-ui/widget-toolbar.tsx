import { type ReactNode, useState } from 'react'

import { requestComposerFocus, requestComposerInsert } from '@/app/chat/composer/focus'
import { saveWidgetToLibrary } from '@/app/library/chat-bridge'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { Bookmark } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { WidgetPagePicker } from './widget-page-picker'

const TOOL_BUTTON_CLASS =
  'grid size-6 place-items-center rounded-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated)/90 text-(--ui-text-tertiary) backdrop-blur-md transition-colors hover:text-(--ui-text-primary) data-[state=open]:text-(--ui-text-primary)'

/**
 * What a finished figure offers, in one ⋯ menu in its corner (shown on hover): full screen, keeping it in the
 * Library — as a page of its own or at the end of one the owner picks — and Edit, which hands the chat's
 * composer a line naming the figure so the owner only types what to change. Next to it, what internet access
 * a widget has (and the way to take it back). Sits in a `group/widget`.
 */
interface WidgetToolbarProps {
  expanded?: boolean
  globe: ReactNode
  html: null | string
  /** Offered when the host can show the widget full screen. */
  onExpandedChange?: (expanded: boolean) => void
  /** The figure's own title, so Edit can name it to the agent. */
  title?: string
}

export function WidgetToolbar({ expanded = false, globe, html, onExpandedChange, title }: WidgetToolbarProps) {
  const { t } = useI18n()
  const w = t.inlineWidget
  const sizeLabel = expanded ? t.library.editor.interactiveCollapse : t.library.editor.interactiveExpand
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  if (!html) {
    return null
  }

  const edit = () => {
    const name = title?.trim() ? `“${title.trim()}”` : w.editUntitled

    if (expanded) {
      onExpandedChange?.(false)
    }

    requestComposerInsert(w.editPrompt(name), { mode: 'inline' })
    requestComposerFocus()
  }

  return (
    <span
      className={cn(
        'absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover/widget:opacity-100 focus-within:opacity-100',
        (menuOpen || pickerOpen || expanded) && 'opacity-100',
        expanded && 'top-3 right-3'
      )}
    >
      {globe}
      <Popover onOpenChange={setPickerOpen} open={pickerOpen}>
        <PopoverAnchor asChild>
          <span className="flex">
            <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
              <Tip label={w.more}>
                <DropdownMenuTrigger asChild>
                  <button aria-label={w.more} className={TOOL_BUTTON_CLASS} type="button">
                    <Codicon name="ellipsis" size="0.8125rem" />
                  </button>
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="end" className="min-w-44">
                {onExpandedChange && (
                  <DropdownMenuItem onSelect={() => onExpandedChange(!expanded)}>
                    <Codicon name={expanded ? 'screen-normal' : 'screen-full'} size="0.8125rem" />
                    {sizeLabel}
                  </DropdownMenuItem>
                )}
                {!expanded && (
                  <DropdownMenuItem
                    // The page list opens beside the ⋯ once the menu has closed.
                    onSelect={() => window.setTimeout(() => setPickerOpen(true), 0)}
                  >
                    <Bookmark className="size-3.5" />
                    {w.addToPage}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={edit}>
                  <Codicon name="edit" size="0.8125rem" />
                  {w.edit}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </PopoverAnchor>
        <PopoverContent align="end" className="w-64 p-0" side="bottom">
          <WidgetPagePicker
            onPick={page => {
              setPickerOpen(false)
              void saveWidgetToLibrary(html, page ?? undefined)
            }}
          />
        </PopoverContent>
      </Popover>
    </span>
  )
}
