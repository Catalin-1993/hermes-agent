/**
 * Page-owned header controls (#123597). A page route can render in the
 * workspace pane, whose zone paints `WORKSPACE_PAGE_HEADER_AREA` as the page
 * header, or in a route tile, where nothing reads that area. The control asks
 * WHERE it renders instead of reading the window-global `$workspaceIsPage`,
 * which can't tell a tile's mount from the workspace's.
 */

import { createContext, type ReactNode, useContext } from 'react'

import { PaneTab } from '@/components/ui/pane-tab'
import { Contribute } from '@/contrib/react/contribute'

import { WORKSPACE_PAGE_HEADER_AREA } from '../routes'

/** True inside the workspace pane's routes, whose zone paints the page header.
 *  Provided only by the workspace pane registration (controller.tsx). The
 *  default is false, so any other host fails safe to rendering inline. */
export const WorkspacePageHeaderHostContext = createContext(false)

/** Page-owned control: projected into the workspace page header when this
 *  subtree is hosted by it — standing in the header as its active tab, or
 *  `bare` when the control brings its own tabs — and rendered inline, in
 *  place, anywhere else. */
export function WorkspacePageHeaderControl({
  bare = false,
  children,
  id
}: {
  bare?: boolean
  children: ReactNode
  id: string
}) {
  return useContext(WorkspacePageHeaderHostContext) ? (
    <Contribute area={WORKSPACE_PAGE_HEADER_AREA} id={id}>
      {bare ? children : <PaneTab active>{children}</PaneTab>}
    </Contribute>
  ) : (
    <>{children}</>
  )
}
