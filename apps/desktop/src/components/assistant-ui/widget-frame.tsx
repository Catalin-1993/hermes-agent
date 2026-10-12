import { useEffect, useMemo, useRef, useState } from 'react'

import { requestComposerSubmit } from '@/app/chat/composer/focus'
import { useThemeEpoch } from '@/hooks/use-theme-epoch'
import { sealedHtml } from '@/lib/frame-policy'
import { cn } from '@/lib/utils'

import { useFigureArea } from './use-figure-area'
import {
  collectThemeBridge,
  DEFAULT_HEIGHT,
  evaluateIntent,
  frameSizeFromMessage,
  type IntentAck,
  intentAckMessage,
  partialMessage,
  partialShell,
  placeFigure,
  RESIZE_TOLERANCE,
  themePrelude,
  withInlineChrome
} from './widget-frame-doc'
import { useWidgetNetwork } from './widget-network'
import { WidgetToolbar } from './widget-toolbar'

/** How often a half-written widget's markup is poured into its frame. */
const PARTIAL_INTERVAL_MS = 150

interface WidgetFrameProps {
  /** What the owner's network approval is filed under (a file path, or the widget's text key). */
  approvalKey: string
  /** The finished document — null until there is one. */
  doc: string | null
  /** `height` attribute — the starting height only; measurement overrides. */
  initialHeight?: number | null
  /** The markup written so far, shown (scripts left out) while `doc` is still null. */
  partial?: string | null
  title: string
}

/**
 * A widget in the message flow: the sealed, themed, self-sizing frame, its network banner and — while
 * the document is still being written — the progressive view of its markup. See `widget-frame-doc.ts`.
 */
export function WidgetFrame({ approvalKey, doc, initialHeight = null, partial = null, title }: WidgetFrameProps) {
  const themeEpoch = useThemeEpoch()
  // vars/font/colorScheme come from one collectThemeBridge() call so they can
  // never disagree with each other, even while this lags a repaint behind
  // `themeEpoch` (same trade-off use-is-dark.ts makes for the same reason).
  const [bridge, setBridge] = useState(collectThemeBridge)

  useEffect(() => setBridge(collectThemeBridge()), [themeEpoch])

  const [measured, setMeasured] = useState<number | null>(null)
  // The finished document's own width, and the room it was measured in.
  const [report, setReport] = useState<{ room: number; width: number } | null>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const outer = useRef<HTMLSpanElement>(null)
  const figure = useFigureArea(outer)
  const room = figure ? Math.max(figure.area, figure.column) : 0
  const roomRef = useRef(room)

  roomRef.current = room
  const [expanded, setExpanded] = useState(false)
  const finished = doc !== null
  const hasPartial = partial !== null
  const finishedRef = useRef(finished)

  finishedRef.current = finished

  // One token per mount: the message listener only trusts reports from the
  // document THIS mount injected, so two widgets in one transcript (or a
  // hostile page inventing messages) can't move each other's frames.
  const token = useMemo(() => Math.random().toString(36).slice(2), [])
  const network = useWidgetNetwork(doc, approvalKey)

  useEffect(() => {
    // Human-speed gate on widget intents. A closure local, not state: it's
    // a rate limiter read inside the handler, never rendered.
    let lastIntentAt = 0

    const onMessage = (event: MessageEvent) => {
      const decision = evaluateIntent(event.data, token, Date.now(), lastIntentAt)

      if (decision !== null) {
        let ack: IntentAck

        if (decision.kind === 'reject') {
          ack = decision.ack
        } else {
          lastIntentAt = Date.now()
          // Off-screen: the prompt reaches the agent as a normal user turn
          // through the composer's own send path (steer/queue rules apply),
          // but the row is typed hidden — no bubble, no UI space. The widget
          // updating IS the visible response. `false` means no visible
          // composer surface took it; the widget is told instead of assuming.
          ack = requestComposerSubmit(decision.prompt, { target: 'active', displayKind: 'hidden' })
            ? { ok: true }
            : { error: 'undelivered', ok: false }
        }

        // Reply only to the sender that proved it holds this mount's token.
        // The ack carries status, never app data; '*' because the sandboxed
        // frame's origin is opaque.
        const source = event.source as Window | null

        if (decision.id !== null && source) {
          source.postMessage(intentAckMessage(token, decision.id, ack), '*')
        }

        return
      }

      const next = frameSizeFromMessage(event.data, token)

      if (next === null) {
        return
      }

      // Functional updates so the comparisons read current state without a
      // shadow ref: same-value sets bail out in React, and the tolerance
      // keeps a vh-sized page (which measures what it's given) from
      // oscillating.
      setMeasured(prev =>
        Math.abs(next.height - (prev ?? initialHeight ?? DEFAULT_HEIGHT)) > RESIZE_TOLERANCE ? next.height : prev
      )

      // Width is taken only from the FINISHED document measured in a frame opened to the whole room —
      // its intrinsic span there. A half-written one is not its final shape, and a frame already narrowed
      // to its content would feed back: %-width children reflow narrower every time it shrinks, spiraling
      // toward zero. A frame not laid out yet (a viewport of 0) says nothing.
      const open = roomRef.current || (frame.current?.clientWidth ?? 0)

      if (next.width > 0 && finishedRef.current && next.viewport > 0 && Math.abs(next.viewport - open) <= 2) {
        setReport({ room: roomRef.current || next.viewport, width: next.width })
      }
    }

    window.addEventListener('message', onMessage)

    return () => window.removeEventListener('message', onMessage)
  }, [initialHeight, token])

  const { vars, font, colorScheme } = bridge

  // Rebuild the srcdoc when the bridge changes (a repaint or a skin swap,
  // whichever changed a token or the scheme) so its native controls and
  // transparent canvas stay aligned with the app.
  const framedDoc = useMemo(() => {
    const prelude = themePrelude(vars, font, colorScheme)

    if (doc === null) {
      return hasPartial ? sealedHtml(partialShell(token, prelude), { libraries: true }) : null
    }

    return sealedHtml(withInlineChrome(doc, token, prelude), {
      hosts: network.hosts,
      libraries: true
    })
  }, [vars, font, colorScheme, doc, hasPartial, token, network.hosts])

  // The shell keeps its frame; only its markup is replaced, at most every PARTIAL_INTERVAL_MS.
  const sentAt = useRef(0)

  const pour = (html: string) => {
    sentAt.current = Date.now()
    frame.current?.contentWindow?.postMessage(partialMessage(token, html), '*')
  }

  useEffect(() => {
    if (finished || partial === null) {
      return
    }

    const timer = setTimeout(() => pour(partial), Math.max(0, PARTIAL_INTERVAL_MS - (Date.now() - sentAt.current)))

    return () => clearTimeout(timer)
    // `pour` only reads refs and `token`, which never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, partial])

  // A measurement holds for the room it was taken in. When the window gives the figure more or less
  // room, the frame opens to all of it again and the content is measured anew.
  const contentWidth = finished && report && Math.abs(report.room - room) <= 2 ? report.width : null

  // Full screen lifts this same frame into the top layer (the Fullscreen API, as Library blocks do), so the
  // widget keeps its state, its messages and its network access — nothing is reloaded. Esc leaves it.
  const stage = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const sync = () => setExpanded(document.fullscreenElement !== null && document.fullscreenElement === stage.current)

    document.addEventListener('fullscreenchange', sync)

    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const setFullscreen = (next: boolean) =>
    void (next ? stage.current?.requestFullscreen() : document.fullscreenElement && document.exitFullscreen())

  const height = measured ?? initialHeight ?? DEFAULT_HEIGHT

  // On the full-screen stage a fluid widget takes the screen less a margin; a fixed-size one keeps its own
  // size; both sit in the middle.
  const fluid = contentWidth === null || contentWidth >= room - 2

  const stageFit = {
    height: `min(${height}px, calc(100% - 5rem))`,
    width: fluid ? 'calc(100% - 5rem)' : `min(${contentWidth}px, calc(100% - 5rem))`
  }

  const place = figure ? placeFigure({ area: figure.area, column: figure.column, content: contentWidth }) : null

  const inset = figure ? (Math.max(figure.area, figure.column) - figure.column) / 2 : 0

  return (
    <span
      className="group/widget my-2 block"
      data-figure=""
      ref={outer}
      style={figure ? { marginInline: -inset, width: Math.max(figure.area, figure.column) } : { width: '100%' }}
    >
      {network.banner && (
        <span className="block" style={{ marginLeft: inset, width: figure?.column }}>
          {network.banner}
        </span>
      )}
      {framedDoc === null ? (
        <span
          className="block animate-pulse rounded-2xl bg-[color-mix(in_srgb,currentColor_4%,transparent)]"
          style={{ height, marginLeft: inset, width: figure?.column ?? '100%' }}
        />
      ) : (
        <>
          <span
            className={cn(
              'relative block max-w-full transition-[height] duration-200',
              expanded && 'bg-(--card-surface)'
            )}
            ref={stage}
            style={expanded ? undefined : { height, marginLeft: place?.offset, width: place?.width ?? '100%' }}
          >
            <iframe
              className={cn('absolute inset-0 border-0 bg-transparent', expanded ? 'm-auto' : 'size-full')}
              loading="lazy"
              onLoad={finished || partial === null ? undefined : () => pour(partial)}
              ref={frame}
              sandbox="allow-scripts"
              srcDoc={framedDoc}
              style={expanded ? { colorScheme, ...stageFit } : { colorScheme }}
              title={title}
            />
            <WidgetToolbar expanded={expanded} globe={network.globe} html={doc} onExpandedChange={setFullscreen} />
          </span>
        </>
      )}
    </span>
  )
}
