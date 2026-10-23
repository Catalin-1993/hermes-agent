/**
 * The agent file's Rhythm tab: whether the agent checks in on its own, how often, in which hours and
 * days, when the next check-in is, and a "check in now" button. A check-in is an ordinary card for the
 * agent (`kanban_db_rhythm`), so its pause and monthly budget still apply.
 */

import {
  Button,
  Codicon,
  host,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  useQueryClient,
  useValue
} from '@hermes/plugin-sdk'

import { $boardSlug, boardKeyPrefix, checkInNow, rhythmKey, saveRhythm, useKanbanScope } from './api'
import { useRhythms } from './team-queries'
import type { AgentRhythm } from './types'
import { ago, errText, FIELD_LABEL, type KanbanText } from './ui'

export const CADENCES = [60, 120, 240, 480, 720, 1440] as const

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

const OFF: Omit<AgentRhythm, 'profile'> = {
  enabled: false,
  end_hour: 20,
  every_minutes: 240,
  last_fired_at: null,
  last_task_id: null,
  next_at: null,
  start_hour: 8,
  weekdays_only: false
}

/** "4 h", or the word for a day. */
export const cadenceLabel = (k: KanbanText, minutes: number) => (minutes >= 1440 ? k.rhythm.daily : `${minutes / 60} h`)

/** Check-ins a day at most, given the interval and the active hours. */
export function perDay(rhythm: Pick<AgentRhythm, 'end_hour' | 'every_minutes' | 'start_hour'>): number {
  const span = rhythm.start_hour === rhythm.end_hour ? 24 : (rhythm.end_hour - rhythm.start_hour + 24) % 24

  return Math.max(1, Math.floor((span * 60) / rhythm.every_minutes))
}

const when = (ts: number) => new Date(ts * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function HourSelect({ label, onChange, value }: { label: string; onChange: (hour: number) => void; value: number }) {
  return (
    <Select onValueChange={next => onChange(Number(next))} value={String(value)}>
      <SelectTrigger aria-label={label} className="h-7 w-24 text-[0.8125rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {HOURS.map(hour => (
          <SelectItem key={hour} value={String(hour)}>
            {`${String(hour).padStart(2, '0')}:00`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function RhythmTab({ k, name, onOpen }: { k: KanbanText; name: string; onOpen: (id: string) => void }) {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const { data } = useRhythms()
  const rhythm = { ...OFF, profile: name, ...data?.rhythms[name] }

  const write = async (patch: Partial<AgentRhythm>, done = k.rhythm.saved) => {
    try {
      const saved = await saveRhythm(name, patch)
      qc.setQueryData(rhythmKey(scope, slug), { rhythms: { ...data?.rhythms, [name]: saved } })
      host.notify({ kind: 'success', message: done })
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })
    }
  }

  const checkIn = async () => {
    try {
      await checkInNow(name)
      host.notify({ kind: 'success', message: k.rhythm.checkedIn })
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })
    }

    void qc.invalidateQueries({ queryKey: rhythmKey(scope, slug) })
    void qc.invalidateQueries({ queryKey: boardKeyPrefix(scope) })
  }

  const allDay = rhythm.start_hour === rhythm.end_hour

  return (
    <div className="flex flex-col gap-4" data-rhythm={name}>
      <p className="text-[0.75rem] text-(--ui-text-tertiary)">{k.rhythm.intro}</p>
      <label className="flex items-center gap-2.5 text-[0.875rem] font-medium text-foreground">
        <Switch checked={rhythm.enabled} onCheckedChange={enabled => void write({ enabled })} />
        {k.rhythm.enabled}
      </label>
      <section className="flex flex-col gap-1.5">
        <div className={FIELD_LABEL}>{k.rhythm.every}</div>
        <SegmentedControl<string>
          onChange={value => void write({ every_minutes: Number(value) })}
          options={CADENCES.map(minutes => ({ id: String(minutes), label: cadenceLabel(k, minutes) }))}
          value={String(rhythm.every_minutes)}
        />
      </section>
      <section className="flex flex-col gap-1.5">
        <div className={FIELD_LABEL}>{k.rhythm.hours}</div>
        <div className="flex flex-wrap items-center gap-2 text-[0.75rem] text-(--ui-text-tertiary)">
          <label className="inline-flex items-center gap-1.5">
            <Switch
              checked={allDay}
              onCheckedChange={on => void write(on ? { end_hour: 0, start_hour: 0 } : { end_hour: 20, start_hour: 8 })}
              size="xs"
            />
            {k.rhythm.allDay}
          </label>
          {!allDay && (
            <>
              <HourSelect label={k.rhythm.hours} onChange={start_hour => void write({ start_hour })} value={rhythm.start_hour} />
              {k.rhythm.to}
              <HourSelect label={k.rhythm.to} onChange={end_hour => void write({ end_hour })} value={rhythm.end_hour} />
            </>
          )}
          <label className="ml-2 inline-flex items-center gap-1.5">
            <Switch checked={rhythm.weekdays_only} onCheckedChange={weekdays_only => void write({ weekdays_only })} size="xs" />
            {k.rhythm.weekdays}
          </label>
        </div>
      </section>
      <section className="flex flex-col gap-1 rounded-lg bg-(--ui-bg-quinary) p-3 text-[0.75rem]">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <Codicon name={rhythm.enabled ? 'pulse' : 'circle-slash'} size="0.85rem" />
          {rhythm.enabled && rhythm.next_at ? k.rhythm.next(when(rhythm.next_at)) : k.rhythm.off}
        </span>
        {rhythm.enabled && <span className="text-(--ui-text-tertiary)">{k.rhythm.perDay(perDay(rhythm))}</span>}
        {rhythm.last_fired_at && rhythm.last_task_id && (
          <button
            className="w-fit cursor-pointer text-left text-(--ui-text-tertiary) underline-offset-2 hover:underline"
            onClick={() => onOpen(rhythm.last_task_id!)}
            type="button"
          >
            {k.rhythm.last(ago(rhythm.last_fired_at) ?? '')}
          </button>
        )}
      </section>
      <div>
        <Button onClick={() => void checkIn()} size="sm" variant="outline">
          <Codicon name="bell" size="0.8rem" />
          {k.rhythm.checkIn}
        </Button>
      </div>
    </div>
  )
}
