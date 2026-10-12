import type * as React from 'react'

import { cn } from '@/lib/utils'

interface SidebarPanelLabelProps extends React.ComponentProps<'span'> {
  meta?: React.ReactNode
}

/** A quiet section heading for side panels: sentence case, tertiary ink, so
 *  the rows under it — not the heading — carry the colour and weight. */
export function SidebarPanelLabel({ children, className, meta, ...props }: SidebarPanelLabelProps) {
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-2 pl-2 text-[0.6875rem] font-medium text-(--ui-text-tertiary)',
        className
      )}
      {...props}
    >
      <span className="min-w-0 truncate leading-none">{children}</span>
      {meta && <span className="shrink-0 text-[0.6875rem] font-normal text-(--ui-text-quaternary)">{meta}</span>}
    </span>
  )
}
