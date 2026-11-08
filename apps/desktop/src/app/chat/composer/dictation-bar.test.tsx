/** The recording bar: ×, a moving waveform with the time, ✓ and send — each doing what it shows. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DictationBar, type DictationBarControls, WAVE_SAMPLES } from './dictation-bar'

const controls = (status: 'recording' | 'transcribing' = 'recording'): DictationBarControls => ({
  cancel: vi.fn(),
  finish: vi.fn(),
  send: vi.fn(),
  state: { elapsedSeconds: 102, level: 0.6, status }
})

beforeEach(() => vi.useFakeTimers())

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('dictation bar', () => {
  it('shows the elapsed time and wires ×, ✓ and send to their actions', () => {
    const dictation = controls()

    render(<DictationBar dictation={dictation} />)

    expect(screen.getByText('1:42')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop dictation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(dictation.cancel).toHaveBeenCalledTimes(1)
    expect(dictation.finish).toHaveBeenCalledTimes(1)
    expect(dictation.send).toHaveBeenCalledTimes(1)
  })

  it('fills the waveform with the voice level over time, dots for what is still to come', () => {
    const { container } = render(<DictationBar dictation={controls()} />)
    const wave = () => container.querySelector('[data-dictation-wave]')!

    expect(wave().children).toHaveLength(WAVE_SAMPLES)
    expect(wave().querySelectorAll('.w-\\[3px\\]')).toHaveLength(0)

    act(() => vi.advanceTimersByTime(500))

    expect(wave().querySelectorAll('.w-\\[3px\\]').length).toBeGreaterThan(0)
    expect(wave().children).toHaveLength(WAVE_SAMPLES)
  })

  it('says it is transcribing and takes no clicks once the take has stopped', () => {
    render(<DictationBar dictation={controls('transcribing')} />)

    expect(screen.getByText('Transcribing')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
