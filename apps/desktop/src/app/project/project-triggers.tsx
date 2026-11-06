/** Trigger task: a scheduled task (a cron job) that runs in the project's folder. The project's own are the jobs whose
 *  working folder is the project's; the full list and its controls stay on the Scheduled page. */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { createCronJob, getCronJobs } from '@/api/cron'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/store/notifications'

import { PROJECT } from './copy'

const C = PROJECT.cards

const SCHEDULES = { daily: '0 9 * * *', hourly: '0 * * * *', weekly: '0 9 * * 1' } as const

type When = keyof typeof SCHEDULES

const WHEN_OPTIONS: readonly { id: When; label: string }[] = [
  { id: 'hourly', label: C.triggerHourly },
  { id: 'daily', label: C.triggerDaily },
  { id: 'weekly', label: C.triggerWeekly }
]

const samePath = (a: null | string | undefined, b: string) => (a ?? '').replace(/\/+$/, '') === b.replace(/\/+$/, '')
const queryKey = (folder: string) => ['project-page', 'triggers', folder]

export function useProjectTriggers(folder: string) {
  const { data } = useQuery({ queryFn: () => getCronJobs(), queryKey: queryKey(folder), staleTime: 30_000 })

  return (data ?? []).filter(job => samePath(job.workdir, folder))
}

export function TriggerDialog({ folder, onClose, open }: { folder: string; onClose: () => void; open: boolean }) {
  const qc = useQueryClient()
  const [prompt, setPrompt] = useState('')
  const [when, setWhen] = useState<When>('daily')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    setSaving(true)

    try {
      const text = prompt.trim()

      await createCronJob({
        name: text.split('\n')[0].slice(0, 60),
        prompt: text,
        schedule: SCHEDULES[when],
        workdir: folder
      })
      await qc.invalidateQueries({ queryKey: queryKey(folder) })
      setPrompt('')
      onClose()
    } catch (error) {
      notify({
        kind: 'error',
        message: `${C.triggerFailed}: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog onOpenChange={next => !next && onClose()} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{C.triggerDialog}</DialogTitle>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium text-foreground">
          {C.triggerPrompt}
          <Textarea
            autoFocus
            className="min-h-28 text-[0.8125rem] font-normal"
            onChange={event => setPrompt(event.target.value)}
            placeholder={C.triggerPlaceholder}
            value={prompt}
          />
        </label>
        <div className="flex flex-col gap-1.5 text-[0.8125rem] font-medium text-foreground">
          {C.triggerWhen}
          <SegmentedControl onChange={setWhen} options={WHEN_OPTIONS} sizing="content" value={when} />
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} size="sm" variant="ghost">
            {PROJECT.panel.cancel}
          </Button>
          <Button disabled={!prompt.trim() || saving} onClick={() => void create()} size="sm">
            {C.triggerCreate}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
