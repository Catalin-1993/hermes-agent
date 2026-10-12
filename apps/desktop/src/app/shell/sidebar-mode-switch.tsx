import { useStore } from '@nanostores/react'

import { findGroupOfPane } from '@/components/pane-shell/tree/model'
import { paneChrome } from '@/components/pane-shell/tree/renderer/track-model'
import { $layoutTree, $paneVisible, revealTreePane } from '@/components/pane-shell/tree/store'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/ui/tooltip'
import { useContributions } from '@/contrib/react/use-contributions'
import type { Contribution } from '@/contrib/types'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

import { titlebarButtonClass } from './titlebar'
import { TitlebarIcon } from './titlebar-icon'

/** The panes that are sidebar MODES (sessions, Bots), in registration order. */
export function sidebarModePanes(panes: readonly Contribution[]): Contribution[] {
  return panes.filter(pane => paneChrome(pane).modeIcon)
}

/** Buttons the switch adds to the left titlebar cluster (0 with fewer than two modes). */
export function sidebarModeSwitchWidth(panes: readonly Contribution[]): number {
  const modes = sidebarModePanes(panes).length

  return modes > 1 ? modes : 0
}

/**
 * Sessions ⇄ Bots, as a quiet segmented pill in the titlebar. Each segment
 * fronts its pane exactly like the old strip tab did (and opens the sidebar if
 * it was hidden), so Bot Mode's own wiring — which follows its pane's
 * visibility — is untouched.
 */
export function SidebarModeSwitch() {
  const { t } = useI18n()
  const tree = useStore($layoutTree)
  const modes = sidebarModePanes(useContributions('panes'))

  if (modes.length < 2) {
    return null
  }

  // Segments read in their zone's tab order (Sessions, then Bots), not in the
  // registry's, which shifts whenever a plugin re-registers its pane.
  const zone = tree ? findGroupOfPane(tree, modes[0].id) : null

  const rank = (pane: Contribution) => {
    const index = zone?.panes.indexOf(pane.id) ?? -1

    return index < 0 ? Number.MAX_SAFE_INTEGER : index
  }

  modes.sort((a, b) => rank(a) - rank(b))

  return (
    <div
      aria-label={t.titlebar.modeSwitch}
      className="flex items-center rounded-full bg-(--ui-control-hover-background)"
      data-slot="sidebar-mode-switch"
      role="radiogroup"
    >
      {modes.map(pane => (
        <ModeSegment key={pane.id} pane={pane} />
      ))}
    </div>
  )
}

function ModeSegment({ pane }: { pane: Contribution }) {
  const active = useStore($paneVisible(pane.id))
  const chrome = paneChrome(pane)
  const label = chrome.tabTitleText?.() || pane.title || pane.id

  return (
    <Tip label={label} placement="toolbar">
      <Button
        aria-checked={active}
        aria-label={label}
        className={cn(
          titlebarButtonClass,
          'rounded-full select-none',
          active
            ? 'bg-(--ui-bg-editor) text-foreground shadow-[0_0_0_0.0625rem_var(--ui-stroke-tertiary)] hover:bg-(--ui-bg-editor)'
            : 'bg-transparent'
        )}
        onClick={() => {
          triggerHaptic('tap')
          revealTreePane(pane.id)
        }}
        onPointerDown={event => event.stopPropagation()}
        role="radio"
        size="icon-titlebar"
        type="button"
        variant="ghost"
      >
        <TitlebarIcon name={chrome.modeIcon ?? ''} />
      </Button>
    </Tip>
  )
}
