/**
 * Brain (Pro Mode): the titlebar's right edge, simpler — the tools you rarely reach for (layout editor, HUD, swap
 * sides) fold into one "⋯" menu; the bell and the right-panel toggle stay. Off, the edge is the app's own.
 */

import { titlebarButtonClass } from '@/app/shell/titlebar'
import type { TitlebarTool } from '@/app/shell/titlebar-controls'
import { TitlebarIcon } from '@/app/shell/titlebar-icon'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export const PRO_MORE_ID = 'pro-more'

const FOLDED = new Set(['flip-panes', 'hud', 'layout'])

/** `tools` with the rarely-used ones folded into one `PRO_MORE_ID` entry (where the first one stood) while `pro`. */
export function foldProTools<T extends TitlebarTool>(tools: T[], pro: boolean): { folded: T[]; tools: TitlebarTool[] } {
  const folded = pro ? tools.filter(tool => FOLDED.has(tool.id)) : []

  if (folded.length < 2) {
    return { folded: [], tools }
  }

  const at = tools.findIndex(tool => FOLDED.has(tool.id))
  const kept = tools.filter(tool => !FOLDED.has(tool.id))
  const more: TitlebarTool = { icon: null, id: PRO_MORE_ID, label: '' }

  return { folded, tools: [...kept.slice(0, at), more, ...kept.slice(at)] }
}

export function ProMoreMenu({ tools }: { tools: readonly TitlebarTool[] }) {
  const { t } = useI18n()

  return (
    <DropdownMenu>
      <Tip label={t.pro.more} placement="toolbar">
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t.pro.more}
            className={cn(titlebarButtonClass, 'bg-transparent select-none')}
            onPointerDown={event => event.stopPropagation()}
            size="icon-titlebar"
            type="button"
            variant="ghost"
          >
            <TitlebarIcon name="ellipsis" />
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="end" className="min-w-48 p-1" sideOffset={6}>
        {tools.map(tool => (
          <DropdownMenuItem className="gap-2.5 py-1.5" key={tool.id} onSelect={() => tool.onSelect?.()}>
            <span className="grid size-4 place-items-center [&_svg]:size-3.5">{tool.icon}</span>
            {tool.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
