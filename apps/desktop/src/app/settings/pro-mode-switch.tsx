/** Brain: the Pro Mode switch in the Settings rail's footer, beside Export / Import / Reset (store/pro-mode.ts). */

import { useId } from 'react'

import { Switch } from '@/components/ui/switch'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { setProMode, useProMode } from '@/store/pro-mode'

export function ProModeSwitch() {
  const { t } = useI18n()
  const copy = t.settings.proMode
  const on = useProMode()
  const id = useId()

  return (
    <Tip label={on ? copy.onHint : copy.offHint}>
      <label
        className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs font-medium text-(--ui-text-secondary) hover:text-foreground"
        data-slot="pro-mode-switch"
        htmlFor={id}
      >
        {copy.label}
        <Switch
          checked={on}
          id={id}
          onCheckedChange={next => {
            triggerHaptic(next ? 'open' : 'close')
            setProMode(next)
          }}
          size="xs"
        />
      </label>
    </Tip>
  )
}
