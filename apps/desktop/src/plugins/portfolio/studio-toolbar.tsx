/**
 * The chart studio's controls, TradingView style: the "Indicators" button (one button, a searchable list),
 * the drawing tools in a rail down the chart's left edge, the legend over the chart (the bar under the
 * crosshair, and a small button that opens the list of the indicators on the chart) and the bar that
 * appears over a selected drawing (its colour, delete).
 */

import { Button, cn, Codicon, Input, Popover, PopoverContent, PopoverTrigger, Tip } from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import { COPY } from './copy'
import { quotePrice } from './format'
import type { Bar } from './market-feed'
import {
  CATALOG,
  type Indicator,
  INDICATOR_ORDER,
  type IndicatorType,
  type LineSpec,
  paramsOf,
  shortName
} from './studio-model'

export type Tool = 'alert' | 'cursor' | 'fib' | 'hline' | 'note' | 'ray' | 'rect' | 'trend' | 'vline'

/** The look of a button on the chart's top bar: flat until hovered, as TradingView's. */
export const TOP_BTN =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-medium text-(--ui-text-secondary) transition-colors hover:bg-(--card-well) hover:text-(--ui-text-primary) data-[state=open]:bg-(--card-well) data-[state=open]:text-(--ui-text-primary) aria-pressed:bg-(--card-well) aria-pressed:text-(--ui-text-primary) disabled:cursor-not-allowed disabled:opacity-50'

/** A hairline between groups of buttons on the top bar. */
export const BarDivider = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-(--card-well-stroke)" />

const SVG: Record<'fib' | 'hline' | 'ray' | 'rect' | 'trend' | 'vline', ReactNode> = {
  fib: (
    <>
      <path d="M3 4h14M3 8h10M3 12h10M3 16h14" />
      <path d="M4 16 16 4" strokeDasharray="2 2" />
    </>
  ),
  hline: (
    <>
      <path d="M2 10h16" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" />
    </>
  ),
  ray: (
    <>
      <circle cx="4" cy="14" r="1.6" fill="currentColor" />
      <path d="M4 14 17 5M13 4.5 17 5l-1 4" />
    </>
  ),
  rect: <rect height="10" rx="1" width="14" x="3" y="5" />,
  trend: (
    <>
      <path d="M4 15 16 5" />
      <circle cx="4" cy="15" r="1.6" fill="currentColor" />
      <circle cx="16" cy="5" r="1.6" fill="currentColor" />
    </>
  ),
  vline: (
    <>
      <path d="M10 2v16" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" />
    </>
  )
}

function ToolIcon({ tool }: { tool: Tool }) {
  if (tool === 'cursor') {
    return (
      <svg
        fill="none"
        height="20"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 20 20"
        width="20"
      >
        <path d="M5 3 15 9.5l-4.2 1.1L9 15z" />
      </svg>
    )
  }

  if (tool === 'note') {
    return <Codicon name="note" size="1rem" />
  }

  if (tool === 'alert') {
    return <Codicon name="bell" size="1rem" />
  }

  return (
    <svg
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
      viewBox="0 0 20 20"
      width="20"
    >
      {SVG[tool]}
    </svg>
  )
}

const RAIL_TOOLS: Tool[] = ['cursor', 'trend', 'ray', 'hline', 'vline', 'rect', 'fib', 'note', 'alert']

/** The drawing tools, one under another along the chart's left edge. */
export function ToolRail({
  onClear,
  onTool,
  tool,
  withDrawings
}: {
  onClear: () => void
  onTool: (tool: Tool) => void
  tool: Tool
  /** Whether there is anything drawn to clear. */
  withDrawings: boolean
}) {
  const copy = COPY.studio

  return (
    <div
      aria-label={copy.toolsLabel}
      className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-(--card-well-stroke) py-2.5"
      data-portfolio-tools=""
      role="toolbar"
    >
      {RAIL_TOOLS.map(name => (
        <Tip key={name} label={copy.tools[name]} side="right">
          <button
            aria-label={copy.tools[name]}
            aria-pressed={tool === name}
            className={cn(
              'grid size-9 cursor-pointer place-items-center rounded-lg transition-colors',
              tool === name
                ? 'bg-(--card-well) text-(--ui-text-primary) shadow-[inset_0_0_0_1px_var(--card-well-stroke)]'
                : 'text-(--ui-text-tertiary) hover:bg-(--card-well) hover:text-(--ui-text-primary)'
            )}
            onClick={() => onTool(name)}
            type="button"
          >
            <ToolIcon tool={name} />
          </button>
        </Tip>
      ))}
      {withDrawings && (
        <>
          <span aria-hidden className="my-1 h-px w-6 bg-(--card-well-stroke)" />
          <Tip label={copy.clearDrawings} side="right">
            <button
              aria-label={copy.clearDrawings}
              className="grid size-9 cursor-pointer place-items-center rounded-lg text-(--ui-text-tertiary) transition-colors hover:bg-(--card-well) hover:text-(--ui-red)"
              onClick={onClear}
              type="button"
            >
              <Codicon name="trash" size="1rem" />
            </button>
          </Tip>
        </>
      )}
    </div>
  )
}

/** One button on the top bar that opens a short list: the interval, the chart type. */
export function PickMenu<T extends string>({
  children,
  label,
  onPick,
  options,
  value,
  width = 'w-44'
}: {
  /** What the button shows (the current choice). */
  children: ReactNode
  label: string
  onPick: (id: T) => void
  options: { icon?: ReactNode; id: T; text: string }[]
  value: T
  width?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <Tip label={label}>
        <PopoverTrigger asChild>
          <button aria-label={label} className={TOP_BTN} type="button">
            {children}
          </button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" className={cn('flex flex-col gap-0.5 p-1.5', width)}>
        {options.map(option => (
          <button
            aria-checked={option.id === value}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[0.84375rem] hover:bg-(--card-well)',
              option.id === value ? 'text-(--ui-text-primary)' : 'text-(--ui-text-secondary)'
            )}
            key={option.id}
            onClick={() => {
              onPick(option.id)
              setOpen(false)
            }}
            role="menuitemradio"
            type="button"
          >
            {option.icon && <span className="grid size-4 place-items-center">{option.icon}</span>}
            <span className="flex-1">{option.text}</span>
            {option.id === value && <Codicon name="check" size="0.85rem" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export function IndicatorMenu({ onAdd }: { onAdd: (type: IndicatorType) => void }) {
  const copy = COPY.studio
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()

  const shown = INDICATOR_ORDER.filter(
    type => !needle || `${type} ${CATALOG[type].label}`.toLowerCase().includes(needle)
  )

  const group = (pane: boolean) => shown.filter(type => CATALOG[type].pane === pane)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button className={TOP_BTN} type="button">
          <Codicon name="pulse" size="1rem" />
          {copy.indicators}
          <Codicon className="-mr-0.5 opacity-60" name="chevron-down" size="0.75rem" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-2">
        <Input autoFocus onChange={event => setQuery(event.target.value)} placeholder={copy.search} value={query} />
        <div className="flex max-h-80 flex-col overflow-y-auto">
          {([false, true] as const).map(pane =>
            group(pane).length ? (
              <div className="flex flex-col" key={String(pane)}>
                <div className="px-2 pt-2 pb-1 text-[0.625rem] font-semibold tracking-wide text-(--ui-text-tertiary) uppercase">
                  {pane ? copy.inPane : copy.onPrice}
                </div>
                {group(pane).map(type => (
                  <button
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem] text-(--ui-text-primary) hover:bg-(--card-well)"
                    key={type}
                    onClick={() => {
                      onAdd(type)
                      setOpen(false)
                      setQuery('')
                    }}
                    type="button"
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: CATALOG[type].color }} />
                    {CATALOG[type].label}
                  </button>
                ))}
              </div>
            ) : null
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ParamsPopover({
  indicator,
  onChange
}: {
  indicator: Indicator
  onChange: (params: Record<string, number>) => void
}) {
  const values = paramsOf(indicator)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={COPY.studio.settings}
          className="grid size-6 cursor-pointer place-items-center rounded-md text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
          type="button"
        >
          <Codicon name="gear" size="0.8125rem" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-60 flex-col gap-2 p-3">
        <div className="text-[0.75rem] font-medium text-(--ui-text-primary)">{CATALOG[indicator.type].label}</div>
        {CATALOG[indicator.type].params.map(spec => (
          <label
            className="flex items-center justify-between gap-2 text-[0.75rem] text-(--ui-text-tertiary)"
            key={spec.name}
          >
            {spec.label}
            <input
              aria-label={spec.label}
              className="h-7 w-20 rounded-lg bg-(--card-well) px-2 text-right text-(--ui-text-primary) tabular-nums focus:outline-none"
              max={spec.max}
              min={spec.min}
              onChange={event => onChange({ ...values, [spec.name]: Number(event.target.value) })}
              step={spec.step}
              type="number"
              value={values[spec.name]}
            />
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/** The change on the legend's bar, in as many decimals as the price itself shows. */
const changeFormat = (price: number) =>
  new Intl.NumberFormat('ro-RO', { maximumFractionDigits: price >= 1000 ? 0 : price >= 1 ? 2 : 6 })

const ROW_ICON =
  'grid size-6 cursor-pointer place-items-center rounded-md text-(--ui-text-tertiary) hover:bg-(--card-well) hover:text-(--ui-text-primary)'

/**
 * The legend over the chart's top-left corner: what the chart is (symbol, interval), the bar under the
 * crosshair (the last one when the pointer is away), and a small button with the number of indicators and
 * compared symbols on the chart, which opens their list: settings, show / hide and remove for each.
 */
export function Legend({
  bar,
  compare,
  indicators,
  interval,
  lines,
  name,
  onChange,
  onRemove,
  onRemoveCompare,
  previous
}: {
  bar: Bar | null
  compare: { color: string; id: string; label: string }[]
  indicators: Indicator[]
  interval: string
  /** Lines the host page draws (a strategy's averages): named here, not editable. */
  lines: LineSpec[]
  name: string
  onChange: (indicator: Indicator) => void
  onRemove: (id: string) => void
  onRemoveCompare: (id: string) => void
  /** The close before `bar`, for the change shown after it. */
  previous: null | number
}) {
  const copy = COPY.studio
  const [open, setOpen] = useState(false)
  const named = lines.filter(line => line.label)
  const count = indicators.length + compare.length + named.length
  const up = bar ? bar.close >= bar.open : true
  const change = bar && previous ? bar.close - previous : null

  return (
    <div
      className="pointer-events-none absolute top-1.5 left-3 z-10 flex max-w-[calc(100%-6rem)] flex-col items-start gap-1 text-[0.75rem]"
      data-portfolio-studio-legend=""
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
        <span className="font-medium text-(--ui-text-primary)">
          {name} · {interval}
        </span>
        {bar && (
          <span className="flex flex-wrap gap-x-2" style={{ color: up ? 'var(--ui-green)' : 'var(--ui-red)' }}>
            {(['open', 'high', 'low', 'close'] as const).map(key => (
              <span key={key}>
                <span className="text-(--ui-text-tertiary)">{copy.ohlc[key]}</span> {quotePrice(bar[key])}
              </span>
            ))}
            {change !== null && previous !== null && (
              <span>
                {change >= 0 ? '+' : '−'}
                {changeFormat(previous).format(Math.abs(change))} ({change >= 0 ? '+' : '−'}
                {Math.abs((change / previous) * 100).toFixed(2)}%)
              </span>
            )}
          </span>
        )}
      </div>
      {count > 0 && (
        <button
          aria-expanded={open}
          aria-label={copy.legendToggle(count)}
          className="pointer-events-auto inline-flex h-6 cursor-pointer items-center gap-1 rounded-md bg-(--card-well) px-1.5 text-[0.75rem] text-(--ui-text-secondary) hover:text-(--ui-text-primary)"
          data-portfolio-legend-toggle=""
          onClick={() => setOpen(value => !value)}
          type="button"
        >
          <Codicon name={open ? 'chevron-up' : 'chevron-down'} size="0.75rem" />
          {count}
        </button>
      )}
      {open && (
        <div
          className="pointer-events-auto flex flex-col gap-0.5 rounded-xl border border-(--card-well-stroke) bg-(--card-surface) p-1 shadow-(--card-shadow)"
          data-portfolio-legend-list=""
        >
          {named.map(line => (
            <div className="flex items-center gap-2 px-2 py-1 text-(--ui-text-secondary)" key={line.id}>
              <span className="h-0.5 w-3.5 rounded-sm" style={{ background: line.color }} />
              {line.label}
            </div>
          ))}
          {compare.map(other => (
            <div className="flex items-center gap-2 py-0.5 pr-1 pl-2 text-(--ui-text-secondary)" key={other.id}>
              <span className="h-0.5 w-3.5 rounded-sm" style={{ background: other.color }} />
              <span className="flex-1">{other.label}</span>
              <button
                aria-label={copy.remove}
                className={ROW_ICON}
                onClick={() => onRemoveCompare(other.id)}
                type="button"
              >
                <Codicon name="close" size="0.8125rem" />
              </button>
            </div>
          ))}
          {indicators.map(indicator => (
            <div className="flex items-center gap-1 py-0.5 pr-1 pl-2 text-(--ui-text-secondary)" key={indicator.id}>
              <span
                className="mr-1 size-[7px] rounded-full"
                style={{ backgroundColor: indicator.color ?? CATALOG[indicator.type].color }}
              />
              <span className={cn('mr-2 flex-1', indicator.hidden && 'line-through opacity-60')}>
                {shortName(indicator)}
              </span>
              {CATALOG[indicator.type].params.length > 0 && (
                <ParamsPopover indicator={indicator} onChange={params => onChange({ ...indicator, params })} />
              )}
              <button
                aria-label={indicator.hidden ? copy.show : copy.hide}
                className={ROW_ICON}
                onClick={() => onChange({ ...indicator, hidden: !indicator.hidden })}
                type="button"
              >
                <Codicon name={indicator.hidden ? 'eye-closed' : 'eye'} size="0.8125rem" />
              </button>
              <button
                aria-label={copy.remove}
                className={ROW_ICON}
                onClick={() => onRemove(indicator.id)}
                type="button"
              >
                <Codicon name="close" size="0.8125rem" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Colours a selected drawing can take. */
export const DRAWING_SWATCHES = ['#60a5fa', '#f1f5f9', '#fbbf24', '#34d399', '#f87171', '#a78bfa']

/** The bar over a selected drawing: its colour and delete — TradingView's floating drawing toolbar. */
export function DrawingBar({
  color,
  name,
  onColor,
  onRemove
}: {
  color: null | string
  name: string
  onColor: (color: string) => void
  onRemove: () => void
}) {
  const copy = COPY.studio

  return (
    <div
      className="absolute top-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-(--card-well-stroke) bg-(--card-surface) py-1 pr-1 pl-3 shadow-(--card-shadow)"
      data-portfolio-drawing-bar=""
    >
      <span className="mr-1 text-[0.75rem] text-(--ui-text-secondary)">{name}</span>
      {DRAWING_SWATCHES.map(swatch => (
        <button
          aria-label={swatch}
          aria-pressed={(color ?? DRAWING_SWATCHES[0]) === swatch}
          className="size-[18px] cursor-pointer rounded-full border border-(--card-well-stroke) aria-pressed:ring-2 aria-pressed:ring-(--ui-text-secondary) aria-pressed:ring-offset-1 aria-pressed:ring-offset-(--card-surface)"
          key={swatch}
          onClick={() => onColor(swatch)}
          style={{ backgroundColor: swatch }}
          type="button"
        />
      ))}
      <Button aria-label={copy.remove} onClick={onRemove} size="icon-xs" variant="ghost">
        <Codicon className="text-(--ui-red)" name="trash" size="0.875rem" />
      </Button>
    </div>
  )
}
