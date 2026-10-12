import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { TITLEBAR_HEIGHT } from '@/app/shell/titlebar'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { unmarkCompanionChat } from '@/store/side-chat'

const HANDLE = 28

interface Edge {
  /** Distance from the window's right edge to the chat's right edge. */
  right: number
}

/** The handles of a chat docked beside a page: open it as a full chat, or close it. They stand in the window's
 *  top strip on the chat's right edge — level with the back / forward arrows at its left — so the chat has a
 *  header row of its own and its controls share one line with the window's. Drawn through a portal because the
 *  chat's own pane clips anything outside it, and placed from the chat's measured edge. */
function CompanionHandles({
  edge,
  onClose,
  storedSessionId
}: {
  edge: Edge
  onClose: () => void
  storedSessionId: string
}) {
  const copy = useI18n().t.library.withHermes

  return createPortal(
    <div
      className="fixed z-30 flex gap-0.5 opacity-60 transition-opacity duration-150 [-webkit-app-region:no-drag] focus-within:opacity-100 hover:opacity-100"
      data-slot="companion-handles"
      style={{ right: edge.right + 8, top: (TITLEBAR_HEIGHT - HANDLE) / 2 }}
    >
      <Tip label={copy.openFull}>
        <Button
          aria-label={copy.openFull}
          className="size-7 rounded-full text-(--ui-text-tertiary)"
          onClick={() => unmarkCompanionChat(storedSessionId)}
          size="icon"
          variant="ghost"
        >
          <Codicon name="screen-full" size="0.8125rem" />
        </Button>
      </Tip>
      <Tip label={copy.closeChat}>
        <Button
          aria-label={copy.closeChat}
          className="size-7 rounded-full text-(--ui-text-tertiary)"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <Codicon name="close" size="0.8125rem" />
        </Button>
      </Tip>
    </div>,
    document.body
  )
}

/** A chat opened beside a page runs without tab chrome (see `bare` in the layout tree): this frame gives it its
 *  two handles. Any other chat passes through untouched. */
export function CompanionFrame({
  children,
  companion,
  onClose,
  storedSessionId
}: {
  children: ReactNode
  companion: boolean
  /** Close the chat (the owner's own close path, so a running turn is confirmed first). */
  onClose: () => void
  storedSessionId: string
}) {
  const frame = useRef<HTMLDivElement | null>(null)
  const [edge, setEdge] = useState<Edge | null>(null)

  const measure = useCallback(() => {
    const rect = frame.current?.getBoundingClientRect()

    if (rect && rect.width > 0) {
      const right = Math.round(window.innerWidth - rect.right)

      setEdge(current => (current?.right === right ? current : { right }))
    }
  }, [])

  // Where the chat's right edge is changes with the window, the neighbouring panes and a divider being dragged.
  useLayoutEffect(() => {
    if (!companion || !frame.current) {
      return
    }

    const observer = new ResizeObserver(measure)

    observer.observe(frame.current)
    observer.observe(document.body)
    measure()

    // A pane beside it opening or closing moves the chat without resizing it, which nothing reports: look again
    // a few times a second (one rectangle, no layout of its own).
    const poll = window.setInterval(measure, 120)

    window.addEventListener('resize', measure)

    return () => {
      observer.disconnect()
      window.clearInterval(poll)
      window.removeEventListener('resize', measure)
    }
  }, [companion, measure])

  if (!companion) {
    return children
  }

  return (
    <div className="relative h-full min-h-0 min-w-0" data-slot="companion-chat" ref={frame}>
      {edge && <CompanionHandles edge={edge} onClose={onClose} storedSessionId={storedSessionId} />}
      {children}
    </div>
  )
}
