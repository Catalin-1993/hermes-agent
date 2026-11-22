/** Brain: Teach a task → Show me in the browser, end to end against a fake page: arm, record, stop, save. */
import { afterEach, describe, expect, it, vi } from 'vitest'

const page = vi.hoisted(() => ({ batches: [] as unknown[][], scripts: [] as string[] }))

vi.mock('./preview-script-runner', () => ({
  previewScriptRunnerFor: (tabId: string) =>
    tabId === 'browser-1'
      ? {
          generation: 1,
          runner: async (code: string) => {
            page.scripts.push(code)

            return code.includes('__brainTaskRec') && !code.includes('rec.off = true')
              ? JSON.stringify(page.batches.shift() ?? [])
              : true
          },
          tabId
        }
      : null
}))

const composer = vi.hoisted(() => ({ submit: vi.fn(() => true) }))

vi.mock('@/app/chat/composer/focus', () => ({
  requestComposerFocus: vi.fn(),
  requestComposerInsert: vi.fn(),
  requestComposerSubmit: composer.submit
}))

const browser = vi.hoisted(() => ({ open: vi.fn() }))

vi.mock('@/store/preview', () => ({ openBrowserTab: browser.open }))

const { $taskRecorder, armTaskRecorder, cancelTaskRecording, saveTaskRoutine, startTaskRecording, stopTaskRecording } =
  await import('./task-recorder')

afterEach(() => cancelTaskRecording())

describe('task recorder', () => {
  it('opens the browser armed, records the page, and hands the routine to /learn on Save', async () => {
    armTaskRecorder('main')
    expect(browser.open).toHaveBeenCalled()
    expect($taskRecorder.get().phase).toBe('armed')

    page.batches.push([{ at: 1, kind: 'page', url: 'https://shop.test/' }])
    page.batches.push([{ at: 2, kind: 'click', label: 'Sign in', selector: '#sign-in' }])
    startTaskRecording('browser-1')
    await vi.waitFor(() => expect($taskRecorder.get()).toMatchObject({ events: [{ kind: 'page' }] }))

    await stopTaskRecording()

    expect($taskRecorder.get()).toMatchObject({
      phase: 'review',
      steps: [
        { kind: 'open', url: 'https://shop.test/' },
        { kind: 'click', label: 'Sign in', selector: '#sign-in' }
      ]
    })
    expect(page.scripts.at(-1)).toContain('rec.off = true')

    saveTaskRoutine('Sign in')

    expect(composer.submit).toHaveBeenCalledWith(expect.stringMatching(/^\/learn .*"sign-in"/), { target: 'main' })
    expect($taskRecorder.get().phase).toBe('idle')
  })

  it('only records once Record is pressed after arming', () => {
    startTaskRecording('browser-1')
    expect($taskRecorder.get().phase).toBe('idle')
  })
})
