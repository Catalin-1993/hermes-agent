/**
 * Brain: the HUD folded into a tab on the right edge of the screen (the `edge` layout, see electron/hud-layout.ts).
 *
 * The tab carries the agent's face with its status ring and a "+" for a new conversation; clicking either opens
 * the bar. A long press on the tab picks it up so it can be moved up or down the edge (main follows the cursor and
 * remembers the place). With "Show only on hover" it waits tucked behind the edge (a sliver stays visible) and
 * slides out when the pointer reaches the edge. With "Pop up replies" a reply that lands while it is folded appears
 * in a bubble beside the tab for a few seconds; clicking the bubble opens the bar on it.
 *
 * Every motion is a transform or an opacity change, so it runs on the compositor: the bubble fades and slides in
 * and out (it stays mounted while it leaves), the tab slides along one easing curve.
 *
 * The rest of the HUD window is transparent and lets clicks through (click-through.ts hit-tests the document), so
 * only the tab and the bubble are ever in the way.
 */

import './edge-widget.css'

import { useStore } from '@nanostores/react'
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { BrandMark } from '@/components/brand-mark'
import { Codicon } from '@/components/ui/codicon'
import { chatMessageText } from '@/lib/chat-messages'
import { cn } from '@/lib/utils'
import { $hudLayout, dragHudEdge, expandHudEdge } from '@/store/hud-layout'
import { $activeSessionAwaitingInput } from '@/store/prompts'
import { $busy, $messages } from '@/store/session'

import { NEW_CHAT_ROUTE } from '../routes'

/** How close to the screen edge the pointer must come to bring a tucked tab out. */
const EDGE_REACH_PX = 28
/** How long a reply bubble stays up when nobody touches it. */
const POPUP_MS = 9000
const POPUP_CHARS = 220
/** The bubble's exit, kept in step with the CSS transition so it unmounts once it is gone. */
const POPUP_EXIT_MS = 240
/** How long the tab must be held before it lifts and can be moved. */
const LONG_PRESS_MS = 320
/** Movement that cancels a press before it lifts (a hand that slipped, not a drag). */
const PRESS_SLOP_PX = 6

function lastReply(): string {
  const messages = $messages.get()

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!

    if (message.role === 'assistant') {
      const text = chatMessageText(message).replace(/\s+/g, ' ').trim()

      return text.length > POPUP_CHARS ? `${text.slice(0, POPUP_CHARS).trimEnd()}…` : text
    }
  }

  return ''
}

/** Whether the pointer is at the screen edge, from the page's own mousemove (macOS / Windows forward it while the
 *  window lets clicks through) or from main's cursor feed (Linux). */
function usePointerAtEdge(): boolean {
  const [near, setNear] = useState(false)

  useEffect(() => {
    const at = (x: number) => setNear(x >= window.innerWidth - EDGE_REACH_PX)
    const onMove = (event: MouseEvent) => at(event.clientX)
    const onLeave = () => setNear(false)
    const stopFeed = window.hermesDesktop?.hud?.onCursor?.(point => (point ? at(point.x) : setNear(false)))

    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      stopFeed?.()
    }
  }, [])

  return near
}

interface Popup {
  dismiss: () => void
  hold: (held: boolean) => void
  open: boolean
  text: string
}

/** A reply that finished while the tab is folded: its opening words, for a while. `open` drives the enter/leave
 *  transition; `text` outlives it until the bubble has faded out. */
function useReplyPopup(enabled: boolean): Popup {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    let previous = $busy.get()

    return $busy.listen(next => {
      const reply = previous && !next && enabled ? lastReply() : ''

      previous = next

      if (reply) {
        setText(reply)
        setOpen(true)
      }
    })
  }, [enabled])

  useEffect(() => {
    if (!open || held) {
      return
    }

    const timer = window.setTimeout(() => setOpen(false), POPUP_MS)

    return () => window.clearTimeout(timer)
  }, [held, open])

  useEffect(() => {
    if (open || !text) {
      return
    }

    const timer = window.setTimeout(() => setText(''), POPUP_EXIT_MS)

    return () => window.clearTimeout(timer)
  }, [open, text])

  return { dismiss: () => setOpen(false), hold: setHeld, open, text }
}

/** Long press to lift the tab, then move it along the edge. Returns whether it is lifted, the pointer handlers,
 *  and a guard that swallows the click a drag ends with. */
function useEdgeDrag() {
  const [lifted, setLifted] = useState(false)
  const press = useRef<null | { timer: number; x: number; y: number }>(null)
  const dragged = useRef(false)

  const cancelPress = () => {
    if (press.current) {
      window.clearTimeout(press.current.timer)
      press.current = null
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return
    }

    const target = event.currentTarget
    const pointerId = event.pointerId

    dragged.current = false
    cancelPress()
    press.current = {
      x: event.clientX,
      y: event.clientY,
      timer: window.setTimeout(() => {
        press.current = null
        dragged.current = true
        target.setPointerCapture(pointerId)
        setLifted(true)
        dragHudEdge('begin')
      }, LONG_PRESS_MS)
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (lifted) {
      dragHudEdge('move')
    } else if (
      press.current &&
      Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > PRESS_SLOP_PX
    ) {
      cancelPress()
    }
  }

  const onPointerUp = () => {
    cancelPress()

    if (lifted) {
      setLifted(false)
      dragHudEdge('end')
    }
  }

  useEffect(() => cancelPress, [])

  return {
    lifted,
    handlers: { onPointerCancel: onPointerUp, onPointerDown, onPointerMove, onPointerUp },
    /** A click that ended a drag is not a click. */
    clicked: () => !dragged.current
  }
}

export function HudEdgeWidget() {
  const layout = useStore($hudLayout)
  const busy = useStore($busy)
  const waiting = useStore($activeSessionAwaitingInput)
  const navigate = useNavigate()
  const atEdge = usePointerAtEdge()
  const [hovered, setHovered] = useState(false)
  const popup = useReplyPopup(layout.edgePopups)
  const { clicked, handlers, lifted } = useEdgeDrag()
  const [unread, setUnread] = useState(false)

  useEffect(() => {
    if (popup.open) {
      setUnread(true)
    }
  }, [popup.open])

  const out = !layout.edgeHoverOnly || atEdge || hovered || lifted || popup.open || waiting
  const state = waiting ? 'waiting' : busy ? 'working' : unread ? 'unread' : 'idle'

  const open = (fresh = false) => {
    if (!clicked()) {
      return
    }

    setUnread(false)
    popup.dismiss()

    if (fresh) {
      navigate(NEW_CHAT_ROUTE)
    }

    expandHudEdge()
  }

  return (
    <div className="pointer-events-none absolute inset-0" data-hud-edge-widget="">
      {popup.text && (
        <button
          className="hud-edge-bubble pointer-events-auto"
          data-open={popup.open ? '' : undefined}
          onClick={() => open()}
          onPointerEnter={() => popup.hold(true)}
          onPointerLeave={() => popup.hold(false)}
          type="button"
        >
          <span className="hud-edge-bubble-title">
            <BrandMark className="size-3.5" />
            Brain
          </span>
          <span className="hud-edge-bubble-text">{popup.text}</span>
        </button>
      )}
      <div
        className={cn('hud-edge-tab pointer-events-auto', !out && 'hud-edge-tab-tucked')}
        data-hud-grabbing={lifted ? '' : undefined}
        data-lifted={lifted ? '' : undefined}
        data-state={state}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        {...handlers}
      >
        <button aria-label="Open Brain" className="hud-edge-face" onClick={() => open()} type="button">
          <BrandMark className="size-9" />
          <span aria-hidden className="hud-edge-ring" />
          <span aria-hidden className="hud-edge-dot" />
        </button>
        <button aria-label="New conversation" className="hud-edge-plus" onClick={() => open(true)} type="button">
          <Codicon name="add" size="0.9375rem" />
        </button>
      </div>
    </div>
  )
}
