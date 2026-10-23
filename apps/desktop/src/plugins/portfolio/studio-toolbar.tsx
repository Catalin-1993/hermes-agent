/**
 * The chart studio's controls, TradingView style: the "Indicators" menu (searchable, on the price or in a
 * pane under it), the drawing tools (cursor, horizontal level, trend line, Fibonacci, note, price alert),
 * the drawings list, and the legend over the chart — the bar under the crosshair and each indicator with
 * its settings, show/hide and remove.
 */

import { Button, cn, Codicon, Input, Popover, PopoverContent, PopoverTrigger, Tip } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { COPY } from './copy'
import { quotePrice } from './format'
import type { Bar } from './market-feed'
import { CATALOG, type Drawing, type Indicator, INDICATOR_ORDER, type IndicatorType, paramsOf, shortName } from './studio-model'

export type Tool = 'alert' | 'cursor' | 'fib' | 'hline' | 'note' | 'trend'

const TOOL_ICON: Record<Tool, string> = {
  alert: 'bell',
  cursor: 'move',
  fib: 'list-ordered',
  hline: 'horizontal-rule',
  note: 'note',
  trend: 'graph-line'
}

const TOOLS: Tool[] = ['cursor', 'hline', 'trend', 'fib', 'note', 'alert']

export function IndicatorMenu({ onAdd }: { onAdd: (type: IndicatorType) => void }) {
  const copy = COPY.studio
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = INDICATOR_ORDER.filter(type => !needle || `${type} ${CATALOG[type].label}`.toLowerCase().includes(needle))

  const group = (pane: boolean) => shown.filter(type => CATALOG[type].pane === pane)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          <Codicon className="mr-1" name="pulse" size="0.85rem" />
          {copy.indicators}
        </Button>
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

export function ToolButtons({ onTool, tool }: { onTool: (tool: Tool) => void; tool: Tool }) {
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-(--card-well) p-0.5" role="toolbar">
      {TOOLS.map(name => (
        <Tip key={name} label={COPY.studio.tools[name]}>
          <button
            aria-label={COPY.studio.tools[name]}
            aria-pressed={tool === name}
            className={cn(
              'grid size-7 cursor-pointer place-items-center rounded-full transition-colors',
              tool === name ? 'bg-(--card-surface) text-(--ui-text-primary) shadow-(--card-shadow)' : 'text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
            )}
            onClick={() => onTool(name)}
            type="button"
          >
            <Codicon name={TOOL_ICON[name]} size="0.85rem" />
          </button>
        </Tip>
      ))}
    </div>
  )
}

export function DrawingsMenu({ drawings, onClear, onRemove }: { drawings: Drawing[]; onClear: () => void; onRemove: (id: string) => void }) {
  const copy = COPY.studio

  if (!drawings.length) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          <Codicon className="mr-1" name="edit" size="0.8rem" />
          {copy.drawings(drawings.length)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-1 p-2">
        {drawings.map(drawing => (
          <div className="flex items-center gap-2 rounded-md px-2 py-1 text-[0.75rem]" key={drawing.id}>
            <span className="min-w-0 flex-1 truncate text-(--ui-text-primary)">
              {copy.drawingName[drawing.type]} · {drawing.points.map(point => quotePrice(point.price)).join(' → ')}
            </span>
            <Button aria-label={copy.remove} onClick={() => onRemove(drawing.id)} size="icon-xs" variant="ghost">
              <Codicon name="close" size="0.75rem" />
            </Button>
          </div>
        ))}
        <Button className="mt-1" onClick={onClear} size="sm" variant="ghost">
          <Codicon className="mr-1 text-(--ui-red)" name="trash" size="0.8rem" />
          {copy.clearDrawings}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function ParamsPopover({ indicator, onChange }: { indicator: Indicator; onChange: (params: Record<string, number>) => void }) {
  const values = paramsOf(indicator)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label={COPY.studio.settings} className="cursor-pointer text-(--ui-text-tertiary) hover:text-(--ui-text-primary)" type="button">
          <Codicon name="gear" size="0.75rem" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-60 flex-col gap-2 p-3">
        <div className="text-[0.75rem] font-medium text-(--ui-text-primary)">{CATALOG[indicator.type].label}</div>
        {CATALOG[indicator.type].params.map(spec => (
          <label className="flex items-center justify-between gap-2 text-[0.75rem] text-(--ui-text-tertiary)" key={spec.name}>
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

export function Legend({
  hovered,
  indicators,
  onChange,
  onRemove
}: {
  hovered: Bar | null
  indicators: Indicator[]
  onChange: (indicator: Indicator) => void
  onRemove: (id: string) => void
}) {
  const copy = COPY.studio
  const up = hovered ? hovered.close >= hovered.open : true

  return (
    <div className="pointer-events-none absolute top-2 left-3 z-10 flex max-w-[70%] flex-col gap-1 text-[0.6875rem]" data-portfolio-studio-legend="">
      {hovered && (
        <div className="flex flex-wrap gap-x-2 tabular-nums" style={{ color: up ? 'var(--ui-green)' : 'var(--ui-red)' }}>
          {(['open', 'high', 'low', 'close'] as const).map(key => (
            <span key={key}>
              <span className="text-(--ui-text-tertiary)">{copy.ohlc[key]}</span> {quotePrice(hovered[key])}
            </span>
          ))}
        </div>
      )}
      {indicators.map(indicator => (
        <div className="pointer-events-auto flex w-fit items-center gap-1.5 rounded-md bg-(--card-surface)/80 px-1.5 py-0.5 backdrop-blur-sm" key={indicator.id}>
          <span className="size-2 rounded-full" style={{ backgroundColor: indicator.color ?? CATALOG[indicator.type].color }} />
          <span className={cn('text-(--ui-text-secondary)', indicator.hidden && 'line-through opacity-60')}>{shortName(indicator)}</span>
          {CATALOG[indicator.type].params.length > 0 && <ParamsPopover indicator={indicator} onChange={params => onChange({ ...indicator, params })} />}
          <button
            aria-label={indicator.hidden ? copy.show : copy.hide}
            className="cursor-pointer text-(--ui-text-tertiary) hover:text-(--ui-text-primary)"
            onClick={() => onChange({ ...indicator, hidden: !indicator.hidden })}
            type="button"
          >
            <Codicon name={indicator.hidden ? 'eye-closed' : 'eye'} size="0.75rem" />
          </button>
          <button aria-label={copy.remove} className="cursor-pointer text-(--ui-text-tertiary) hover:text-(--ui-red)" onClick={() => onRemove(indicator.id)} type="button">
            <Codicon name="close" size="0.75rem" />
          </button>
        </div>
      ))}
    </div>
  )
}
