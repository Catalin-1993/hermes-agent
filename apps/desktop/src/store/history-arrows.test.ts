/** Brain: a page lends itself the back / forward arrows only while it holds them; history returns on release. */
import { describe, expect, it, vi } from 'vitest'

import { $historyArrows, claimHistoryArrows } from './history-arrows'

const arrows = () => ({ back: vi.fn(), canBack: true, canForward: false, forward: vi.fn() })

describe('claimHistoryArrows', () => {
  it('hands the arrows back on release, and an older release never clears a newer claim', () => {
    const first = arrows()
    const releaseFirst = claimHistoryArrows(first)
    expect($historyArrows.get()).toBe(first)

    const second = arrows()
    const releaseSecond = claimHistoryArrows(second)
    releaseFirst()
    expect($historyArrows.get()).toBe(second)

    releaseSecond()
    expect($historyArrows.get()).toBeNull()
  })
})
