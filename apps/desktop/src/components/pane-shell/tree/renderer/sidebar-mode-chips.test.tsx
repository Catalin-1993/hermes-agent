import { useStore } from '@nanostores/react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { registry } from '@/contrib/registry'

import { group, split } from '../model'
import { $layoutTree, markCollapsePane } from '../store'

import { TreeGroup } from './tree-group'

function LiveTreeGroup() {
  const tree = useStore($layoutTree)

  return <TreeGroup node={(tree?.type === 'split' ? tree.children[0] : tree) as never} parentAxis="row" />
}

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  vi.stubGlobal('CSS', { ...globalThis.CSS, escape: (value: string) => value })
  HTMLElement.prototype.scrollIntoView ??= () => undefined
})

const disposers: (() => void)[] = []

beforeEach(() => {
  window.localStorage.clear()

  for (const [id, data] of [
    ['sessions', { hideOnly: true, modeIcon: 'comment-discussion', placement: 'left' }],
    ['bots', { hideOnly: true, modeIcon: 'hubot', placement: 'left' }],
    ['terminal', { placement: 'bottom' }]
  ] as const) {
    disposers.push(registry.register({ area: 'panes', data, id, render: () => null, title: id }))
  }

  markCollapsePane('terminal')
  $layoutTree.set(split('row', [group(['sessions', 'bots', 'terminal'], { active: 'sessions', id: 'grp-sessions' })]))
})

afterEach(() => {
  cleanup()
  disposers.splice(0).forEach(dispose => dispose())
})

// Sessions ⇄ Bots live in the titlebar switch: a pane moved into their zone gets a strip of its own,
// never "Sessions" / "Bots" chips repeating that switch.
describe('sidebar mode chips', () => {
  it('shows only the panes the titlebar switch cannot reach', () => {
    render(<LiveTreeGroup />)

    const chips = [...globalThis.document.querySelectorAll('[role="tablist"] [data-tree-tab]')].map(tab =>
      tab.getAttribute('data-tree-tab')
    )

    expect(chips).toEqual(['terminal'])
  })
})
