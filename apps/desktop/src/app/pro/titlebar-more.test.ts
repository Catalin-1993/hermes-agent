/** Brain (Pro Mode): rarely-used titlebar tools fold into one "⋯" in Pro, and stay as they are without it. */
import { describe, expect, it } from 'vitest'

import { foldProTools, PRO_MORE_ID } from './titlebar-more'

const tool = (id: string) => ({ icon: null, id, label: id })
const edge = ['layout', 'hud', 'flip-panes', 'notifications', 'right-sidebar'].map(tool)

describe('foldProTools', () => {
  it('folds layout, HUD and swap into one entry where they stood, keeping the bell and the panel toggle', () => {
    const { folded, tools } = foldProTools(edge, true)

    expect(tools.map(t => t.id)).toEqual([PRO_MORE_ID, 'notifications', 'right-sidebar'])
    expect(folded.map(t => t.id)).toEqual(['layout', 'hud', 'flip-panes'])
  })

  it('leaves the edge untouched outside Pro, or when there is only one tool to fold', () => {
    expect(foldProTools(edge, false).tools).toBe(edge)
    expect(foldProTools([tool('layout'), tool('right-sidebar')], true).tools.map(t => t.id)).toEqual([
      'layout',
      'right-sidebar'
    ])
  })
})
