import { computed, type ReadableAtom } from 'nanostores'

import { $collapsedTreeSides, $hiddenTreePanes, $layoutTree } from '@/components/pane-shell/tree/store'

import { $fileBrowserOpen, isRightSideOpen } from './layout'

/**
 * `isRightSideOpen`, reactive: the titlebar shows its right-hand tools only while the right column is
 * on screen. It lives beside the layout store rather than in it so that importing the layout store
 * never reads the tree atoms at load time.
 */
export const $rightSideOpen: ReadableAtom<boolean> = computed(
  [$layoutTree, $collapsedTreeSides, $hiddenTreePanes, $fileBrowserOpen],
  isRightSideOpen
)
