/**
 * Brain: the HUD folded into a tab on the right edge of the screen (the `edge` layout, see electron/hud-layout.ts).
 *
 * The tab carries the agent's face with its status ring and a "+" for a new conversation; clicking either opens
 * the bar beside it. With "Show only on hover" it waits tucked behind the edge (a sliver stays visible) and slides
 * out when the pointer reaches the edge. With "Pop up replies" a reply that lands while it is folded appears in a
 * bubble beside the tab for a few seconds; clicking the bubble opens the bar on it.
 *
 * The rest of the HUD window is transparent and lets clicks through (click-through.ts hit-tests the document), so
 * only the tab and the bubble are ever in the way.
 */

import './edge-widget.css'

import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { BrandMark } from '@/components/brand-mark'
import { Codicon } from '@/components/ui/codicon'
import { chatMessageText } from '@/lib/chat-messages'
import { cn } from '@/lib/utils'
import { $hudLayout, expandHudEdge } from '@/store/hud-layout'
import { $activeSessionAwaitingInput } from '@/store/prompts'
import { $busy, $messages } from '@/store/session'

import { NEW_CHAT_ROUTE } from '../routes'

/** How close to the screen edge the pointer must come to bring a tucked tab out. */
const EDGE_REACH_PX = 28
/** How long a reply bubble stays up when nobody touches it. */
const POPUP_MS = 9000
const POPUP_CHARS = 220

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

/** A reply that finished while the tab is folded: its opening words, for a while. */
function useReplyPopup(enabled: boolean): [string, () => void, (hold: boolean) => void] {
  const [text, setText] = useState('')
  const [held, setHeld] = useState(false)

  // A turn that just ended (busy going from true to false) while the tab is folded.
  useEffect(() => {
    let previous = $busy.get()

    return $busy.listen(next => {
      if (previous && !next && enabled) {
        setText(lastReply())
      }

      previous = next
    })
  }, [enabled])

  useEffect(() => {
    if (!text || held) {
      return
    }

    const timer = window.setTimeout(() => setText(''), POPUP_MS)

    return () => window.clearTimeout(timer)
  }, [held, text])

  return [text, () => setText(''), setHeld]
}

export function HudEdgeWidget() {
  const layout = useStore($hudLayout)
  const busy = useStore($busy)
  const waiting = useStore($activeSessionAwaitingInput)
  const navigate = useNavigate()
  const atEdge = usePointerAtEdge()
  const [hovered, setHovered] = useState(false)
  const [reply, dismissReply, holdReply] = useReplyPopup(layout.edgePopups)
  const [unread, setUnread] = useState(false)

  useEffect(() => {
    if (reply) {
      setUnread(true)
    }
  }, [reply])

  const out = !layout.edgeHoverOnly || atEdge || hovered || Boolean(reply) || waiting
  const state = waiting ? 'waiting' : busy ? 'working' : unread ? 'unread' : 'idle'

  const open = (fresh = false) => {
    setUnread(false)
    dismissReply()

    if (fresh) {
      navigate(NEW_CHAT_ROUTE)
    }

    expandHudEdge()
  }

  return (
    <div className="pointer-events-none absolute inset-0" data-hud-edge-widget="">
      {reply && (
        <button
          className="hud-edge-bubble pointer-events-auto"
          onClick={() => open()}
          onPointerEnter={() => holdReply(true)}
          onPointerLeave={() => holdReply(false)}
          type="button"
        >
          <span className="hud-edge-bubble-title">
            <BrandMark className="size-4" />
            Brain
          </span>
          <span className="hud-edge-bubble-text">{reply}</span>
        </button>
      )}
      <div
        className={cn('hud-edge-tab pointer-events-auto', !out && 'hud-edge-tab-tucked')}
        data-state={state}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <button aria-label="Open Brain" className="hud-edge-face" onClick={() => open()} type="button">
          <BrandMark className="size-10" />
          <span aria-hidden className="hud-edge-ring" />
          {state !== 'idle' && state !== 'working' && <span aria-hidden className="hud-edge-dot" />}
        </button>
        <button aria-label="New conversation" className="hud-edge-plus" onClick={() => open(true)} type="button">
          <Codicon name="add" size="1rem" />
        </button>
      </div>
    </div>
  )
}
