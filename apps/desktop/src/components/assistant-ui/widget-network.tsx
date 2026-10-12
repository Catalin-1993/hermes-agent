import { useStore } from '@nanostores/react'
import { type ReactNode, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { CARD_BUTTON_CLASS, CARD_SURFACE_CLASS, HermesCardIcon } from '@/components/ui/hermes-card'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { networkAccess, parseApprovedHosts } from '@/lib/frame-policy'
import { cn } from '@/lib/utils'
import { $widgetNetwork, setWidgetHosts } from '@/store/widget-network'

interface WidgetNetwork {
  /** Asks the owner about the hosts the document names and has not been approved; null when nothing waits. */
  banner: ReactNode
  /** A control that shows what is open and revokes it; null when nothing is. Place it in a `WidgetToolbar`. */
  globe: ReactNode
  /** The hosts the frame's policy may open now. */
  hosts: string[]
}

/**
 * The internet access of one agent-written page shown in a sealed frame — a chat widget or an artifact:
 * what it names (`hermes:network`), what its owner approved (kept per `approvalKey`), the banner that
 * asks and the control that takes the yes back. The policy itself is `@/lib/frame-policy`.
 */
export function useWidgetNetwork(doc: string | null, approvalKey: string): WidgetNetwork {
  const { t } = useI18n()
  const copy = t.inlineWidget
  const approvals = useStore($widgetNetwork)
  const [later, setLater] = useState(false)
  const approvedText = approvals[approvalKey] ?? ''
  const access = useMemo(() => networkAccess(doc ?? '', approvedText), [doc, approvedText])
  const activeKey = access.active.join(' ')
  const hosts = useMemo(() => (activeKey ? activeKey.split(' ') : []), [activeKey])

  const allow = () => setWidgetHosts(approvalKey, [...parseApprovedHosts(approvedText), ...access.pending])

  const revoke = () =>
    setWidgetHosts(
      approvalKey,
      parseApprovedHosts(approvedText).filter(host => !hosts.includes(host))
    )

  const banner =
    access.pending.length > 0 && !later ? (
      <span
        className={cn(
          CARD_SURFACE_CLASS,
          'mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl py-2 pr-2 pl-2.5 text-[0.8125rem] text-(--ui-text-secondary)'
        )}
        role="alert"
      >
        <HermesCardIcon size="sm">
          <Codicon name="globe" size="0.875rem" />
        </HermesCardIcon>
        <span className="min-w-0 flex-1">{copy.networkAsk(access.pending.join(', '))}</span>
        <span className="flex gap-1">
          <Button className={CARD_BUTTON_CLASS} onClick={() => setLater(true)} size="sm" variant="ghost">
            {copy.networkLater}
          </Button>
          <Button className={CARD_BUTTON_CLASS} onClick={allow} size="sm">
            {copy.networkAllow}
          </Button>
        </span>
      </span>
    ) : null

  const globe =
    hosts.length > 0 ? (
      <Tip label={`${copy.networkOn(hosts.join(', '))} · ${copy.networkRevoke}`}>
        <button
          aria-label={copy.networkRevoke}
          className="grid size-6 place-items-center rounded-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated)/90 text-(--ui-text-tertiary) backdrop-blur-md transition-colors hover:text-(--ui-text-primary)"
          onClick={revoke}
          type="button"
        >
          <Codicon name="globe" size="0.875rem" />
        </button>
      </Tip>
    ) : null

  return { banner, globe, hosts }
}
