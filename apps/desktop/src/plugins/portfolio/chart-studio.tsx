/**
 * The chart studio: a symbol's chart with the owner's indicators, drawings and notes (kept per symbol by
 * the backend, the same in Watchlist and Backtesting) and price alerts set by a click — laid out as
 * TradingView lays out its chart: one top bar (the host's buttons, Indicators, Replay), the drawing tools in
 * a rail at the left, the legend over the chart, and drawings that are made click, move, click and edited
 * after. A host page can add its own lines, panes, levels and markers (Backtesting draws its strategy and
 * trades), its own top-bar buttons, and ask for one price from the chart (`pick`: a stop or a target).
 */

import { cn, host, useQueryClient } from '@hermes/plugin-sdk'
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react'

import { addAlert, alertsKey, type WatchKind } from './api'
import { FullscreenButton, ReplayButton } from './chart-topbar'
import { COPY } from './copy'
import { makeDrawing } from './drawing-model'
import { quotePrice } from './format'
import type { Bar } from './market-feed'
import { ReplayBar, useReplay } from './replay'
import { type ChartMode, type CompareLine, type Marker, StudioCanvas } from './studio-canvas'
import { type LineSpec, newIndicator, type PaneSpec, planFor, type PriceLineSpec } from './studio-model'
import type { ChartDoc, ChartNote, ChartPoint, Drawing, Indicator, IndicatorType } from './studio-model'
import { NotesPanel } from './studio-notes'
import { BarDivider, DrawingBar, IndicatorMenu, Legend, type Tool, ToolRail } from './studio-toolbar'
import { CARD } from './ui'
import { newId, useChartDoc } from './use-chart-doc'
import { useDrawings } from './use-drawings'

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
  ray: COPY.studio.hint.ray,
  rect: COPY.studio.hint.rect,
  trend: COPY.studio.hint.trend,
  vline: COPY.studio.hint.vline
}

function useAlertAt(kind: WatchKind, symbol: string) {
  const queryClient = useQueryClient()

  return async (price: number, last: number) => {
    try {
      const state = await addAlert({
        kind,
        note: '',
        op: price >= last ? 'above' : 'below',
        price: Number(price.toPrecision(6)),
        symbol
      })

      queryClient.setQueryData(alertsKey, state)
      host.notify({ kind: 'success', message: COPY.studio.alertSet(quotePrice(price)) })
    } catch (error) {
      host.notify({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }
}

const dateTime = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  year: 'numeric'
})

/** The markers on the price: the host's (a backtest's trades), cut at the bar Replay has reached, and a
 *  dot for each of the owner's notes pinned to a bar. */
function studioMarkers(host: Marker[], notes: ChartNote[], replayUntil: null | number): Marker[] {
  return [
    ...host.filter(marker => replayUntil === null || marker.time <= replayUntil),
    ...notes.flatMap(note =>
      note.at
        ? [{ color: '#fbbf24', position: 'aboveBar' as const, shape: 'circle' as const, text: '✎', time: note.at.time }]
        : []
    )
  ]
}

type ClickAction = { index: number; type: 'replay' } | { type: 'alert' | 'note' | 'none' | 'pick' }

/** What a click on the chart does, by what the chart is waiting for: a Replay start, a price for the host,
 *  or the alert / note tool. Anything else (a drawing tool, the cursor) is the drawing layer's. */
function clickAction(now: { pick: boolean; replay: string; tool: Tool }, point: ChartPoint, bars: Bar[]): ClickAction {
  if (now.replay === 'pick') {
    return {
      index: Math.max(
        0,
        bars.findLastIndex(bar => bar.time <= point.time)
      ),
      type: 'replay'
    }
  }

  if (now.pick) {
    return { type: 'pick' }
  }

  return now.tool === 'alert' || now.tool === 'note' ? { type: now.tool } : { type: 'none' }
}

/** The line of help over the chart's corner for what the chart is waiting for. */
function hintFor(replay: string, pick: boolean, pending: boolean, tool: Tool): string | undefined {
  if (replay === 'pick') {
    return COPY.studio.replay.pick
  }

  return pick ? COPY.studio.hint.pick : pending ? COPY.studio.hint.second : HINT[tool]
}

/** Change and remove for the indicators in the legend, saved to the chart. */
function indicatorEdits(update: (change: (current: ChartDoc) => ChartDoc) => Promise<void>) {
  return {
    onChange: (indicator: Indicator) =>
      void update(current => ({
        ...current,
        indicators: current.indicators.map(i => (i.id === indicator.id ? indicator : i))
      })),
    onRemove: (id: string) =>
      void update(current => ({ ...current, indicators: current.indicators.filter(i => i.id !== id) }))
  }
}

/** Whether the card is on the full screen, and a button's way of toggling it. */
function useFullscreen(card: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false)

   
  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement !== null && document.fullscreenElement === card.current)

    document.addEventListener('fullscreenchange', sync)

    return () => document.removeEventListener('fullscreenchange', sync)
  }, [card])

  return {
    active,
    toggle: () => void (document.fullscreenElement ? document.exitFullscreen() : card.current?.requestFullscreen())
  }
}

/** What the pointer shows over the chart: the crosshair cursor while something is being placed, and — while
 *  picking where Replay starts — a line at the bar it would start from. */
function pointerLook(now: { hovered: Bar | null; pending: boolean; pick: boolean; replay: string; tool: Tool }) {
  const picking = now.replay === 'pick'

  return {
    crosshair: now.tool !== 'cursor' || now.pick || now.pending || picking,
    cut:
      picking && now.hovered
        ? {
            ...makeDrawing('vline', 'replay-cut', { price: now.hovered.close, time: now.hovered.time }),
            color: '#fbbf24'
          }
        : null
  }
}

/** The bar the legend reads (the one under the crosshair, else the last) and the one before it. */
function legendBar(hovered: Bar | null, last: Bar | undefined, bars: Bar[]) {
  const shownAt = hovered ?? last ?? null

  return { before: shownAt ? bars[bars.findIndex(bar => bar.time === shownAt.time) - 1] : undefined, shownAt }
}

function TopBar({
  controls,
  fullscreen,
  lead,
  onAddIndicator,
  onReplay,
  replayActive,
  replayable,
  trail
}: {
  controls?: ReactNode
  fullscreen: null | { active: boolean; toggle: () => void }
  lead?: ReactNode
  onAddIndicator: (type: IndicatorType) => void
  onReplay: () => void
  replayActive: boolean
  replayable?: boolean
  trail?: ReactNode
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-y border-(--card-well-stroke) px-2 py-1"
      data-portfolio-topbar=""
    >
      {lead}
      {lead && <BarDivider />}
      <IndicatorMenu onAdd={onAddIndicator} />
      {replayable && (
        <>
          <BarDivider />
          <ReplayButton active={replayActive} onClick={onReplay} />
        </>
      )}
      {controls && (
        <>
          <BarDivider />
          {controls}
        </>
      )}
      <div className="flex-1" />
      {trail}
      {fullscreen && <FullscreenButton active={fullscreen.active} onClick={fullscreen.toggle} />}
    </div>
  )
}

function Overlays({
  drawings,
  hint,
  last,
  replay,
  selected
}: {
  drawings: ReturnType<typeof useDrawings>
  hint?: string
  last?: Bar
  replay: ReturnType<typeof useReplay>
  selected?: Drawing
}) {
  return (
    <>
      {selected && (
        <DrawingBar
          color={selected.color ?? null}
          name={COPY.studio.drawingName[selected.type]}
          onColor={color => drawings.recolor(selected.id, color)}
          onRemove={() => drawings.remove(selected.id)}
        />
      )}
      {hint && (
        <div className="pointer-events-none absolute right-16 bottom-3 z-10 rounded-full bg-(--card-surface) px-3 py-1 text-[0.6875rem] text-(--ui-text-secondary) shadow-(--card-shadow)">
          {hint}
        </div>
      )}
      {replay.mode !== 'off' && (
        <ReplayBar replay={replay} time={last ? dateTime.format(new Date(last.time * 1000)) : ''} />
      )}
    </>
  )
}

export function ChartStudio({
  bars,
  compare = NONE,
  controls,
  daily,
  empty = null,
  extras,
  fullscreenable,
  header = null,
  intervalLabel = '',
  kind,
  lead,
  live = null,
  mode,
  name,
  onRemoveCompare,
  pick = null,
  replayable,
  symbol,
  trail
}: {
  bars: Bar[]
  /** Other symbols drawn over the price as percentages (the host fetched their bars). */
  compare?: CompareLine[]
  /** The host's own buttons on the top bar, after Indicators (Backtesting's period and levels). */
  controls?: ReactNode
  daily: boolean
  /** Why there is nothing to draw (loading, failed); the canvas shows it instead. */
  empty?: null | string
  extras?: StudioExtras
  /** Offer a button that makes the chart card fill the screen. */
  fullscreenable?: boolean
  /** The chart card's head: what is charted, its price or its title. */
  header?: ReactNode
  /** The interval, as the legend names it. */
  intervalLabel?: string
  kind: WatchKind
  /** The host's buttons at the left of the top bar (Compare, interval, chart type). */
  lead?: ReactNode
  live?: Bar | null
  mode: ChartMode
  /** The symbol as the legend names it. */
  name?: string
  onRemoveCompare?: (id: string) => void
  pick?: null | PricePick
  /** Offer Replay (the Watchlist does; Backtesting draws its own history). */
  replayable?: boolean
  symbol: string
  /** The host's buttons at the right of the top bar. */
  trail?: ReactNode
}) {
  const { doc, update } = useChartDoc(kind, symbol)
  const alertAt = useAlertAt(kind, symbol)
  const [tool, setTool] = useState<Tool>('cursor')
  const [draftAt, setDraftAt] = useState<ChartPoint | null>(null)
  const [hovered, setHovered] = useState<Bar | null>(null)
  const replay = useReplay(bars.length)
  const card = useRef<HTMLElement>(null)
  const fullscreen = useFullscreen(card)

  const shownBars = useMemo(
    () => (replay.mode === 'on' ? bars.slice(0, replay.index + 1) : bars),
    [bars, replay.index, replay.mode]
  )

  const plan = useMemo(() => planFor(shownBars, doc), [shownBars, doc])
  const last = shownBars[shownBars.length - 1]
  const lastClose = last?.close ?? 0
  const drawings = useDrawings({ drawings: doc.drawings, setTool, tool, update })

  const lines = useMemo(() => [...plan.lines, ...(extras?.lines ?? NONE)], [plan.lines, extras?.lines])
  const panes = useMemo(() => [...plan.panes, ...(extras?.panes ?? NONE)], [plan.panes, extras?.panes])

  const priceLines = useMemo(
    () => [...plan.priceLines, ...(extras?.priceLines ?? NONE)],
    [plan.priceLines, extras?.priceLines]
  )

  const markers = useMemo(
    () => studioMarkers(extras?.markers ?? NONE, doc.notes, replay.mode === 'on' ? (last?.time ?? 0) : null),
    [doc.notes, extras?.markers, last?.time, replay.mode]
  )

  const onTool = (next: Tool) => {
    drawings.cancel()
    drawings.select(null)
    setTool(next === tool ? 'cursor' : next)
  }

  const onClick = (point: ChartPoint) => {
    const action = clickAction({ pick: Boolean(pick), replay: replay.mode, tool }, point, bars)

    if (action.type === 'replay') {
      replay.pickAt(action.index)
    } else if (action.type === 'pick') {
      pick?.onPick(point.price)
    } else if (action.type === 'alert') {
      void alertAt(point.price, lastClose)
      setTool('cursor')
    } else if (action.type === 'note') {
      setDraftAt(point)
      setTool('cursor')
    }
  }

  const selected = doc.drawings.find(drawing => drawing.id === drawings.selectedId)

  const { crosshair, cut } = pointerLook({
    hovered,
    pending: drawings.pending,
    pick: Boolean(pick),
    replay: replay.mode,
    tool
  })

  const hint = hintFor(replay.mode, Boolean(pick), drawings.pending, tool)
  const { before, shownAt } = legendBar(hovered, last, shownBars)
  const legendName = name ?? symbol

  return (
    <>
      <section
        className={cn(CARD, 'overflow-hidden', fullscreen.active && 'h-full rounded-none border-0')}
        data-portfolio-studio=""
        ref={card}
      >
        {header}
        <TopBar
          controls={controls}
          fullscreen={fullscreenable ? fullscreen : null}
          lead={lead}
          onAddIndicator={type =>
            void update(current => ({ ...current, indicators: [...current.indicators, newIndicator(type, newId())] }))
          }
          onReplay={() => (replay.mode === 'off' ? replay.start() : replay.exit())}
          replayable={replayable}
          replayActive={replay.mode !== 'off'}
          trail={trail}
        />
        <div className={cn('flex min-h-0', fullscreen.active && 'flex-1')}>
          <ToolRail
            onClear={() => void update(current => ({ ...current, drawings: [] }))}
            onTool={onTool}
            tool={tool}
            withDrawings={doc.drawings.length > 0}
          />
          <div
            className={cn(
              'relative flex min-w-0 flex-1 flex-col outline-none',
              crosshair && '[&_td]:!cursor-crosshair',
              !crosshair && drawings.hoverId && '[&_td]:!cursor-pointer'
            )}
            data-portfolio-chart-area=""
            onKeyDown={drawings.onKeyDown}
            role="presentation"
          >
            {!empty && (
              <Legend
                bar={shownAt}
                compare={compare}
                indicators={doc.indicators}
                interval={intervalLabel}
                lines={extras?.lines ?? NONE}
                name={legendName}
                {...indicatorEdits(update)}
                onRemoveCompare={id => onRemoveCompare?.(id)}
                previous={before?.close ?? null}
              />
            )}
            <Overlays drawings={drawings} hint={hint} last={last} replay={replay} selected={selected} />
            {empty ? (
              <div className="grid min-h-80 flex-1 place-items-center px-6 text-center text-[0.8125rem] text-(--ui-text-tertiary)">
                {empty}
              </div>
            ) : (
              <StudioCanvas
                bars={shownBars}
                compare={compare}
                daily={daily}
                drawings={drawings.shown}
                hoverId={drawings.hoverId}
                lines={lines}
                live={replay.mode === 'off' ? live : null}
                markers={markers}
                mode={mode}
                onClick={onClick}
                onHover={setHovered}
                onPointer={drawings.onPointer}
                panes={panes}
                preview={cut ?? drawings.preview}
                priceLines={priceLines}
                selectedId={drawings.selectedId}
                volume={plan.volume}
              />
            )}
          </div>
        </div>
      </section>
      <NotesPanel
        draftAt={draftAt}
        notes={doc.notes}
        onAdd={(text, at) =>
          void update(current => ({
            ...current,
            notes: [...current.notes, { at, created: Math.floor(Date.now() / 1000), id: newId(), text }]
          }))
        }
        onCancel={() => setDraftAt(null)}
        onRemove={id => void update(current => ({ ...current, notes: current.notes.filter(n => n.id !== id) }))}
      />
    </>
  )
}
