/**
 * The chart's top bar, TradingView style, one button for each thing: Compare (+), the interval (one button,
 * its list opens on press), the chart type (candles, bars, line, area), and the view menu — Chart,
 * Derivatives, Technicals, Seasonals, News, Community — beside the symbol's name.
 */

import { cn, Codicon, Popover, PopoverContent, PopoverTrigger, Tip } from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import { COPY } from './copy'
import type { Interval } from './market-feed'
import type { ChartMode } from './studio-canvas'
import { PickMenu, TOP_BTN } from './studio-toolbar'
import { type Pick } from './symbol-picker'
import { SymbolSearch } from './symbol-search'

export type View = 'chart' | 'community' | 'derivatives' | 'news' | 'seasonals' | 'technicals'

const svg = (children: ReactNode) => (
  <svg
    fill="none"
    height="18"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="1.5"
    viewBox="0 0 20 20"
    width="18"
  >
    {children}
  </svg>
)

export const MODE_ICON: Record<ChartMode, ReactNode> = {
  area: svg(<path d="M2 15 7 9l4 3 7-8v12H2z" fill="currentColor" fillOpacity="0.25" />),
  bars: svg(<path d="M5 3v14M3 6h2M5 12h2M11 4v13M9 7h2M11 14h2M17 6v10M15 8h2M17 13h2" />),
  candles: svg(
    <>
      <path d="M6 3v3M6 14v3M14 5v2M14 15v2" />
      <rect height="8" rx="1" width="4" x="4" y="6" />
      <rect height="8" rx="1" width="4" x="12" y="7" />
    </>
  ),
  line: svg(<path d="m2 14 5-5 4 3 7-8" />)
}

const MODES: ChartMode[] = ['candles', 'bars', 'line', 'area']

export function ChartTypeMenu({ mode, onMode }: { mode: ChartMode; onMode: (mode: ChartMode) => void }) {
  const copy = COPY.studio.modes

  return (
    <PickMenu
      label={COPY.chart.mode}
      onPick={onMode}
      options={MODES.map(id => ({ icon: MODE_ICON[id], id, text: copy[id] }))}
      value={mode}
      width="w-48"
    >
      {MODE_ICON[mode]}
      <Codicon className="-mr-0.5 opacity-60" name="chevron-down" size="0.75rem" />
    </PickMenu>
  )
}

export function IntervalMenu({
  interval,
  intervals,
  onInterval
}: {
  interval: Interval
  intervals: Interval[]
  onInterval: (interval: Interval) => void
}) {
  const copy = COPY.watchlist

  return (
    <PickMenu
      label={copy.interval}
      onPick={onInterval}
      options={intervals.map(id => ({ id, text: COPY.studio.intervalNames[id] }))}
      value={interval}
      width="w-44"
    >
      <span data-portfolio-interval="">{copy.intervals[interval]}</span>
      <Codicon className="-mr-0.5 opacity-60" name="chevron-down" size="0.75rem" />
    </PickMenu>
  )
}

/** "+": opens the symbol search and puts the pick over the chart as a percentage line. */
export function CompareButton({ onPick }: { onPick: (pick: Pick) => void }) {
  const copy = COPY.studio

  return (
    <SymbolSearch onPick={onPick} title={copy.compareTitle}>
      <button aria-label={copy.compare} className={cn(TOP_BTN, 'w-9 px-0')} type="button">
        <Tip label={copy.compare}>
          <span className="grid size-9 place-items-center">
            <Codicon name="add" size="1.125rem" />
          </span>
        </Tip>
      </button>
    </SymbolSearch>
  )
}

const VIEW_ICON: Record<View, string> = {
  chart: 'graph',
  community: 'organization',
  derivatives: 'git-compare',
  news: 'book',
  seasonals: 'calendar',
  technicals: 'dashboard'
}

const VIEW_GROUPS: { title?: string; views: View[] }[] = [
  { views: ['chart'] },
  { title: 'fundamentals', views: ['derivatives'] },
  { title: 'analysis', views: ['technicals', 'seasonals', 'news', 'community'] }
]

/** The small button beside the symbol's name: Chart, then Derivatives, then the analysis views. */
export function ViewMenu({ onView, view }: { onView: (view: View) => void; view: View }) {
  const copy = COPY.studio.views
  const [open, setOpen] = useState(false)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <Tip label={copy.label}>
        <PopoverTrigger asChild>
          <button
            aria-label={copy.label}
            className="grid h-9 w-11 shrink-0 cursor-pointer place-items-center rounded-lg bg-(--card-well) text-(--ui-text-secondary) transition-colors hover:text-(--ui-text-primary) data-[state=open]:text-(--ui-text-primary)"
            data-portfolio-view-menu=""
            type="button"
          >
            <span className="flex items-center gap-0.5">
              {MODE_ICON.candles}
              <Codicon name="chevron-down" size="0.625rem" />
            </span>
          </button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" className="flex w-60 flex-col gap-1 p-2.5" data-portfolio-views="">
        {VIEW_GROUPS.map((group, index) => (
          <div className="flex flex-col gap-0.5" key={group.title ?? 'main'}>
            {index > 0 && <span aria-hidden className="my-1.5 h-px bg-(--card-well-stroke)" />}
            {group.title && (
              <span className="px-2.5 pt-1 pb-1.5 text-[0.6875rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
                {copy.groups[group.title as 'analysis' | 'fundamentals']}
              </span>
            )}
            {group.views.map(id => (
              <button
                aria-checked={id === view}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[0.9375rem] transition-colors hover:bg-(--card-well)',
                  id === view
                    ? 'bg-(--card-well) font-medium text-(--ui-text-primary)'
                    : 'text-(--ui-text-secondary) hover:text-(--ui-text-primary)'
                )}
                key={id}
                onClick={() => {
                  onView(id)
                  setOpen(false)
                }}
                role="menuitemradio"
                type="button"
              >
                <Codicon name={VIEW_ICON[id]} size="1.0625rem" />
                {copy[id]}
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/** Replay: pick a starting bar, then step through the market from there. */
export function ReplayButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const copy = COPY.studio.replay

  return (
    <button aria-pressed={active} className={TOP_BTN} data-portfolio-replay="" onClick={onClick} type="button">
      <Codicon name="debug-reverse-continue" size="1rem" />
      {copy.button}
    </button>
  )
}
