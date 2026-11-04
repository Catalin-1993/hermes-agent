import { useStore } from '@nanostores/react'

import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { $panesFlipped, togglePanesFlipped } from '@/store/layout'
import { $companionSide, type CompanionSide, setCompanionSide } from '@/store/side-chat'

import { ListRow, ToggleRow } from './primitives'
import { SETTING_IDS, settingElementId } from './settings-manifest'

/** Where the side panes sit: the sessions sidebar against the file browser, and the Brain chat beside a
 *  Library page. Both are the same question — which side — so they sit together. */
export function PaneSideSettings() {
  const a = useI18n().t.settings.appearance
  const side = useStore($companionSide)
  const panesFlipped = useStore($panesFlipped)

  const options = [
    { id: 'right', label: a.appActionsRight },
    { id: 'left', label: a.appActionsLeft }
  ] as const satisfies readonly { id: CompanionSide; label: string }[]

  return (
    <>
      <ToggleRow
        checked={panesFlipped}
        description={a.flipPanesDesc}
        id={settingElementId(SETTING_IDS.appearance.flipPanes)}
        label={a.flipPanesTitle}
        onChange={() => togglePanesFlipped()}
      />
      <ListRow
        action={
          <SegmentedControl
            onChange={id => {
              triggerHaptic('selection')
              setCompanionSide(id)
            }}
            options={options}
            value={side}
          />
        }
        description={a.companionSideDesc}
        id={settingElementId(SETTING_IDS.appearance.companionSide)}
        title={a.companionSideTitle}
      />
    </>
  )
}
