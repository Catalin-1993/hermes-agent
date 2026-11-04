/**
 * The right-hand column of a project page: what belongs to this project alone — its Instructions, the Connectors
 * the agent can use, and its Knowledge notes. Instructions and knowledge live as files in the project folder
 * (`project-notes`); connectors are the workspace's own, shown here and managed in Capabilities.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { listMcpServers } from '@/api/mcp'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { selectDesktopPaths } from '@/lib/desktop-fs'
import { persistBoolean, storedBoolean } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { notify } from '@/store/notifications'

import { CAPABILITIES_ROUTE } from '../routes'

import { PROJECT } from './copy'
import { addKnowledgeFiles, removeKnowledgeFile } from './project-files'
import { loadProjectNotes, type ProjectNotes, saveProjectNotes } from './project-notes'
import { cleanBody, cleanTitle, type KnowledgeNote } from './project-notes-model'

const P = PROJECT.panel

/** A titled block that folds to just its title; whether it is open is remembered per section. */
function Section({ children, hint, id, title }: { children: ReactNode; hint: string; id: string; title: string }) {
  const key = `hermes.desktop.workspace.section.${id}`
  const [open, setOpen] = useState(() => storedBoolean(key, false))

  const toggle = () => {
    persistBoolean(key, !open)
    setOpen(!open)
  }

  return (
    <section
      className="flex flex-col border-b border-(--ui-stroke-tertiary) last:border-b-0"
      data-workspace-section={id}
    >
      <button
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-(--chrome-action-hover)"
        onClick={toggle}
        type="button"
      >
        <DisclosureCaret className="text-(--ui-text-tertiary)" open={open} />
        <h3 className="flex-1 text-[0.8125rem] font-semibold text-foreground">{title}</h3>
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 px-4 pb-4">
          <p className="text-[0.75rem] leading-snug text-(--ui-text-tertiary)">{hint}</p>
          {children}
        </div>
      )}
    </section>
  )
}

function Instructions({ notes, onSave }: { notes: ProjectNotes; onSave: (next: ProjectNotes) => Promise<void> }) {
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

function Connectors() {
  const navigate = useNavigate()
  const { data } = useQuery({ queryFn: listMcpServers, queryKey: ['project-page', 'connectors'], staleTime: 30_000 })
  const servers = data?.servers ?? []

  return (
    <div className="flex flex-col gap-2">
      {servers.length === 0 ? (
        <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{P.noConnectors}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-(--ui-stroke-tertiary) rounded-lg border border-(--ui-stroke-tertiary)">
          {servers.map(server => (
            <li className="flex items-center gap-2 px-3 py-2 text-[0.8125rem]" key={server.name}>
              <Codicon className="text-(--ui-text-tertiary)" name="plug" size="0.85rem" />
              <span className="min-w-0 flex-1 truncate text-foreground">{server.name}</span>
              <span
                className={cn('text-[0.6875rem]', server.enabled ? 'text-[#34d399]' : 'text-(--ui-text-quaternary)')}
              >
                {server.enabled ? P.on : P.off}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button className="self-start" onClick={() => navigate(CAPABILITIES_ROUTE)} size="sm" variant="ghost">
        {P.manageConnectors}
      </Button>
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

function Knowledge({
  folder,
  notes,
  onSave
}: {
  folder: string
  notes: ProjectNotes
  onSave: (next: ProjectNotes) => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [progress, setProgress] = useState<null | { done: number; total: number }>(null)

  const write = async (next: Partial<ProjectNotes>) => {
    try {
      await onSave({ ...notes, ...next })
    } catch (error) {
      notify({ kind: 'error', message: `${P.saveFailed}: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const addFiles = async () => {
    const picked = await selectDesktopPaths({ multiple: true, title: P.addFile })

    if (!picked.length) {
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
      await write({ files: notes.files.filter(file => file !== name) })
    } catch (error) {
      notify({ kind: 'error', message: P.fileFailed(name, error instanceof Error ? error.message : String(error)) })
    }
  }

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

/** The sections themselves, for the right sidebar's Workspace view (`workspace-pane`). */
export function WorkspaceSections({ folder }: { folder: null | string }) {
  const qc = useQueryClient()
  const key = ['project-page', 'notes', folder]
  const { data } = useQuery({ enabled: Boolean(folder), queryFn: () => loadProjectNotes(folder!), queryKey: key })

  const save = async (next: ProjectNotes) => {
    await saveProjectNotes(folder!, next)
    qc.setQueryData(key, { ...next, instructions: next.instructions.trim() })
  }

  return (
    <div data-project-panel="">
      <Section hint={P.instructionsHint} id="instructions" title={P.instructions}>
        {!folder ? (
          <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{PROJECT.noFolder}</p>
        ) : data ? (
          <>
            <Instructions notes={data} onSave={save} />
            <p className="text-[0.6875rem] text-(--ui-text-quaternary)">{P.savedAs('.hermes.md')}</p>
          </>
        ) : null}
      </Section>
      <Section hint={P.connectorsHint} id="connectors" title={P.connectors}>
        <Connectors />
      </Section>
      <Section hint={P.knowledgeHint} id="knowledge" title={P.knowledge}>
        {!folder ? (
          <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{PROJECT.noFolder}</p>
        ) : data ? (
          <Knowledge folder={folder} notes={data} onSave={save} />
        ) : null}
      </Section>
    </div>
  )
}
