import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { ChevronDown, iconSize } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { recordAction } from '@/store/desktop-metrics'

import { GHOST_ICON_BTN, PRIMARY_ICON_BTN } from './control-classes'
import { useVoiceEngineName, VoiceEngineRows } from './voice-engine-rows'

/**
 * The primary "start voice conversation" button, with the engine picker one
 * click away when the layout shows the voice controls unfolded.
 *
 * In the folded layout the picker lives in the voice menu; unfolded there is
 * no menu, so without this the only way to swap engines was Settings → Voice,
 * which is not where you are when you want to talk. The chevron is a separate
 * button so the primary press stays a single unambiguous action; the tooltip
 * names the engine so the choice is visible before pressing.
 */
export function StartVoiceButton({
  disabled,
  label,
  onStart
}: {
  disabled: boolean
  label: string
  onStart: () => void
}) {
  const { t } = useI18n()
  const engine = useVoiceEngineName()

  return (
    <span className="group/voice relative flex items-center">
      <Tip label={engine ? `${label} — ${engine}` : label} placement="control">
        <Button
          aria-label={label}
          className={PRIMARY_ICON_BTN}
          disabled={disabled}
          onClick={() => {
            triggerHaptic('open')
            recordAction('composer.voice', 'click')
            onStart()
          }}
          size="icon"
          type="button"
        >
          <VoiceBars />
        </Button>
      </Tip>
      {engine ? (
        <DropdownMenu>
          <Tip label={t.composer.voiceEngine} placement="control">
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t.composer.voiceEngine}
                className={cn(GHOST_ICON_BTN, 'absolute left-full ml-0.5 w-4 p-0')}
                disabled={disabled}
                size="icon"
                type="button"
                variant="ghost"
              >
                <ChevronDown
                  className={cn(
                    iconSize.xs,
                    'opacity-0 transition-opacity duration-200 group-hover/voice:opacity-100 group-hover/voice:delay-1200 group-has-data-[state=open]/voice:opacity-100'
                  )}
                />
              </Button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="end" className="min-w-52">
            <VoiceEngineRows disabled={disabled} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </span>
  )
}

/** The industry's "voice" mark: five rounded bars, the middle one tallest and boldest, the sides shorter and finer. */
function VoiceBars() {
  return (
    <svg
      aria-hidden="true"
      className={iconSize.sm}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      viewBox="0 0 16 16"
    >
      <path d="M2 6.5v3" strokeWidth="1.4" />
      <path d="M5 4.5v7" strokeWidth="1.5" />
      <path d="M8 2.5v11" strokeWidth="2" />
      <path d="M11 4.5v7" strokeWidth="1.5" />
      <path d="M14 6.5v3" strokeWidth="1.4" />
    </svg>
  )
}
