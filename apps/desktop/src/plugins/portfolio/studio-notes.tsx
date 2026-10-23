/** The owner's notes on a symbol's chart: newest first, each pinned to a bar and price when it was put on
 *  the chart, with a composer that opens on a chart click (the note tool) or from here. */

import { Button, Codicon, Textarea } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { COPY } from './copy'
import { quotePrice } from './format'
import type { ChartNote, ChartPoint } from './studio-model'

const day = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })

export function NotesPanel({
  draftAt,
  notes,
  onAdd,
  onCancel,
  onRemove
}: {
  /** Where the note tool was clicked: the composer opens pinned there. */
  draftAt: ChartPoint | null
  notes: ChartNote[]
  onAdd: (text: string, at: ChartPoint | null) => void
  onCancel: () => void
  onRemove: (id: string) => void
}) {
  const copy = COPY.studio
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState('')
  const open = writing || draftAt !== null

  const close = () => {
    setWriting(false)
    setText('')
    onCancel()
  }

  return (
    <section className="flex flex-col gap-2" data-portfolio-studio-notes="">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[0.8125rem] font-semibold text-(--ui-text-primary)">{copy.notes}</div>
          <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.notesHint}</div>
        </div>
        {!open && (
          <Button onClick={() => setWriting(true)} size="sm" variant="ghost">
            <Codicon className="mr-1" name="add" size="0.8rem" />
            {copy.newNote}
          </Button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-xl bg-(--card-well) p-2.5">
          {draftAt && (
            <span className="text-[0.6875rem] text-(--ui-text-tertiary)">
              {copy.noteAt(quotePrice(draftAt.price), day.format(new Date(draftAt.time * 1000)))}
            </span>
          )}
          <Textarea autoFocus className="min-h-16 text-[0.8125rem]" maxLength={2000} onChange={event => setText(event.target.value)} placeholder={copy.notePlaceholder} value={text} />
          <div className="flex justify-end gap-1.5">
            <Button onClick={close} size="sm" variant="ghost">
              {copy.cancel}
            </Button>
            <Button
              disabled={!text.trim()}
              onClick={() => {
                onAdd(text.trim(), draftAt)
                close()
              }}
              size="sm"
            >
              {copy.addNote}
            </Button>
          </div>
        </div>
      )}
      {notes.length ? (
        <ul className="flex flex-col gap-1.5">
          {[...notes]
            .sort((a, b) => b.created - a.created)
            .map(note => (
              <li className="group flex items-start gap-2 rounded-lg px-1 py-1" key={note.id}>
                <Codicon className="mt-0.5 text-(--ui-yellow)" name="note" size="0.8rem" />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] whitespace-pre-line text-(--ui-text-primary)">{note.text}</p>
                  <p className="text-[0.6875rem] text-(--ui-text-tertiary)">
                    {day.format(new Date(note.created * 1000))}
                    {note.at ? ` · ${quotePrice(note.at.price)}` : ''}
                  </p>
                </div>
                <Button aria-label={copy.remove} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => onRemove(note.id)} size="icon-xs" variant="ghost">
                  <Codicon name="close" size="0.75rem" />
                </Button>
              </li>
            ))}
        </ul>
      ) : (
        !open && <p className="text-[0.75rem] text-(--ui-text-tertiary)">{copy.noNotes}</p>
      )}
    </section>
  )
}
