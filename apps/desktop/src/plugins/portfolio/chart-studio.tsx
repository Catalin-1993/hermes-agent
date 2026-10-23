/**
 * The chart studio: a symbol's chart with the owner's indicators, drawings and notes (kept per symbol by
 * the backend, the same in Watchlist and Backtesting) and price alerts set by a click. A host page can add
 * its own lines, panes, levels and markers (Backtesting draws its strategy and trades), its own toolbar
 * controls, and ask for one price from the chart (`pick`: setting a stop or a target by clicking it).
 */

import { cn, host, useQueryClient } from '@hermes/plugin-sdk'
import { type ReactNode, useMemo, useState } from 'react'

import { addAlert, alertsKey, type WatchKind } from './api'
import { COPY } from './copy'
import { quotePrice } from './format'
import type { Bar } from './market-feed'
import { type ChartMode, type Marker, StudioCanvas } from './studio-canvas'
import { type ChartPoint, type LineSpec, newIndicator, type PaneSpec, planFor, type PriceLineSpec } from './studio-model'
import { NotesPanel } from './studio-notes'
import { DrawingsMenu, IndicatorMenu, Legend, type Tool, ToolButtons } from './studio-toolbar'
import { newId, useChartDoc } from './use-chart-doc'

const NONE: never[] = []

export interface StudioExtras {
  lines?: LineSpec[]
  markers?: Marker[]
  panes?: PaneSpec[]
  priceLines?: PriceLineSpec[]
}

export interface PricePick {
  onPick: (price: number) => void
}

const HINT: Partial<Record<Tool, string>> = {
  alert: COPY.studio.hint.alert,
  fib: COPY.studio.hint.fib,
  hline: COPY.studio.hint.hline,
  note: COPY.studio.hint.note,
  trend: COPY.studio.hint.trend
}

function useAlertAt(kind: WatchKind, symbol: string) {
  const queryClient = useQueryClient()

  return async (price: number, last: number) => {
    try {
      const state = await addAlert({ kind, note: '', op: price >= last ? 'above' : 'below', price: Number(price.toPrecision(6)), symbol })
      queryClient.setQueryData(alertsKey, state)
      host.notify({ kind: 'success', message: COPY.studio.alertSet(quotePrice(price)) })
    } catch (error) {
      host.notify({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }
}

export function ChartStudio({
  bars,
  controls,
  daily,
  empty = null,
  extras,
  kind,
  live = null,
  mode,
  pick = null,
  symbol
}: {
  bars: Bar[]
  /** The host's own controls, after the studio's (interval, candles/line, …). */
  controls?: ReactNode
  daily: boolean
  /** Why there is nothing to draw (loading, failed); the canvas shows it instead. */
  empty?: null | string
  extras?: StudioExtras
  kind: WatchKind
  live?: Bar | null
  mode: ChartMode
  pick?: null | PricePick
  symbol: string
}) {
  const { doc, update } = useChartDoc(kind, symbol)
  const alertAt = useAlertAt(kind, symbol)
  const [tool, setTool] = useState<Tool>('cursor')
  const [pending, setPending] = useState<ChartPoint | null>(null)
  const [draftAt, setDraftAt] = useState<ChartPoint | null>(null)
  const [hovered, setHovered] = useState<Bar | null>(null)
  const plan = useMemo(() => planFor(bars, doc), [bars, doc])
  const last = bars[bars.length - 1]?.close ?? 0

  const lines = useMemo(() => [...plan.lines, ...(extras?.lines ?? NONE)], [plan.lines, extras?.lines])
  const panes = useMemo(() => [...plan.panes, ...(extras?.panes ?? NONE)], [plan.panes, extras?.panes])
  const priceLines = useMemo(() => [...plan.priceLines, ...(extras?.priceLines ?? NONE)], [plan.priceLines, extras?.priceLines])

  const markers = useMemo(
    () => [
      ...(extras?.markers ?? NONE),
      ...doc.notes.flatMap(note => (note.at ? [{ color: '#fbbf24', position: 'aboveBar' as const, shape: 'circle' as const, text: '✎', time: note.at.time }] : []))
    ],
    [doc.notes, extras?.markers]
  )

  const draw = (type: 'fib' | 'trend', point: ChartPoint) => {
    if (!pending) {
      return setPending(point)
    }

    // A double click on the start bar is not the end of the move.
    if (point.time === pending.time) {
      return
    }

    void update(current => ({ ...current, drawings: [...current.drawings, { id: newId(), label: '', points: [pending, point], type }] }))
    setPending(null)
    setTool('cursor')
  }

  const onClick = (point: ChartPoint) => {
    if (pick) {
      return pick.onPick(point.price)
    }

    const act: Record<Tool, () => void> = {
      alert: () => {
        void alertAt(point.price, last)
        setTool('cursor')
      },
      cursor: () => undefined,
      fib: () => draw('fib', point),
      hline: () => {
        void update(current => ({ ...current, drawings: [...current.drawings, { id: newId(), label: '', points: [point], type: 'hline' }] }))
        setTool('cursor')
      },
      note: () => {
        setDraftAt(point)
        setTool('cursor')
      },
      trend: () => draw('trend', point)
    }

    act[tool]()
  }

  const hint = pick
    ? COPY.studio.hint.pick
    : pending
      ? tool === 'fib'
        ? COPY.studio.hint.fib2
        : COPY.studio.hint.trend2
      : HINT[tool]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-portfolio-studio="">
      <div className="flex flex-wrap items-center gap-2">
        <IndicatorMenu
          onAdd={type => void update(current => ({ ...current, indicators: [...current.indicators, newIndicator(type, newId())] }))}
        />
        <ToolButtons
          onTool={next => {
            setTool(next)
            setPending(null)
          }}
          tool={tool}
        />
        <DrawingsMenu
          drawings={doc.drawings}
          onClear={() => void update(current => ({ ...current, drawings: [] }))}
          onRemove={id => void update(current => ({ ...current, drawings: current.drawings.filter(d => d.id !== id) }))}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">{controls}</div>
      </div>
      <div className={cn('relative flex min-h-0 flex-1 flex-col', (tool !== 'cursor' || pick) && 'cursor-crosshair')}>
        <Legend
          hovered={hovered}
          indicators={doc.indicators}
          onChange={indicator => void update(current => ({ ...current, indicators: current.indicators.map(i => (i.id === indicator.id ? indicator : i)) }))}
          onRemove={id => void update(current => ({ ...current, indicators: current.indicators.filter(i => i.id !== id) }))}
        />
        {hint && (
          <div className="pointer-events-none absolute top-2 right-16 z-10 rounded-full bg-(--card-surface) px-3 py-1 text-[0.6875rem] text-(--ui-text-secondary) shadow-(--card-shadow)">
            {hint}
          </div>
        )}
        {empty ? (
          <div className="grid min-h-80 flex-1 place-items-center px-6 text-center text-[0.8125rem] text-(--ui-text-tertiary)">{empty}</div>
        ) : (
        <StudioCanvas
          bars={bars}
          daily={daily}
          lines={lines}
          live={live}
          markers={markers}
          mode={mode}
          onClick={onClick}
          onHover={setHovered}
          panes={panes}
          priceLines={priceLines}
          volume={plan.volume}
        />
        )}
      </div>
      <NotesPanel
        draftAt={draftAt}
        notes={doc.notes}
        onAdd={(text, at) => void update(current => ({ ...current, notes: [...current.notes, { at, created: Math.floor(Date.now() / 1000), id: newId(), text }] }))}
        onCancel={() => setDraftAt(null)}
        onRemove={id => void update(current => ({ ...current, notes: current.notes.filter(n => n.id !== id) }))}
      />
    </div>
  )
}
