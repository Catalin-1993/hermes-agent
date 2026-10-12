import { useEffect, useMemo, useState } from 'react'

import { useI18n } from '@/i18n'

import { WidgetFrame } from '../widget-frame'
import { isCompleteWidget, partialHtml, widgetKey } from '../widget-frame-doc'

import type { RichFenceProps } from './types'

/** Once a widget's text stops changing for this long and reads as finished, it comes alive even while
 *  the rest of the reply is still being written. */
const SETTLE_MS = 1200

// Lazy chunk. A ```widget fence is an HTML widget written in the reply itself — no file, so it works
// on any gateway. It draws its markup as it is written and runs its scripts when it is complete.
export default function WidgetRenderer({ code, streaming }: RichFenceProps) {
  const { t } = useI18n()
  const [settledCode, setSettledCode] = useState<null | string>(null)

  useEffect(() => {
    if (!streaming || !isCompleteWidget(code)) {
      return
    }

    const timer = setTimeout(() => setSettledCode(code), SETTLE_MS)

    return () => clearTimeout(timer)
  }, [code, streaming])

  const finished = !streaming || settledCode === code
  const partial = useMemo(() => (finished ? null : partialHtml(code)), [code, finished])

  return (
    <WidgetFrame
      approvalKey={widgetKey(code)}
      doc={finished ? code : null}
      partial={partial}
      title={t.inlineWidget.title}
    />
  )
}
