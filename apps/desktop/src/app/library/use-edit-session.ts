import { useCallback, useEffect, useRef, useState } from 'react'

import { useI18n } from '@/i18n'
import { notifyError } from '@/store/notifications'

import { bumpLibraryRevision, type LibraryItem, writeLibraryText } from './data'
import { applyEdits, type PageEdit } from './html-edit'

const SAVE_DELAY_MS = 700

/** One sitting of editing an HTML file as it is seen: what the frame reports is gathered and, a moment after
 *  the last keystroke, written into the file's markup (html-edit.ts). `base` is the file as it was when the
 *  sitting began; it must not change during it. */
export function useEditSession(fileId: string, base: string) {
  const { t } = useI18n()
  const edits = useRef<Record<string, string>>({})
  const pending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef<LibraryItem | null>(null)
  const [state, setState] = useState<'idle' | 'saved' | 'saving'>('idle')

  const flush = useCallback(async () => {
    clearTimeout(timer.current)

    if (!pending.current) {
      return
    }

    pending.current = false
    setState('saving')

    try {
      latest.current = await writeLibraryText(fileId, applyEdits(base, edits.current))
      setState('saved')
      bumpLibraryRevision()
    } catch (error) {
      setState('idle')
      notifyError(error, t.library.errors.save)
    }
  }, [base, fileId, t.library.errors.save])

  const record = useCallback(
    (edit: PageEdit) => {
      edits.current[edit.id] = edit.html
      pending.current = true
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [flush]
  )

  // A new sitting starts clean: what an earlier one typed is already in `base`.
  const reset = useCallback(() => {
    edits.current = {}
    pending.current = false
    latest.current = null
    setState('idle')
  }, [])

  // Leaving with a change still waiting writes it.
  useEffect(() => () => void flush(), [flush])

  return {
    flush,
    /** The file as it reads with everything typed so far. */
    current: () => applyEdits(base, edits.current),
    /** The last version written in this sitting, if any. */
    saved: () => latest.current,
    record,
    reset,
    state
  }
}
