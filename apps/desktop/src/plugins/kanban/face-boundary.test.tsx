/** A view that fails for a moment while it draws is drawn again quietly; one that keeps failing shows its error. */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FaceBoundary } from './face-boundary'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function Flaky({ failures }: { failures: { left: number } }) {
  if (failures.left > 0) {
    failures.left -= 1
    throw new TypeError('l is not a function')
  }

  return <p>Agents</p>
}

describe('FaceBoundary', () => {
  it('draws a view again after a passing failure, without showing an error', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <FaceBoundary view="agents">
        <Flaky failures={{ left: 2 }} />
      </FaceBoundary>
    )

    expect(screen.queryByText('This view hit a problem')).toBeNull()
    await act(async () => vi.runAllTimers())
    expect(screen.getByText('Agents')).toBeTruthy()
  })

  it('shows the error with a way out when the view keeps failing', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <FaceBoundary view="agents">
        <Flaky failures={{ left: 10 }} />
      </FaceBoundary>
    )

    for (const _ of [1, 2, 3]) {
      await act(async () => vi.runAllTimers())
    }

    expect(screen.getByText('This view hit a problem')).toBeTruthy()
    expect(screen.getByText('l is not a function')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy details' })).toBeTruthy()
  })
})
