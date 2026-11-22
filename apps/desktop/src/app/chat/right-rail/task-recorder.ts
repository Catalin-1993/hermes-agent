/**
 * Brain: TASK RECORDER — "Teach a task → Show me in the browser" from the composer's + menu.
 *
 * Phases, one at a time across the window:
 * - `armed`: the in-app browser is open and its bar offers Record; go to the page you want to start from first.
 * - `recording`: one Browser tab is being watched. Every few hundred ms the page half (record-in-page.ts) is asked,
 *   through that tab's script runner, for what it captured; a page that is still loading is simply asked again on
 *   the next beat, and a new document re-installs the listeners on the first ask.
 * - `review`: Stop took the last capture, quieted the page and folded the capture into a routine
 *   (routine.ts). A dialog shows the steps; Save hands the composer that asked a `/learn` request carrying them,
 *   so the agent writes the skill with its own tools; Discard drops everything.
 *
 * Nothing leaves the window until Save, and secrets never leave the page at all.
 */

import { atom } from 'nanostores'

import {
  type ComposerTarget,
  requestComposerFocus,
  requestComposerInsert,
  requestComposerSubmit
} from '@/app/chat/composer/focus'
import type { RecordedPageEvent } from '@/lib/task-recorder/record-in-page'
import { RECORD_IN_PAGE_SOURCE, STOP_IN_PAGE_SOURCE } from '@/lib/task-recorder/record-in-page'
import { routineFromEvents, routineLearnRequest, type RoutineStep } from '@/lib/task-recorder/routine'
import { openBrowserTab } from '@/store/preview'

import { previewScriptRunnerFor } from './preview-script-runner'

export type TaskRecorderState =
  | { phase: 'armed'; target: ComposerTarget }
  | { events: RecordedPageEvent[]; phase: 'recording'; startedAt: number; tabId: string; target: ComposerTarget }
  | { phase: 'idle' }
  | { phase: 'review'; steps: RoutineStep[]; tabId: string; target: ComposerTarget }

export const $taskRecorder = atom<TaskRecorderState>({ phase: 'idle' })

const POLL_MS = 400

let timer: ReturnType<typeof setInterval> | null = null
let inFlight = false

/** Ask `tabId`'s live page for what it captured since the last ask; [] while it loads or refuses. */
async function drain(tabId: string): Promise<RecordedPageEvent[]> {
  const binding = previewScriptRunnerFor(tabId)

  if (!binding) {
    return []
  }

  try {
    const raw = await binding.runner(RECORD_IN_PAGE_SOURCE)
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : []

    return Array.isArray(parsed) ? (parsed as RecordedPageEvent[]) : []
  } catch {
    // A navigation tore the document down mid-call; the next beat asks the new one.
    return []
  }
}

async function tick(): Promise<void> {
  const state = $taskRecorder.get()

  if (state.phase !== 'recording' || inFlight) {
    return
  }

  inFlight = true

  try {
    const events = await drain(state.tabId)
    const now = $taskRecorder.get()

    if (events.length && now.phase === 'recording' && now.tabId === state.tabId) {
      $taskRecorder.set({ ...now, events: [...now.events, ...events] })
    }
  } finally {
    inFlight = false
  }
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

/** Open the in-app browser with Record offered in its bar; the routine goes to the composer at `target`. */
export function armTaskRecorder(target: ComposerTarget): void {
  stopTimer()
  openBrowserTab()
  $taskRecorder.set({ phase: 'armed', target })
}

/** Start watching `tabId` — the Browser tab whose Record was pressed. */
export function startTaskRecording(tabId: string): void {
  const state = $taskRecorder.get()

  if (state.phase !== 'armed') {
    return
  }

  $taskRecorder.set({ events: [], phase: 'recording', startedAt: Date.now(), tabId, target: state.target })
  stopTimer()
  timer = setInterval(() => void tick(), POLL_MS)
  void tick()
}

/** Take the last capture, quiet the page, and move to review. */
export async function stopTaskRecording(): Promise<void> {
  const state = $taskRecorder.get()

  if (state.phase !== 'recording') {
    return
  }

  stopTimer()

  while (inFlight) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }

  const last = await drain(state.tabId)

  void previewScriptRunnerFor(state.tabId)
    ?.runner(STOP_IN_PAGE_SOURCE)
    .catch(() => undefined)

  const now = $taskRecorder.get()
  const events = now.phase === 'recording' ? now.events : state.events

  $taskRecorder.set({
    phase: 'review',
    steps: routineFromEvents([...events, ...last]),
    tabId: state.tabId,
    target: state.target
  })
}

/** Drop the recording, whatever phase it is in. */
export function cancelTaskRecording(): void {
  const state = $taskRecorder.get()

  stopTimer()

  if (state.phase === 'recording') {
    void previewScriptRunnerFor(state.tabId)
      ?.runner(STOP_IN_PAGE_SOURCE)
      .catch(() => undefined)
  }

  $taskRecorder.set({ phase: 'idle' })
}

/** Hand the reviewed routine to the agent as a `/learn` request, named `name`. */
export function saveTaskRoutine(name: string): void {
  const state = $taskRecorder.get()

  if (state.phase !== 'review' || state.steps.length === 0) {
    return
  }

  const request = routineLearnRequest(name, state.steps)

  // The chat that asked may be hidden behind the Browser; then the request waits in its draft instead.
  if (!requestComposerSubmit(request, { target: state.target })) {
    requestComposerInsert(request, { mode: 'block', target: state.target })
    requestComposerFocus(state.target)
  }

  $taskRecorder.set({ phase: 'idle' })
}
