import type { ReactNode } from 'react'

import { PlatformAvatar } from '@/app/messaging/platform-icon'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface MessagingDockSource {
  label: string
  sourceId: string
}

interface MessagingDockProps {
  /** One button per messaging source (API, Telegram, …), in the sidebar's order. */
  sources: readonly MessagingDockSource[]
  /** The source's conversations, drawn in the popover its button opens. */
  renderSessions: (sourceId: string) => ReactNode
}

/** The API names itself; other platforms are known by their icon alone. */
const keepsLabel = (sourceId: string) => sourceId === 'api' || sourceId.startsWith('api_')

/**
 * Messaging sources as a quiet strip at the sidebar's foot, above the account row. It rests collapsed and
 * opens while the pointer is over the sidebar's foot (or a button in it has focus), so the session list keeps
 * the column; each button opens that source's conversations in a popover.
 */
export function MessagingDock({ renderSessions, sources }: MessagingDockProps) {
  if (sources.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-200 ease-out',
        'group-hover/sidebar-foot:grid-rows-[1fr] group-hover/sidebar-foot:opacity-100',
        'focus-within:grid-rows-[1fr] focus-within:opacity-100 has-[[data-state=open]]:grid-rows-[1fr] has-[[data-state=open]]:opacity-100'
      )}
      data-slot="sidebar-messaging-dock"
    >
      <div className="flex min-h-0 flex-wrap items-center gap-0.5 overflow-hidden px-1 pt-1">
        {sources.map(source => {
          const icon = (
            <PlatformAvatar
              className="size-4 rounded-[4px] text-[0.5625rem] [&_svg]:size-3"
              platformId={source.sourceId}
              platformName={source.label}
            />
          )

          const button = (
            <PopoverTrigger
              aria-label={source.label}
              className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-xs text-(--ui-text-secondary) transition-colors hover:bg-(--ui-row-hover-background) hover:text-(--ui-text-primary) data-[state=open]:bg-(--ui-row-hover-background)"
            >
              {icon}
              {keepsLabel(source.sourceId) && <span>{source.label}</span>}
            </PopoverTrigger>
          )

          return (
            <Popover key={source.sourceId}>
              {keepsLabel(source.sourceId) ? (
                button
              ) : (
                <Tip label={source.label} side="top">
                  {button}
                </Tip>
              )}
              <PopoverContent align="start" className="w-72 p-1" side="top" sideOffset={6}>
                {renderSessions(source.sourceId)}
              </PopoverContent>
            </Popover>
          )
        })}
      </div>
    </div>
  )
}
