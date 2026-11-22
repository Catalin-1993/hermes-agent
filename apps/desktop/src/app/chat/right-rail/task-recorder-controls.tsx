/**
 * Brain: the task recorder's face in the Browser bar (task-recorder.ts) — Record while armed, a live pill with the
 * time, the step count and Stop while recording, and the review dialog that names the routine and saves it.
 * Renders nothing on any other tab, or when no recording was asked for.
 */

import { useStore } from '@nanostores/react'
import { useEffect, useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n'
import { describeStep, routineFromEvents, type RoutineStep } from '@/lib/task-recorder/routine'

import {
  $taskRecorder,
  cancelTaskRecording,
  saveTaskRoutine,
  startTaskRecording,
  stopTaskRecording
} from './task-recorder'

const RED = 'var(--ui-red, #f85149)'

const PILL = 'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.6875rem] font-medium'

/** m:ss since `since`, ticking every second. */
function useElapsed(since: number): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)

    return () => clearInterval(id)
  }, [])

  const seconds = Math.max(0, Math.floor((now - since) / 1000))

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function RecordingPill({ events, startedAt }: { events: Parameters<typeof routineFromEvents>[0]; startedAt: number }) {
  const { t } = useI18n()
  const copy = t.composer.taskRecorder
  const elapsed = useElapsed(startedAt)
  const steps = routineFromEvents(events).length

  return (
    <span className="flex shrink-0 items-center gap-1" data-slot="task-recorder">
      <span className={PILL} style={{ background: `color-mix(in oklab, ${RED} 14%, transparent)`, color: RED }}>
        <span className="size-1.5 animate-pulse rounded-full" style={{ background: RED }} />
        <span className="tabular-nums">{elapsed}</span>
        <span className="opacity-70">·</span>
        <span className="tabular-nums">{copy.steps(steps)}</span>
      </span>
      <Button
        className="h-6 rounded-full px-2.5"
        onClick={() => void stopTaskRecording()}
        size="xs"
        variant="secondary"
      >
        <span className="size-2 rounded-[2px]" style={{ background: RED }} />
        {copy.stop}
      </Button>
    </span>
  )
}

function ReviewDialog({ steps }: { steps: RoutineStep[] }) {
  const { t } = useI18n()
  const copy = t.composer.taskRecorder
  const nameId = useId()
  const start = steps.find(step => step.kind === 'open')
  const host = start && 'url' in start ? safeHost(start.url) : ''
  const [name, setName] = useState(() => (host ? copy.defaultName(host) : ''))
  const canSave = steps.length > 0 && name.trim().length > 0

  return (
    <Dialog onOpenChange={open => !open && cancelTaskRecording()} open>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>{copy.reviewTitle}</DialogTitle>
          <DialogDescription>{steps.length ? copy.reviewDescription : copy.empty}</DialogDescription>
        </DialogHeader>
        {steps.length > 0 && (
          <>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-(--ui-text-secondary)" htmlFor={nameId}>
                {copy.name}
              </label>
              <Input
                autoFocus
                id={nameId}
                onChange={event => setName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && canSave) {
                    saveTaskRoutine(name)
                  }
                }}
                value={name}
              />
            </div>
            <ol className="grid max-h-64 gap-0.5 overflow-y-auto rounded-lg bg-(--ui-bg-quaternary,var(--chrome-action-hover)) p-1.5">
              {steps.map((step, index) => (
                <li className="flex items-baseline gap-2.5 rounded-md px-2 py-1 text-[0.8125rem]" key={index}>
                  <span className="w-4 shrink-0 text-right text-[0.6875rem] text-(--ui-text-tertiary) tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 truncate text-foreground">{describeStep(step)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
        <DialogFooter>
          <Button onClick={cancelTaskRecording} variant="ghost">
            {copy.discard}
          </Button>
          <Button disabled={!canSave} onClick={() => saveTaskRoutine(name)}>
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

/** The Browser bar's recorder slot for `tabId`. */
export function TaskRecorderControls({ tabId }: { tabId: string }) {
  const { t } = useI18n()
  const copy = t.composer.taskRecorder
  const state = useStore($taskRecorder)

  if (state.phase === 'armed') {
    return (
      <span className="flex shrink-0 items-center gap-0.5" data-slot="task-recorder">
        <button
          className={`${PILL} text-white transition-[filter] hover:brightness-110`}
          onClick={() => startTaskRecording(tabId)}
          style={{ background: RED }}
          title={copy.recordHint}
          type="button"
        >
          <span className="size-1.5 rounded-full bg-white" />
          {copy.record}
        </button>
        <button
          aria-label={copy.discard}
          className="grid size-6 place-items-center rounded-full text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground"
          onClick={cancelTaskRecording}
          type="button"
        >
          <Codicon name="close" size="0.75rem" />
        </button>
      </span>
    )
  }

  if (state.phase === 'recording' && state.tabId === tabId) {
    return <RecordingPill events={state.events} startedAt={state.startedAt} />
  }

  if (state.phase === 'review' && state.tabId === tabId) {
    return <ReviewDialog steps={state.steps} />
  }

  return null
}
