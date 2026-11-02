import { useStore } from '@nanostores/react'
import { useLayoutEffect, useState } from 'react'

import { TITLEBAR_CHROME_CHANGED_EVENT } from '@/app/shell/titlebar'
import { findGroupOfPane } from '@/components/pane-shell/tree/model'
import { $layoutTree } from '@/components/pane-shell/tree/store'
import { $sidebarOpen } from '@/store/layout'

/**
 * Where the left sidebar (the sessions rail) ends, in px from the window's left edge — 0 while it is hidden or
 * not docked at the left edge. Full pages that open from the app's chrome (Settings, Command Center, …) start
 * there, so the sidebar stays in view beside them.
 */
export function useRailRight(): number {
  const tree = useStore($layoutTree)
  const sidebarOpen = useStore($sidebarOpen)
  const [right, setRight] = useState(0)
  const railId = tree ? findGroupOfPane(tree, 'sessions')?.id : undefined

  useLayoutEffect(() => {
    let observed: HTMLElement | null = null
    const observer = new ResizeObserver(() => read())

    function read() {
      const rail = railId
        ? document.querySelector<HTMLElement>(`[data-tree-group="${CSS.escape(railId)}"]:not([data-pane-host])`)
        : null

      if (rail !== observed) {
        if (observed) {
          observer.unobserve(observed)
        }

        if (rail) {
          observer.observe(rail)
        }

        observed = rail
      }

      const rect = rail?.getBoundingClientRect()
      setRight(sidebarOpen && rect && rect.width > 0 && rect.left < 1 ? Math.round(rect.right) : 0)
    }

    observer.observe(document.body)
    read()
    const frame = requestAnimationFrame(read)
    window.addEventListener('resize', read)
    window.addEventListener(TITLEBAR_CHROME_CHANGED_EVENT, read)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', read)
      window.removeEventListener(TITLEBAR_CHROME_CHANGED_EVENT, read)
    }
  }, [railId, sidebarOpen, tree])

  return right
}
