/** The on/off rows that shape how a conversation reads and scrolls: the structured layout (Brain), the timeline bars
 *  along its edge, and whether the last question stays pinned at the top. Each is a desktop-local preference. */

import { useStore } from '@nanostores/react'

import { useI18n } from '@/i18n'
import { $structuredChat, setStructuredChat } from '@/store/chat-style'
import { $stickyPrompt, setStickyPrompt } from '@/store/sticky-prompt'
import { $hideThreadTimeline, setHideThreadTimeline } from '@/store/thread-timeline'

import { ToggleRow } from './primitives'
import { SETTING_IDS, settingElementId } from './settings-manifest'

const ids = SETTING_IDS.appearance

export function ThreadDisplayToggles() {
  const a = useI18n().t.settings.appearance
  const hideTimeline = useStore($hideThreadTimeline)
  const stickyPrompt = useStore($stickyPrompt)
  const structured = useStore($structuredChat)

  return (
    <>
      <ToggleRow
        checked={structured}
        description={a.structuredChatDesc}
        id={settingElementId(ids.structuredChat)}
        label={a.structuredChatTitle}
        onChange={setStructuredChat}
      />
      <ToggleRow
        checked={hideTimeline}
        description={a.hideThreadTimelineDesc}
        id={settingElementId(ids.hideThreadTimeline)}
        label={a.hideThreadTimelineTitle}
        onChange={setHideThreadTimeline}
      />
      <ToggleRow
        checked={stickyPrompt}
        description={a.stickyPromptDesc}
        id={settingElementId(ids.stickyPrompt)}
        label={a.stickyPromptTitle}
        onChange={setStickyPrompt}
      />
    </>
  )
}
