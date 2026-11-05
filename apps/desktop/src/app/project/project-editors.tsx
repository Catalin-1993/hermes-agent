/**
 * What the project's cards open: the Instructions editor and the list of files and notes (Knowledge). Both live as
 * files in the project folder (`project-notes`).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { selectDesktopPaths } from '@/lib/desktop-fs'
import { notify } from '@/store/notifications'

import { PROJECT } from './copy'
import { addKnowledgeFiles, removeKnowledgeFile } from './project-files'
import { loadProjectNotes, type ProjectNotes, saveProjectNotes } from './project-notes'
import { cleanBody, cleanTitle, type KnowledgeNote } from './project-notes-model'

const P = PROJECT.panel

/** The project's notes and how to save them; a save updates what every card shows. */
export function useProjectNotes(folder: null | string) {
  const qc = useQueryClient()
  const key = ['project-page', 'notes', folder]
  const { data } = useQuery({ enabled: Boolean(folder), queryFn: () => loadProjectNotes(folder!), queryKey: key })

  const save = async (next: ProjectNotes) => {
    await saveProjectNotes(folder!, next)
    qc.setQueryData(key, { ...next, instructions: next.instructions.trim() })
  }

  return { notes: data, save }
}

export function Instructions({
  notes,
  onSave
}: {
  notes: ProjectNotes
  onSave: (next: ProjectNotes) => Promise<void>
}) {
  const [text, setText] = useState(notes.instructions)
  const [state, setState] = useState<'idle' | 'saved' | 'saving'>('idle')
  const dirty = text.trim() !== notes.instructions.trim()

  // A reload of the project's file (another chat edited it) replaces what is shown, unless the user is mid-edit.
  useEffect(() => {
    setText(current => (current.trim() === notes.instructions.trim() ? current : notes.instructions))
  }, [notes.instructions])

  const save = async () => {
    setState('saving')

    try {
      await onSave({ ...notes, instructions: text })
      setState('saved')
    } catch (error) {
      notify({ kind: 'error', message: `${P.saveFailed}: ${error instanceof Error ? error.message : String(error)}` })
      setState('idle')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label={P.instructions}
        className="min-h-40 resize-y text-[0.8125rem]"
        onChange={event => {
          setText(event.target.value)
          setState('idle')
        }}
        placeholder={P.instructionsPlaceholder}
        value={text}
      />
      <div className="flex items-center gap-2">
        <Button disabled={!dirty || state === 'saving'} onClick={() => void save()} size="sm">
          {state === 'saving' ? P.saving : P.save}
        </Button>
        {state === 'saved' && !dirty && <span className="text-[0.75rem] text-(--ui-text-tertiary)">{P.saved}</span>}
      </div>
    </div>
  )
}

function NoteForm({ onAdd, onCancel }: { onAdd: (note: KnowledgeNote) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-(--ui-stroke-tertiary) p-3">
      <Input
        aria-label={P.noteTitle}
        autoFocus
        onChange={event => setTitle(event.target.value)}
        placeholder={P.noteTitle}
        value={title}
      />
      <Textarea
        aria-label={P.noteBody}
        className="min-h-24 text-[0.8125rem]"
        onChange={event => setBody(event.target.value)}
        placeholder={P.noteBody}
        value={body}
      />
      <div className="flex gap-2">
        <Button
          disabled={!cleanTitle(title) || !body.trim()}
          onClick={() => onAdd({ body: cleanBody(body), title: cleanTitle(title) })}
          size="sm"
        >
          {P.saveNote}
        </Button>
        <Button onClick={onCancel} size="sm" variant="ghost">
          {P.cancel}
        </Button>
      </div>
    </div>
  )
}

const REMOVE_BUTTON =
  'grid size-5 shrink-0 cursor-pointer place-items-center rounded text-(--ui-text-quaternary) opacity-0 transition-opacity hover:bg-(--chrome-action-hover) hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100'

function KnowledgeRow({
  children,
  icon,
  label,
  onRemove
}: {
  children?: ReactNode
  icon: string
  label: string
  onRemove: () => void
}) {
  return (
    <li className="group flex items-start gap-2 rounded-lg border border-(--ui-stroke-tertiary) px-3 py-2">
      <Codicon className="mt-0.5 text-(--ui-text-tertiary)" name={icon} size="0.85rem" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.8125rem] font-medium text-foreground">{label}</div>
        {children}
      </div>
      <button aria-label={P.remove(label)} className={REMOVE_BUTTON} onClick={onRemove} type="button">
        <Codicon name="close" size="0.7rem" />
      </button>
    </li>
  )
}

type SaveNotes = (next: ProjectNotes) => Promise<void>

/** Adding and removing the project's files: shared by the card's Upload menu and the list it opens. */
export function useKnowledge(folder: string, notes: ProjectNotes | undefined, onSave: SaveNotes) {
  const [progress, setProgress] = useState<null | { done: number; total: number }>(null)

  const write = async (next: Partial<ProjectNotes>) => {
    if (!notes) {
      return
    }

    try {
      await onSave({ ...notes, ...next })
    } catch (error) {
      notify({ kind: 'error', message: `${P.saveFailed}: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const addFiles = async () => {
    const picked = await selectDesktopPaths({ multiple: true, title: P.addFile })

    if (!picked.length || !notes) {
      return
    }

    setProgress({ done: 0, total: picked.length })

    try {
      const { added, failed } = await addKnowledgeFiles(folder, picked, notes.files, (done, total) =>
        setProgress({ done, total })
      )

      for (const { error, name } of failed) {
        notify({ kind: 'error', message: P.fileFailed(name, error) })
      }

      if (added.length) {
        await write({ files: [...notes.files, ...added].sort((a, b) => a.localeCompare(b)) })
      }
    } finally {
      setProgress(null)
    }
  }

  const removeFile = async (name: string) => {
    try {
      await removeKnowledgeFile(folder, name)
      await write({ files: (notes?.files ?? []).filter(file => file !== name) })
    } catch (error) {
      notify({ kind: 'error', message: P.fileFailed(name, error instanceof Error ? error.message : String(error)) })
    }
  }

  return { addFiles, progress, removeFile, write }
}

/** The project's files and notes, each with a way to take it off; `adding` opens straight on a new note. */
export function Knowledge({
  folder,
  notes,
  onSave,
  startAdding = false
}: {
  folder: string
  notes: ProjectNotes
  onSave: SaveNotes
  startAdding?: boolean
}) {
  const [adding, setAdding] = useState(startAdding)
  const { addFiles, progress, removeFile, write } = useKnowledge(folder, notes, onSave)
  const empty = notes.knowledge.length === 0 && notes.files.length === 0

  return (
    <div className="flex flex-col gap-2">
      {empty && !adding && <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{P.noKnowledge}</p>}
      <ul className="flex flex-col gap-1.5">
        {notes.files.map(name => (
          <KnowledgeRow icon="file" key={`file:${name}`} label={name} onRemove={() => void removeFile(name)} />
        ))}
        {notes.knowledge.map((note, index) => (
          <KnowledgeRow
            icon="book"
            key={`${note.title}:${index}`}
            label={note.title}
            onRemove={() => void write({ knowledge: notes.knowledge.filter((_, at) => at !== index) })}
          >
            <div className="line-clamp-2 text-[0.75rem] text-(--ui-text-tertiary)">{note.body}</div>
          </KnowledgeRow>
        ))}
      </ul>
      {progress && (
        <p aria-live="polite" className="text-[0.75rem] text-(--ui-text-tertiary)">
          {P.adding(Math.min(progress.done + 1, progress.total), progress.total)}
        </p>
      )}
      {adding ? (
        <NoteForm
          onAdd={note => {
            setAdding(false)
            void write({ knowledge: [...notes.knowledge, note] })
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="flex gap-2">
          <Button disabled={Boolean(progress)} onClick={() => void addFiles()} size="sm" variant="outline">
            <Codicon name="add" size="0.8rem" />
            {P.addFile}
          </Button>
          <Button onClick={() => setAdding(true)} size="sm" variant="ghost">
            {P.addNote}
          </Button>
        </div>
      )}
    </div>
  )
}
