/**
 * Brain (Pro Mode): puts the Pro panel in the layout while Pro Mode is on — a pane of its own, docked as the first
 * tab of the right column (beside Files), and taken away again when Pro Mode is turned off. Mounted once with the
 * shell; renders nothing itself.
 */

import { useEffect } from 'react'

import { revealTreePane } from '@/components/pane-shell/tree/store'
import { registry } from '@/contrib/registry'
import { LocalizedTabTitle, translateNow } from '@/i18n'
import { FILE_BROWSER_DEFAULT_WIDTH, FILE_BROWSER_MAX_WIDTH, FILE_BROWSER_MIN_WIDTH } from '@/store/layout'
import { useProMode } from '@/store/pro-mode'

import { ProPanel } from './pro-panel'

export const PRO_PANE_ID = 'brain-pro'

export function ProPaneHost() {
  const pro = useProMode()

  useEffect(() => {
    if (!pro) {
      return
    }

    const dispose = registry.register({
      area: 'panes',
      data: {
        collapsible: true,
        dock: { before: 'files', pane: 'files', pos: 'center' },
        // The Files pane's own sizes: it shares that zone, so its track never ends up narrower than the panel.
        maxWidth: FILE_BROWSER_MAX_WIDTH,
        minWidth: FILE_BROWSER_MIN_WIDTH,
        placement: 'right',
        tabTitle: () => <LocalizedTabTitle select={t => t.pro.title} />,
        tabTitleText: () => translateNow('pro.title'),
        width: FILE_BROWSER_DEFAULT_WIDTH
      },
      id: PRO_PANE_ID,
      render: () => <ProPanel />,
      title: translateNow('pro.title')
    })

    revealTreePane(PRO_PANE_ID)

    return dispose
  }, [pro])

  return null
}
