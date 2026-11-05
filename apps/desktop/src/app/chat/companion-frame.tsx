import { useStore } from '@nanostores/react'
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'

import { PROFILES_ROUTE } from '@/app/routes'
import { TITLEBAR_HEIGHT } from '@/app/shell/titlebar'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { $sessionTiles } from '@/store/session-states'
import { unmarkCompanionChat } from '@/store/side-chat'

const HANDLE = 28

interface Edge {
  /** Distance from the window's right edge to where the handles end: the chat's right edge, or the window's own
   *  right-hand controls when the chat reaches under them. */
  right: number
}

/** The handles of a chat docked beside a page: a ⋯ menu (open as a full chat, the agent's settings) and close. They stand in the window's
 *  top strip on the chat's right edge — level with the back / forward arrows at its left — so the chat has a
 *  header row of its own and its controls share one line with the window's. Docked at the window's right edge the
 *  chat's own edge is where the window's controls are, so they stand beside those instead (see `measure`). Drawn through a portal because the
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
  const navigate = useNavigate()
  const tiles = useStore($sessionTiles)
  const tile = tiles.find(entry => entry.storedSessionId === storedSessionId)
  // The agent is the profile this chat runs in: the Profiles page opens on it.
  const profile = tile?.ownerRoute?.profile ?? tile?.ownerProfile

  const onAgentSettings = () =>
    navigate(profile ? `${PROFILES_ROUTE}?profile=${encodeURIComponent(profile)}` : PROFILES_ROUTE)

  return createPortal(
    <div
      className="fixed z-30 flex gap-0.5 opacity-60 transition-opacity duration-150 [-webkit-app-region:no-drag] focus-within:opacity-100 hover:opacity-100"
      data-slot="companion-handles"
      style={{ right: edge.right + 8, top: (TITLEBAR_HEIGHT - HANDLE) / 2 }}
    >
      <DropdownMenu>
        <Tip label={copy.chatOptions}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={copy.chatOptions}
              className="size-7 rounded-full text-(--ui-text-tertiary)"
              size="icon"
              variant="ghost"
            >
              <Codicon name="kebab-horizontal" size="0.9375rem" />
            </Button>
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent align="end" className="min-w-52" sideOffset={6}>
          <DropdownMenuItem onSelect={() => unmarkCompanionChat(storedSessionId)}>
            <Codicon name="screen-full" size="0.875rem" />
            {copy.openFull}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onAgentSettings}>
            <Codicon name="settings-gear" size="0.875rem" />
            {copy.agentSettings}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
      // The window's own controls (the right sidebar's button, the bell, settings) fill the right end of this strip.
      // A chat docked at the window's right edge reaches under them, so its handles stand just left of them, on the
      // same line, instead of on top of them.
      const controls = document.querySelector('[data-titlebar-cluster="right"]')?.getBoundingClientRect()
      const underControls = controls && controls.width > 0 && controls.right > rect.left && controls.left < rect.right
      const clear = underControls ? Math.round(window.innerWidth - controls.left) : 0
      const right = Math.max(Math.round(window.innerWidth - rect.right), clear)

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
