import { beforeEach, describe, expect, it } from 'vitest'

import {
  $titlebarAppActionsSide,
  setTitlebarAppActionsSide,
  showsOnRightEdge,
  TITLEBAR_APP_ACTIONS_DEFAULT,
  titlebarAppActionsClusterCounts
} from './titlebar-app-actions'

describe('titlebarAppActionsClusterCounts', () => {
  it('adds extras to the cluster they belong to', () => {
    for (const side of ['left', 'right'] as const) {
      const base = titlebarAppActionsClusterCounts(side)
      expect(titlebarAppActionsClusterCounts(side, 1, 2)).toEqual({ left: base.left + 1, right: base.right + 2 })
    }
  })

  it('releases the space of every tool Simple mode hides, on both sides', () => {
    // Sidebar toggle + back / forward + what Simple keeps of the app actions (Layout alone), and the bell;
    // the right-sidebar toggle and the swap are Advanced tools.
    expect(titlebarAppActionsClusterCounts('right', 0, 0, 'simple')).toEqual({ left: 3, right: 2 })
    expect(titlebarAppActionsClusterCounts('left', 0, 0, 'simple')).toEqual({ left: 4, right: 1 })
  })

  it('reserves the bell and the toggle on the right while the right sidebar is closed', () => {
    for (const side of ['left', 'right'] as const) {
      expect(titlebarAppActionsClusterCounts(side, 0, 0, 'advanced', false).right).toBe(2)
    }
  })

  it('gives the open right sidebar its app actions and the swap back', () => {
    const closed = titlebarAppActionsClusterCounts('right', 0, 0, 'advanced', false)
    const open = titlebarAppActionsClusterCounts('right', 0, 0, 'advanced', true)

    // Layout, HUD and the swap join the toggle; the left cluster does not move.
    expect(open.right - closed.right).toBe(3)
    expect(open.left).toBe(closed.left)
  })

  it('keeps app actions that sit on the left whether or not the right sidebar is open', () => {
    expect(titlebarAppActionsClusterCounts('left', 0, 0, 'advanced', false).left).toBe(
      titlebarAppActionsClusterCounts('left', 0, 0, 'advanced', true).left
    )
  })
})

describe('showsOnRightEdge', () => {
  it('always shows the bell and the button that opens the right sidebar', () => {
    for (const side of ['left', 'right'] as const) {
      expect(showsOnRightEdge('right-sidebar', side, false)).toBe(true)
      expect(showsOnRightEdge('right-sidebar', side, true)).toBe(true)
      expect(showsOnRightEdge('notifications', side, false)).toBe(true)
    }
  })

  it('shows the rest only while the right sidebar is open', () => {
    expect(showsOnRightEdge('flip-panes', 'right', false)).toBe(false)
    expect(showsOnRightEdge('flip-panes', 'right', true)).toBe(true)
    expect(showsOnRightEdge('layout', 'right', false)).toBe(false)
    expect(showsOnRightEdge('hud', 'right', true)).toBe(true)
  })

  it('leaves app actions placed on the left to the left cluster', () => {
    expect(showsOnRightEdge('layout', 'left', true)).toBe(false)
    expect(showsOnRightEdge('hud', 'left', true)).toBe(false)
  })
})

describe('$titlebarAppActionsSide', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setTitlebarAppActionsSide(TITLEBAR_APP_ACTIONS_DEFAULT)
  })

  it('persists left', () => {
    setTitlebarAppActionsSide('left')
    expect($titlebarAppActionsSide.get()).toBe('left')
    expect(window.localStorage.getItem('hermes.desktop.titlebarAppActions')).toBe('left')
  })
})
