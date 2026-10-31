import { compactNumber } from '@hermes/shared'
import { useStore } from '@nanostores/react'
import {
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { useLocation, useNavigate } from 'react-router'

import { hudTargetSessionId } from '@/app/hud/handoff'
import { NotificationsPanel } from '@/app/notifications'
import { PANE_TOGGLE_REVEAL_EVENT } from '@/components/pane-shell'
import { toggleLayoutEditMode } from '@/components/pane-shell/edit-mode'
import { $narrowOverlayPaneIds } from '@/components/pane-shell/narrow-overlay-state'
import { findGroupOfPane } from '@/components/pane-shell/tree/model'
import { $layoutTree, $narrowViewport, resetLayoutTree } from '@/components/pane-shell/tree/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tip, TipKeybindLabel } from '@/components/ui/tooltip'
import { Slot } from '@/contrib/react/slot'
import { useContributions } from '@/contrib/react/use-contributions'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { hostHas } from '@/lib/host-capabilities'
import { formatModifierToken } from '@/lib/keybinds/combo'
import { cn } from '@/lib/utils'
import { recordAction } from '@/store/desktop-metrics'
import { canUseHud, toggleHud } from '@/store/hud'
import { $interfaceMode, shownInMode, type Tiered } from '@/store/interface-mode'
import {
  $fileBrowserOpen,
  $leftSideOpen,
  $panesFlipped,
  $sidebarOpen,
  CHAT_SIDEBAR_PANE_ID,
  FILE_BROWSER_PANE_ID,
  toggleLeftSide,
  togglePanesFlipped,
  toggleRightSide
} from '@/store/layout'
import { $notificationFeedUnread } from '@/store/notification-feed'
import { REVIEW_PANE_ID } from '@/store/review'
import { $rightSideOpen } from '@/store/right-side'
import { $unreadSessionCount } from '@/store/session-dot-state'
import { installSidebarPeek, leaveSidebarPeek, pinSidebarPeek, restOnSidebarButton } from '@/store/sidebar-peek'
import {
  $titlebarAppActionsSide,
  showsOnRightEdge,
  TITLEBAR_FIXED_TOOLS,
  type TitlebarFixedToolId
} from '@/store/titlebar-app-actions'

import { appViewForPath, hidesFixedTitlebarClusters, isOverlayView } from '../routes'

import { SidebarModeSwitch } from './sidebar-mode-switch'
import {
  TITLEBAR_CHROME_CHANGED_EVENT,
  TITLEBAR_ICON_BADGE_SCALE,
  titlebarButtonClass,
  titlebarIconSizeCss,
  titlebarToolClusterClass
} from './titlebar'
import { TitlebarIcon } from './titlebar-icon'

export interface TitlebarTool extends Tiered {
  id: string
  label: string
  active?: boolean
  expanded?: boolean
  className?: string
  disabled?: boolean
  hidden?: boolean
  href?: string
  icon: ReactNode
  onSelect?: (event?: MouseEvent) => void
  /** The pointer is on the button (true) or has left it (false). */
  onHover?: (hovering: boolean) => void
  /** Keybind action id — when set, the tooltip shows the label + keybind hint. */
  actionId?: string
  /** Overlay count on the glyph (unread sessions). Hidden when 0/undefined. */
  badge?: number
  title?: string
  to?: string
  /** Durable `data-tour` handle. Tools are addressed by icon and translated
   *  label otherwise, and neither survives a theme or a locale change. */
  tour?: string
}

export type TitlebarToolSide = 'left' | 'right'
export type SetTitlebarToolGroup = (id: string, tools: readonly TitlebarTool[], side?: TitlebarToolSide) => void

interface TitlebarControlsProps extends ComponentProps<'div'> {
  leftTools?: readonly TitlebarTool[]
  tools?: readonly TitlebarTool[]
}

/**
 * The layout button's glyph. Morphs into its composite reset form — the
 * layout icon wearing a small counter-clockwise arrow badge ("layout, back
 * to how it was") — ONLY while the pointer is on the button AND ⌘/Ctrl is
 * held: hover gates via CSS (`group/tool` on the button), the modifier via
 * the window listener. Pressing the modifier elsewhere changes nothing.
 */
function LayoutGlyph({ modHeld }: { modHeld: boolean }) {
  return (
    <>
      <span className={cn('inline-flex', modHeld && 'group-hover/tool:hidden')}>
        <TitlebarIcon name="layout" />
      </span>
      <span className={cn('relative hidden', modHeld && 'group-hover/tool:inline-flex')}>
        <TitlebarIcon name="layout" />
        <span className="absolute -bottom-1 -right-1.5 grid place-items-center rounded-full bg-(--ui-bg-chrome) p-px">
          <TitlebarIcon className="-scale-x-100" name="refresh" size={titlebarIconSizeCss(TITLEBAR_ICON_BADGE_SCALE)} />
        </span>
      </span>
    </>
  )
}

/** Overlay count on a titlebar glyph. Hidden when count is 0/undefined. */
function withCountBadge(icon: ReactNode, count: number | undefined): ReactNode {
  if (!count) {
    return icon
  }

  return (
    <span className="relative inline-flex">
      {icon}
      <span className="pointer-events-none absolute -top-2.5 -right-1.5 z-1">
        <Badge aria-hidden size="overlay" variant="solid">
          {compactNumber(count)}
        </Badge>
      </span>
    </span>
  )
}

/** Live ⌘/Ctrl tracking — mod-click affordances telegraph themselves (the
 *  layout button morphs into its reset form while the modifier is down). */
function useModifierHeld(): boolean {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    const sync = (event: KeyboardEvent) => setHeld(event.metaKey || event.ctrlKey)
    const clear = () => setHeld(false)

    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', clear)

    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', clear)
    }
  }, [])

  return held
}

/** Space the left cluster reaches past the sessions rail's right edge: a gap,
 *  then back / forward at the start of the main area. */
const RAIL_EDGE_OVERHANG = `calc(0.5rem + 2 * var(--titlebar-control-size))`

/**
 * Track the sessions rail while it is docked at the window's left edge. The
 * left cluster then stretches to that edge — sidebar toggle in the rail's
 * corner, back / forward just past it — instead of packing behind the traffic
 * lights. Writes the edge as a CSS var on the cluster (no re-render per sash
 * frame); only the docked/undocked flip re-renders.
 */
function useRailEdgeCluster() {
  const tree = useStore($layoutTree)
  const sidebarOpen = useStore($sidebarOpen)
  const clusterRef = useRef<HTMLDivElement>(null)
  const [docked, setDocked] = useState(false)
  const railId = tree ? findGroupOfPane(tree, 'sessions')?.id : undefined

  useLayoutEffect(() => {
    // Re-found on every read: the rail can mount after this commit, or remount
    // under the same id when the layout rebuilds.
    let observed: HTMLElement | null = null
    const observer = new ResizeObserver(() => read())

    function read() {
      const rail = railId
        ? document.querySelector<HTMLElement>(`[data-tree-group="${CSS.escape(railId)}"]:not([data-pane-host])`)
        : null

      if (rail !== observed) {
        if (observed) {
          observer.unobserve(observed)
        }

        if (rail) {
          observer.observe(rail)
        }

        observed = rail
      }

      const rect = rail?.getBoundingClientRect()
      const atLeftEdge = Boolean(sidebarOpen && rect && rect.width > 0 && rect.left < 1)

      if (atLeftEdge && rect) {
        clusterRef.current?.style.setProperty('--titlebar-rail-edge', `${rect.right}px`)
      }

      setDocked(atLeftEdge)
    }

    // The page itself too: the rail can move without resizing, and the window
    // without resizing — the dev server's stylesheet arrives after the first
    // paint and takes the body's default 8px margin away (the rail read at
    // left: 8 stayed undocked until the next window resize).
    observer.observe(document.body)
    read()
    const frame = requestAnimationFrame(read)
    window.addEventListener('resize', read)
    window.addEventListener(TITLEBAR_CHROME_CHANGED_EVENT, read)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', read)
      window.removeEventListener(TITLEBAR_CHROME_CHANGED_EVENT, read)
    }
  }, [railId, sidebarOpen, tree])

  return { clusterRef, docked }
}

interface SidebarEdge {
  /** Whether the side reads as open, which picks the button's Show or Hide label. */
  open: boolean
  /** The button's aria-expanded; only the browser-hosted Desktop reports it. */
  expanded?: boolean
  toggle: () => void
}

/** The titlebar's two sidebar buttons. The browser-hosted Desktop's narrow layout has no hover to
 * reveal by, so there the buttons read and drive the overlay itself, and they send an explicit open
 * or close: a visible hover reveal is not pinned, and a generic toggle would pin it rather than
 * perform the labelled Hide. A narrow native window keeps the docked toggles, which already route
 * through the overlay's toggle. */
function useSidebarEdges(): { left: SidebarEdge; right: SidebarEdge } {
  const fileBrowserOpen = useStore($fileBrowserOpen)
  const leftSideOpen = useStore($leftSideOpen)
  const narrow = useStore($narrowViewport)
  const overlayPanes = useStore($narrowOverlayPaneIds)
  const browserHost = hostHas('narrowOverlayChrome')
  const overlayChrome = narrow && browserHost
  const rightOverlayId = overlayPanes.has(REVIEW_PANE_ID) ? REVIEW_PANE_ID : FILE_BROWSER_PANE_ID

  const edge = (id: string, dockedOpen: boolean, toggleDocked: () => void): SidebarEdge => {
    const open = overlayChrome ? overlayPanes.has(id) : dockedOpen
    const revealMode = open ? 'close' : 'open'

    return {
      open,
      expanded: browserHost ? open : undefined,
      toggle: overlayChrome
        ? () => window.dispatchEvent(new CustomEvent(PANE_TOGGLE_REVEAL_EVENT, { detail: { id, mode: revealMode } }))
        : toggleDocked
    }
  }

  return {
    left: edge(CHAT_SIDEBAR_PANE_ID, leftSideOpen, toggleLeftSide),
    right: edge(rightOverlayId, fileBrowserOpen, toggleRightSide)
  }
}

export function TitlebarControls({ leftTools = [], tools = [] }: TitlebarControlsProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const modHeld = useModifierHeld()
  const railEdge = useRailEdgeCluster()

  // Pointing at the left edge, or at the button, opens the sidebar (see store/sidebar-peek.ts).
  useEffect(() => installSidebarPeek(), [])
  const rightSideOpen = useStore($rightSideOpen)
  const sidebarOpen = useStore($sidebarOpen)
  const panesFlipped = useStore($panesFlipped)
  const unreadCount = useStore($unreadSessionCount)
  const appActionsSide = useStore($titlebarAppActionsSide)
  const interfaceMode = useStore($interfaceMode)
  const unreadBadge = unreadCount > 0 ? unreadCount : undefined
  const unreadHint = unreadBadge ? ` · ${t.titlebar.unreadSessions(unreadBadge)}` : ''
  // One filter for every cluster: a tool's own `hidden`, then the mode's tier.
  const shown = shownInMode(interfaceMode)
  const visibleTool = (tool: TitlebarTool) => !tool.hidden && shown(tool)

  // `titleBar.*` slot content is mount-scoped — a page's <Contribute> registers
  // only while that surface is up — so a non-empty area means a page is
  // actively projecting chrome into the band right now.
  const titleBarLeft = useContributions('titleBar.left')
  const titleBarRight = useContributions('titleBar.right')
  const pageOwnsTitlebar = titleBarLeft.length + titleBarRight.length > 0

  // POSITIONAL toggles: each button shows/hides everything on its physical
  // side of the main zone (the layout tree collapses the whole side), so they
  // stay correct through flips and rearranges. Both edges resolve their column
  // from the live tree (see toggleLeftSide / toggleRightSide) — the browser
  // column, the sessions column, whatever is physically left / right. Never an
  // active highlight — plain show/hide affordances.
  const { left: leftEdge, right: rightEdge } = useSidebarEdges()
  const leftLabel = leftEdge.open ? t.titlebar.hideSidebar : t.titlebar.showSidebar
  const rightLabel = rightEdge.open ? t.titlebar.hideRightSidebar : t.titlebar.showRightSidebar

  const sidebarTool: TitlebarTool = {
    ...TITLEBAR_FIXED_TOOLS.sidebar,
    actionId: 'view.toggleSidebar',
    badge: panesFlipped ? undefined : unreadBadge,
    icon: <TitlebarIcon name="layout-sidebar-left" />,
    id: 'sidebar',
    expanded: leftEdge.expanded,
    label: `${leftLabel}${panesFlipped ? '' : unreadHint}`,
    // Resting on the button of a closed sidebar for a second and a half opens it — the same sidebar the press
    // opens — and it closes again when the pointer moves away. A shorter pass over the button opens nothing.
    onHover: hovering => (hovering ? restOnSidebarButton() : leaveSidebarPeek()),
    onSelect: () => {
      triggerHaptic('tap')

      if (!pinSidebarPeek()) {
        leftEdge.toggle()
      }
    }
  }

  // Back / forward through the app's own history (routes, sessions, Library
  // pages). Chromium's Navigation API knows both edges of it; the hash router
  // pushes into the same history, and this component re-renders per location.
  const history = (window as Window & { navigation?: { canGoBack: boolean; canGoForward: boolean } }).navigation

  const historyTools: TitlebarTool[] = [
    {
      disabled: history ? !history.canGoBack : false,
      icon: <TitlebarIcon name="arrow-left" />,
      id: 'history-back',
      label: t.titlebar.back,
      onSelect: () => navigate(-1)
    },
    {
      disabled: history ? !history.canGoForward : false,
      icon: <TitlebarIcon name="arrow-right" />,
      id: 'history-forward',
      label: t.titlebar.forward,
      onSelect: () => navigate(1)
    }
  ]

  const flipTool: TitlebarTool & { id: TitlebarFixedToolId } = {
    ...TITLEBAR_FIXED_TOOLS['flip-panes'],
    actionId: 'view.flipPanes',
    icon: <TitlebarIcon name="arrow-swap" />,
    id: 'flip-panes',
    label: t.settings.appearance.flipPanesTitle,
    onSelect: () => {
      triggerHaptic('tap')
      togglePanesFlipped()
    }
  }

  const rightSidebarTool: TitlebarTool & { id: TitlebarFixedToolId } = {
    ...TITLEBAR_FIXED_TOOLS['right-sidebar'],
    actionId: 'view.toggleRightSidebar',
    badge: panesFlipped ? unreadBadge : undefined,
    icon: <TitlebarIcon name="layout-sidebar-right" />,
    id: 'right-sidebar',
    expanded: rightEdge.expanded,
    label: `${rightLabel}${panesFlipped ? unreadHint : ''}`,
    onSelect: () => {
      triggerHaptic('tap')
      rightEdge.toggle()
    },
    tour: 'right-pane-toggle'
  }

  // Static system tools — pinned to the screen's right edge so the left
  // titlebar stays free for tabs (#107351); on that edge they appear only while
  // the right sidebar is open (see `showsOnRightEdge`).
  const systemTools: (TitlebarTool & { id: TitlebarFixedToolId })[] = [
    {
      ...TITLEBAR_FIXED_TOOLS.layout,
      className: 'group/tool',
      // Hover + held ⌘/Ctrl morphs the glyph into its reset form (see
      // LayoutGlyph) — the mod-click telegraphs itself before it happens.
      icon: <LayoutGlyph modHeld={modHeld} />,
      id: 'layout',
      label: t.titlebar.layoutEditor,
      onSelect: event => {
        if (event?.metaKey || event?.ctrlKey) {
          triggerHaptic('warning')
          resetLayoutTree()

          return
        }

        triggerHaptic('open')
        toggleLayoutEditMode()
      },
      title: t.titlebar.layoutEditorTitle(formatModifierToken('mod'))
    },
    {
      ...TITLEBAR_FIXED_TOOLS.hud,
      // No `title`: TitlebarToolButton passes `title` to TipKeybindLabel as a
      // text OVERRIDE, so a long sentence there replaces the short label and
      // crowds the ⌘⇧H hint off the tooltip. Label only — the hint is appended
      // from the action registry, same as every other tool here.
      actionId: 'view.toggleHud',
      hidden: !canUseHud(),
      icon: <TitlebarIcon name="comment-discussion" />,
      id: 'hud',
      label: t.titlebar.enterHud,
      onSelect: () => {
        triggerHaptic('open')
        toggleHud(hudTargetSessionId())
      }
    }
  ]

  const view = appViewForPath(location.pathname)

  // Route changes can replace measured clusters without resizing the panels.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(TITLEBAR_CHROME_CHANGED_EVENT))
  }, [location.pathname, pageOwnsTitlebar])

  // Overlays own the window. These clusters are `fixed` at a higher z-index
  // than the overlay card, so they'd otherwise bleed over it — hide them (and
  // the nested titleBar slots) and let the overlay's own chrome take over.
  if (isOverlayView(view)) {
    return null
  }

  const leftClusterClass = cn(
    titlebarToolClusterClass,
    'left-(--titlebar-controls-left) top-(--titlebar-controls-top) translate-y-(--titlebar-controls-y-nudge)'
  )

  // A contributed full page (`extension`) yields the fixed clusters only while
  // it actually projects chrome into the band — page-mounted `titleBar.*` slots
  // like kanban's board switcher. A page that mounts no titlebar chrome keeps
  // the app's controls; an empty claim would leave a bare strip on every plugin
  // route. Contributed `titleBar.tools` items keep rendering here too, so a
  // chrome-owning page never silently drops a registered item.
  if (hidesFixedTitlebarClusters(view) && pageOwnsTitlebar) {
    const pageTools = [...leftTools, ...tools].filter(visibleTool)

    // Both markers are required even when a page contributes to only one side.
    return (
      <>
        <div className={leftClusterClass} data-titlebar-cluster="left">
          {pageTools.map(tool => (
            <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
          ))}
          <Slot area="titleBar.left" />
        </div>
        <div
          className={cn(titlebarToolClusterClass, 'right-(--titlebar-tools-right) top-(--titlebar-controls-top)')}
          data-titlebar-cluster="right"
        >
          <Slot area="titleBar.right" />
        </div>
      </>
    )
  }

  const edgeTools = [sidebarTool].filter(visibleTool)
  const visibleHistoryTools = historyTools.filter(visibleTool)
  const visibleLeftTools = (appActionsSide === 'left' ? [...systemTools, ...leftTools] : leftTools).filter(visibleTool)

  // The right edge is one list: while the right sidebar is closed it holds only the button that opens it.
  // The bell renders itself (it carries its panel); its entry here only holds its place in the order.
  const bellTool: TitlebarTool & { id: TitlebarFixedToolId } = {
    ...TITLEBAR_FIXED_TOOLS.notifications,
    icon: null,
    id: 'notifications',
    label: t.sidebar.notifications
  }

  const visibleRightTools = [...systemTools, flipTool, bellTool, rightSidebarTool].filter(
    tool => visibleTool(tool) && showsOnRightEdge(tool.id, appActionsSide, rightSideOpen)
  )

  const visiblePaneTools = tools.filter(visibleTool)

  return (
    <>
      {/* After the traffic lights: Sessions ⇄ Bots, then the sidebar toggle and
          back / forward. With the rail docked the cluster reaches its edge, so
          the toggle sits in the rail's corner and the arrows open the main area. */}
      <div
        aria-label={t.shell.windowControls}
        className={leftClusterClass}
        data-titlebar-cluster="left"
        ref={railEdge.clusterRef}
        style={
          railEdge.docked
            ? {
                minWidth: 'max-content',
                width: `calc(var(--titlebar-rail-edge) + ${RAIL_EDGE_OVERHANG} - var(--titlebar-controls-left))`
              }
            : undefined
        }
      >
        {/* Sessions ⇄ Bots switches what the rail shows; with the rail hidden there is nothing to switch. */}
        {sidebarOpen && <SidebarModeSwitch />}
        {visibleLeftTools.map(tool => (
          <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
        ))}
        <Slot area="titleBar.left" />
        <Slot area="titleBar.center" />
        {railEdge.docked && <span aria-hidden className="flex-1" />}
        {edgeTools.map(tool => (
          <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
        ))}
        {railEdge.docked && <span aria-hidden className="w-4 shrink-0" />}
        {visibleHistoryTools.map(tool => (
          <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
        ))}
      </div>

      {visiblePaneTools.length > 0 && (
        <div
          aria-label={t.shell.appControls}
          className={cn(
            titlebarToolClusterClass,
            'top-[calc(var(--titlebar-controls-top)+var(--right-rail-top-inset,0px))] right-[calc(var(--titlebar-tools-right)+var(--shell-preview-toolbar-gap,0))]'
          )}
        >
          {visiblePaneTools.map(tool => (
            <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
          ))}
        </div>
      )}

      <div
        aria-label={t.shell.appControls}
        className={cn(titlebarToolClusterClass, 'right-(--titlebar-tools-right) top-(--titlebar-controls-top)')}
        data-titlebar-cluster="right"
      >
        {visibleRightTools.map(tool =>
          tool.id === 'notifications' ? (
            <NotificationsBell key={tool.id} />
          ) : (
            <TitlebarToolButton key={tool.id} navigate={navigate} tool={tool} />
          )
        )}
        <Slot area="titleBar.right" />
      </div>
    </>
  )
}

/**
 * The titlebar bell: everything that happened while you were elsewhere, in a panel that drops from it.
 * Its count is what you have not opened yet; it stands beside the right-sidebar toggle in every layout.
 */
function NotificationsBell() {
  const { t } = useI18n()
  const unread = useStore($notificationFeedUnread)
  const [open, setOpen] = useState(false)

  const label =
    unread > 0 ? `${t.sidebar.notifications} · ${t.titlebar.unreadNotifications(unread)}` : t.sidebar.notifications

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <Tip label={t.sidebar.notifications} placement="toolbar">
        <PopoverTrigger asChild>
          <Button
            aria-label={label}
            className={cn(titlebarButtonClass, 'bg-transparent select-none')}
            data-slot="notifications-bell"
            onPointerDown={event => event.stopPropagation()}
            size="icon-titlebar"
            type="button"
            variant="ghost"
          >
            {withCountBadge(<TitlebarIcon name="bell" />, unread)}
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1rem)] p-0" side="bottom">
        <NotificationsPanel onOpened={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

function TitlebarToolButton({ navigate, tool }: { navigate: ReturnType<typeof useNavigate>; tool: TitlebarTool }) {
  // Titlebar actions never show an active background — state reads from the
  // icon itself (e.g. the mute/unmute glyph). aria-pressed still carries it
  // for a11y.
  const className = cn(titlebarButtonClass, 'bg-transparent select-none', tool.className)

  const tooltipLabel = tool.actionId ? (
    <TipKeybindLabel actionId={tool.actionId} text={tool.title ?? tool.label} />
  ) : (
    (tool.title ?? tool.label)
  )

  if (tool.href) {
    return (
      <Tip label={tooltipLabel} placement="toolbar">
        <Button asChild className={className} size="icon-titlebar" variant="ghost">
          <a
            aria-label={tool.label}
            data-tour={tool.tour}
            href={tool.href}
            onPointerDown={event => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
          >
            {withCountBadge(tool.icon, tool.badge)}
          </a>
        </Button>
      </Tip>
    )
  }

  return (
    <Tip label={tooltipLabel} placement="toolbar">
      <Button
        aria-expanded={tool.expanded}
        aria-label={tool.label}
        aria-pressed={tool.active ?? undefined}
        className={className}
        data-tour={tool.tour}
        disabled={tool.disabled}
        onClick={event => {
          if (tool.actionId) {
            recordAction(tool.actionId, 'click')
          }

          if (tool.to) {
            navigate(tool.to)
          }

          tool.onSelect?.(event)
        }}
        onPointerDown={event => event.stopPropagation()}
        onPointerEnter={tool.onHover ? () => tool.onHover?.(true) : undefined}
        onPointerLeave={tool.onHover ? () => tool.onHover?.(false) : undefined}
        size="icon-titlebar"
        type="button"
        variant="ghost"
      >
        {withCountBadge(tool.icon, tool.badge)}
      </Button>
    </Tip>
  )
}
