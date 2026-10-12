import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { releaseTypingFocus } from '@/components/ui/keyboard-first'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { Hand, type IconComponent, LockOpen, ShieldCheck } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  $approvalModes,
  type ApprovalMode,
  type ApprovalModeRequester,
  setApprovalModeForProfile,
  syncApprovalModeForProfile
} from '@/store/approval-mode'
import { requestGatewayForProfile } from '@/store/gateway'
import { $activeGatewayProfile } from '@/store/profile'

const MODES = ['manual', 'smart', 'off'] as const satisfies readonly ApprovalMode[]

// What each mode means, at a glance: a palm up — it asks you first; a shield — it checks and asks when needed;
// an open lock — nothing guards, nothing asks.
const MODE_ICON: Record<ApprovalMode, IconComponent> = { manual: Hand, off: LockOpen, smart: ShieldCheck }

const PILL = cn(
  'h-(--composer-control-size) shrink-0 gap-1 rounded-md px-1.5 text-xs font-normal',
  'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
)

/**
 * How autonomous the agent is (approvals.mode), beside the composer's "+".
 * Approval mode is a PROFILE setting, so the pill dials the profile it shows
 * directly — never the session-routed dispatcher, which re-scopes to the
 * focused session's owner (#125969).
 */
export function ApprovalModeMenu({ disabled = false }: { disabled?: boolean }) {
  const { t } = useI18n()
  const copy = t.shell.approvalMode
  const profile = useStore($activeGatewayProfile)
  const modes = useStore($approvalModes)
  const mode = modes[profile.trim() || 'default'] ?? 'smart'
  const [open, setOpen] = useState(false)

  const requestGateway = useCallback<ApprovalModeRequester>(
    (method, params) => requestGatewayForProfile(profile, method, params),
    [profile]
  )

  useEffect(() => {
    void syncApprovalModeForProfile(requestGateway, profile).catch(() => undefined)
  }, [profile, requestGateway])

  const labels: Record<ApprovalMode, string> = { manual: copy.manual, off: copy.off, smart: copy.smart }

  const descriptions: Record<ApprovalMode, string> = {
    manual: copy.manualDescription,
    off: copy.offDescription,
    smart: copy.smartDescription
  }

  const title = copy.ariaLabel(labels[mode])

  return (
    <DropdownMenu
      onOpenChange={next => {
        setOpen(next)

        if (!next) {
          releaseTypingFocus()
        }
      }}
      open={open}
    >
      <Tip label={title} side="top">
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={title}
            className={cn(PILL, mode === 'off' && 'text-(--ui-yellow) hover:text-(--ui-yellow)')}
            data-slot="composer-approval-mode"
            disabled={disabled}
            type="button"
            variant="ghost"
          >
            <ModeIcon className="size-3.5" mode={mode} />
            <span>{labels[mode]}</span>
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="end" className="w-72 p-1" side="top" sideOffset={8}>
        <DropdownMenuLabel>{copy.title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          onValueChange={value => {
            void setApprovalModeForProfile(requestGateway, profile, value as ApprovalMode).catch(() => undefined)
          }}
          value={mode}
        >
          {MODES.map(value => (
            <DropdownMenuRadioItem className="items-start gap-2.5" key={value} value={value}>
              <ModeIcon
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  value === 'off' ? 'text-(--ui-yellow)' : 'text-(--ui-text-tertiary)'
                )}
                mode={value}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs text-foreground">{labels[value]}</span>
                <span className="text-[0.6875rem] leading-snug text-(--ui-text-tertiary)">{descriptions[value]}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModeIcon({ className, mode }: { className?: string; mode: ApprovalMode }) {
  const Icon = MODE_ICON[mode]

  return <Icon aria-hidden="true" className={className} />
}
