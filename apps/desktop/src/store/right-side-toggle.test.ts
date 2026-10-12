import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { findGroupOfPane, group, type LayoutNode, split } from '@/components/pane-shell/tree/model'
import { $collapsedTreeSides, $hiddenTreePanes, $layoutTree } from '@/components/pane-shell/tree/store'
import { registry } from '@/contrib/registry'
import {
  $fileBrowserOpen,
  $leftSideOpen,
  $panesFlipped,
  $sidebarOpen,
  setFileBrowserOpen,
  setSidebarOpen,
  toggleLeftSide,
  toggleRightSide
} from '@/store/layout'
import { $rightSideOpen } from '@/store/right-side'

// The right-side toggle must be POSITIONAL: it acts on whatever column is
// physically rightmost in the root row — including a preview-tile column
// (the Browser), whose panes register with `placement: 'main'` and are
// therefore invisible to the semantic side derivation. Ground truth for the
// "⌘J / titlebar toggle does nothing to the browser pane" bug: the old
// pane-bound toggle pressed the files pane, which the user had dragged into
// the left stack.

const BROWSER = 'preview-tile:url:browser'

// Mirror controller.tsx registrations: sessions left, files/terminal right,
// and a preview tile (Browser) that docks beside main with placement 'main'.
beforeAll(() => {
  const placements = { sessions: 'left', files: 'right', terminal: 'right', [BROWSER]: 'main', workspace: 'main' }

  for (const [id, placement] of Object.entries(placements)) {
    registry.register({ id, area: 'panes', title: id, data: { placement }, render: () => null })
  }
})

beforeEach(() => {
  window.localStorage.clear()
  $collapsedTreeSides.set(new Set())
  $hiddenTreePanes.set(new Set())
  setSidebarOpen(true)
  setFileBrowserOpen(true)
})

const groupOf = (paneId: string) => findGroupOfPane($layoutTree.get() as LayoutNode, paneId)

describe('positional right-side toggle', () => {
  // User's arrangement: left stack holds sessions+files (dragged), browser
  // column is its own zone on the right of the root row.
  const browserRight = () =>
    $layoutTree.set(split('row', [group(['sessions', 'files']), group(['workspace']), group([BROWSER])]))

  it('folds the rightmost side column (the browser) to a minimized rail', () => {
    browserRight()

    toggleRightSide()

    expect(groupOf(BROWSER)?.minimized).toBe(true)
  })

  it('round-trips: a second press restores the zone', () => {
    browserRight()

    toggleRightSide()
    toggleRightSide()

    expect(groupOf(BROWSER)?.minimized).toBe(false)
  })

  it('leaves the left stack (sessions+files) untouched', () => {
    browserRight()

    toggleRightSide()

    expect(Boolean(groupOf('files')?.minimized)).toBe(false)
  })

  // Nothing right of main, or a nested right-hand split the positional fold
  // can't target: the search must never cross main into the left sidebar.
  it.each([
    ['no right column', () => split('row', [group(['sessions']), group(['workspace'])])],
    [
      'a nested right split',
      () =>
        split('row', [
          group(['sessions']),
          group(['workspace']),
          split('column', [group(['files']), group(['terminal'])])
        ])
    ]
  ])('never folds the left sidebar (%s)', (_, tree) => {
    $layoutTree.set(tree())

    toggleRightSide()

    expect(Boolean(groupOf('sessions')?.minimized)).toBe(false)
    expect($collapsedTreeSides.get().has('left')).toBe(false)
  })

  // A side collapsed through its owner (the files toggle) is hidden even
  // though its zone isn't minimized: the first press must OPEN it, through
  // that owner, so the store the titlebar reads agrees.
  it('first press reopens a right side collapsed by setFileBrowserOpen(false)', () => {
    $layoutTree.set(split('row', [group(['sessions']), group(['workspace']), group(['files'])]))
    setFileBrowserOpen(false)

    toggleRightSide()

    expect($collapsedTreeSides.get().has('right')).toBe(false)
    expect(Boolean(groupOf('files')?.minimized)).toBe(false)
    expect($fileBrowserOpen.get()).toBe(true)
  })
})

// The titlebar shows its right-hand tools only while this is true, so it must agree with what the
// positional toggle just did to the tree — not with the files flag alone.
describe('$rightSideOpen', () => {
  it('follows the rightmost column through the positional toggle, whatever lives in it', () => {
    $layoutTree.set(split('row', [group(['sessions', 'files']), group(['workspace']), group([BROWSER])]))
    expect($rightSideOpen.get()).toBe(true)

    toggleRightSide()
    expect($rightSideOpen.get()).toBe(false)

    toggleRightSide()
    expect($rightSideOpen.get()).toBe(true)
  })

  it('reads closed once the right side is collapsed through its owner', () => {
    $layoutTree.set(split('row', [group(['sessions']), group(['workspace']), group(['files'])]))
    expect($rightSideOpen.get()).toBe(true)

    setFileBrowserOpen(false)
    expect($rightSideOpen.get()).toBe(false)
  })

  it('falls back to the files flag when nothing foldable sits on the right', () => {
    $layoutTree.set(split('row', [group(['sessions']), group(['workspace'])]))

    setFileBrowserOpen(true)
    expect($rightSideOpen.get()).toBe(true)

    setFileBrowserOpen(false)
    expect($rightSideOpen.get()).toBe(false)
  })
})

// The LEFT titlebar button has the same positional contract (#66357): after a
// ⌘\ flip the sessions pane sits physically RIGHT and the file tree LEFT, so
// the old pane-bound left toggle folded the sessions column from the LEFT
// button — leaving the physically-left file tree unreachable and BOTH
// buttons acting on the same column.
describe('positional left-side toggle', () => {
  // Flipped arrangement: files physically left, main, sessions right.
  const filesLeft = () => {
    $panesFlipped.set(true)
    $layoutTree.set(split('row', [group(['files']), group(['workspace']), group(['sessions'])]))
  }

  it('folds the physically-left files column after a flip, never the sessions pane', () => {
    filesLeft()

    toggleLeftSide()

    expect(Boolean(groupOf('files')?.minimized)).toBe(true)
    expect(Boolean(groupOf('sessions')?.minimized)).toBe(false)
  })

  it('round-trips: a second press restores the zone', () => {
    filesLeft()

    toggleLeftSide()
    toggleLeftSide()

    expect(Boolean(groupOf('files')?.minimized)).toBe(false)
  })

  // The sessions sidebar hides outright (no minimized Sessions/Bots rail), and a second press brings it back.
  it('hides the sessions column on the unflipped layout without a rail, and never touches the right column', () => {
    $panesFlipped.set(false)
    $layoutTree.set(split('row', [group(['sessions']), group(['workspace']), group(['files'])]))

    toggleLeftSide()

    expect($leftSideOpen.get()).toBe(false)
    expect(Boolean(groupOf('sessions')?.minimized)).toBe(false)
    expect(Boolean(groupOf('files')?.minimized)).toBe(false)

    toggleLeftSide()

    expect($leftSideOpen.get()).toBe(true)
  })

  // Nothing left of main: the search must never cross main into the right
  // column — it falls back to the semantic sidebar branch instead.
  it('falls back to the sidebar branch when main is leftmost', () => {
    $panesFlipped.set(false)
    $layoutTree.set(split('row', [group(['workspace']), group(['files'])]))

    toggleLeftSide()

    expect($collapsedTreeSides.get().has('right')).toBe(false)
    expect($sidebarOpen.get()).toBe(false)
  })

  it('first press reopens a left side collapsed by setSidebarOpen(false) when flipped', () => {
    filesLeft()
    setFileBrowserOpen(false)

    toggleLeftSide()

    expect($collapsedTreeSides.get().has('left')).toBe(false)
    expect(Boolean(groupOf('files')?.minimized)).toBe(false)
    expect($fileBrowserOpen.get()).toBe(true)
  })

  it('$leftSideOpen tracks the physically-left column, not the sidebar pane', () => {
    filesLeft()
    setFileBrowserOpen(false)

    expect($leftSideOpen.get()).toBe(false)

    setFileBrowserOpen(true)
    expect($leftSideOpen.get()).toBe(true)

    // Folding the zone through the toggle flips it too.
    toggleLeftSide()
    expect($leftSideOpen.get()).toBe(false)
  })
})
