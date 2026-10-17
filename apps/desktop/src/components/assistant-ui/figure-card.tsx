import { type ReactNode, useRef } from 'react'

import { CARD_SURFACE_CLASS } from '@/components/ui/hermes-card'
import { cn } from '@/lib/utils'

import { useFigureArea } from './use-figure-area'

/**
 * The one shell every figure in the chat is drawn in — a native chart, a diagram, an SVG graphic, a widget:
 * the app's card (24px corners, hairline stroke, its surface and soft shadow), the same padding and the
 * same title, with its tools in the top-right corner on hover. Inner panels (KPI tiles, a table's well)
 * use `--card-well`. `not-prose`: the message's markdown typography must not restyle a figure.
 */
export const FIGURE_CARD_CLASS = cn(CARD_SURFACE_CLASS, 'not-prose relative flex min-w-0 flex-col gap-4 px-5 pt-4 pb-5')

/** Lays a figure on the figure area — the text column, widened and centred on a wide window — so every
 *  kind of figure takes the same width in the same place. `group/widget` shows its toolbar on hover. */
export function FigureArea({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const figure = useFigureArea(outer)
  const room = figure ? Math.max(figure.area, figure.column) : 0
  const inset = figure ? (room - figure.column) / 2 : 0

  return (
    <div
      className={cn('group/widget my-3 min-w-0', className)}
      data-figure=""
      ref={outer}
      style={figure ? { marginInline: -inset, width: room } : undefined}
    >
      {children}
    </div>
  )
}

/** A figure's title and one-line subtitle. Not h3/p: the message's markdown styles would restyle them. */
export function FigureHeader({ subtitle, title }: { subtitle?: string; title?: string }) {
  if (!title && !subtitle) {
    return null
  }

  return (
    <header className="min-w-0 pr-16">
      {title && (
        <div
          aria-level={3}
          className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em] text-(--ui-text-primary)"
          role="heading"
        >
          {title}
        </div>
      )}
      {subtitle && <div className="mt-0.5 text-[0.75rem] text-(--ui-text-tertiary)">{subtitle}</div>}
    </header>
  )
}

/** A figure's place while it is still being written or drawn. */
export function FigureSkeleton({ height = '14rem' }: { height?: string }) {
  return (
    <FigureArea>
      <div className={cn(FIGURE_CARD_CLASS, 'gap-4')} data-figure-loading="">
        <div className="h-3.5 w-40 animate-pulse rounded-full bg-(--card-well-stroke)" />
        <div className="animate-pulse rounded-2xl bg-(--card-well)" style={{ height }} />
      </div>
    </FigureArea>
  )
}

/** A figure that could not be drawn: its source, readable, in the same card. */
export function FigureSource({ code }: { code: string }) {
  return (
    <FigureArea>
      <div className={FIGURE_CARD_CLASS} data-figure-source="">
        <pre className="max-h-[26rem] overflow-auto rounded-2xl border border-(--card-well-stroke) bg-(--card-well) p-4 font-mono text-[0.75rem] leading-relaxed whitespace-pre-wrap text-(--ui-text-secondary) wrap-anywhere">
          {code}
        </pre>
      </div>
    </FigureArea>
  )
}
