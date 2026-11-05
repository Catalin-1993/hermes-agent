/**
 * The cards at the right of a project: Instructions and Connectors, Files & sources and Skills, Trigger task, Website
 * and Team. Each says in a line what it is for and has one way to add to it; the title opens what it already holds.
 */

import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { useNavigate } from 'react-router'

import { listMcpServers } from '@/api/mcp'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { CAPABILITIES_ROUTE, CRON_ROUTE } from '../routes'

import { PROJECT } from './copy'
import { Instructions, Knowledge, useKnowledge, useProjectNotes } from './project-editors'
import { TriggerDialog, useProjectTriggers } from './project-triggers'
import { TeamSection } from './team-section'

const C = PROJECT.cards
const P = PROJECT.panel

export const CARD =
  'flex flex-col divide-y divide-(--ui-stroke-tertiary) rounded-xl border border-(--ui-stroke-tertiary)'

const Block = ({ children }: { children: ReactNode }) => (
  <section className="relative flex flex-col items-start gap-1.5 overflow-hidden px-4 py-3.5">{children}</section>
)

function BlockTitle({ children, onClick }: { children: string; onClick?: () => void }) {
  return onClick ? (
    <button
      className="-mx-1 flex cursor-pointer items-center gap-1 rounded px-1 text-[0.875rem] font-medium text-foreground hover:bg-(--chrome-action-hover)"
      onClick={onClick}
      type="button"
    >
      {children}
      <Codicon className="text-(--ui-text-tertiary)" name="chevron-right" size="0.75rem" />
    </button>
  ) : (
    <h3 className="text-[0.875rem] font-medium text-foreground">{children}</h3>
  )
}

const Hint = ({ children }: { children: ReactNode }) => (
  <p className="max-w-[15.5rem] text-[0.75rem] leading-snug text-(--ui-text-tertiary)">{children}</p>
)

function AddButton({ label = C.add, onClick }: { label?: string; onClick: () => void }) {
  return (
    <Button className="mt-1" onClick={onClick} size="sm" variant="outline">
      <Codicon name="add" size="0.8rem" />
      {label}
    </Button>
  )
}

/** The small stacked tiles beside a card that has room for them: they only say what kind of thing it holds. */
function Art({ icon }: { icon: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute right-3 bottom-3 size-12">
      <span className="absolute top-0 left-0 size-9 -rotate-6 rounded-lg border border-(--ui-stroke-tertiary) bg-(--chrome-action-hover)" />
      <span className="absolute right-0 bottom-0 grid size-9 rotate-6 place-items-center rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-chat-surface-background) text-(--ui-text-quaternary)">
        <Codicon name={icon} size="1rem" />
      </span>
    </span>
  )
}

function InstructionsBlock({ folder }: { folder: null | string }) {
  const { notes, save } = useProjectNotes(folder)
  const [open, setOpen] = useState(false)
  const text = notes?.instructions.trim()

  return (
    <Block>
      <BlockTitle onClick={() => setOpen(true)}>{P.instructions}</BlockTitle>
      {text ? (
        <p className="line-clamp-2 text-[0.75rem] leading-snug text-(--ui-text-secondary)">{text}</p>
      ) : (
        <Hint>{C.instructionsHint}</Hint>
      )}
      {text ? (
        <Button className="mt-1" onClick={() => setOpen(true)} size="sm" variant="outline">
          {C.edit}
        </Button>
      ) : (
        <AddButton onClick={() => setOpen(true)} />
      )}
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{P.instructions}</DialogTitle>
          </DialogHeader>
          {!folder ? (
            <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{PROJECT.noFolder}</p>
          ) : notes ? (
            <>
              <p className="text-[0.75rem] leading-snug text-(--ui-text-tertiary)">{P.instructionsHint}</p>
              <Instructions notes={notes} onSave={save} />
              <p className="text-[0.6875rem] text-(--ui-text-quaternary)">{P.savedAs('.hermes.md')}</p>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Block>
  )
}

function ConnectorsRow() {
  const navigate = useNavigate()
  const { data } = useQuery({ queryFn: listMcpServers, queryKey: ['project-page', 'connectors'], staleTime: 30_000 })
  const on = (data?.servers ?? []).filter(server => server.enabled).length
  const manage = () => navigate(`${CAPABILITIES_ROUTE}?tab=connectors`)

  return (
    <div className="px-2 py-2">
      <div className="flex items-center gap-2 rounded-lg bg-(--chrome-action-hover) py-1 pr-1 pl-2.5">
        <Codicon className="text-(--ui-text-secondary)" name="plug" size="0.875rem" />
        <button
          className="min-w-0 flex-1 cursor-pointer truncate text-left text-[0.8125rem] font-medium text-foreground"
          onClick={manage}
          type="button"
        >
          {P.connectors}
          {on > 0 && <span className="ml-1.5 font-normal text-(--ui-text-tertiary)">{on}</span>}
        </button>
        <Button onClick={manage} size="sm" variant="ghost">
          <Codicon name="add" size="0.8rem" />
          {C.add}
        </Button>
      </div>
    </div>
  )
}

function FilesBlock({ folder, onDraft }: { folder: string; onDraft: (draft: string) => void }) {
  const { notes, save } = useProjectNotes(folder)
  const { addFiles, progress } = useKnowledge(folder, notes, save)
  const [listing, setListing] = useState<null | { adding: boolean }>(null)
  const held = notes ? C.filesCount(notes.files.length, notes.knowledge.length) : ''

  return (
    <Block>
      <BlockTitle onClick={() => setListing({ adding: false })}>{C.filesTitle}</BlockTitle>
      <Hint>{C.filesHint}</Hint>
      {held && <p className="text-[0.75rem] text-(--ui-text-secondary)">{held}</p>}
      {progress && (
        <p aria-live="polite" className="text-[0.75rem] text-(--ui-text-tertiary)">
          {P.adding(Math.min(progress.done + 1, progress.total), progress.total)}
        </p>
      )}
      <div className="mt-1 grid w-full grid-cols-2 gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={Boolean(progress)} size="sm" variant="outline">
              <Codicon name="cloud-upload" size="0.8rem" />
              {C.upload}
              <Codicon className="text-(--ui-text-tertiary)" name="chevron-down" size="0.7rem" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-36">
            <DropdownMenuItem onSelect={() => void addFiles()}>
              <Codicon name="file" size="0.875rem" />
              {C.uploadFiles}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setListing({ adding: true })}>
              <Codicon name="book" size="0.875rem" />
              {C.uploadNote}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={() => onDraft(C.searchWebDraft)} size="sm" variant="outline">
          <Codicon name="search" size="0.8rem" />
          {C.searchWeb}
        </Button>
      </div>
      <Dialog onOpenChange={open => !open && setListing(null)} open={listing !== null}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{C.filesTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-[0.75rem] leading-snug text-(--ui-text-tertiary)">{P.knowledgeHint}</p>
          {notes && <Knowledge folder={folder} notes={notes} onSave={save} startAdding={listing?.adding} />}
        </DialogContent>
      </Dialog>
    </Block>
  )
}

function SkillsBlock({ onDraft }: { onDraft: (draft: string) => void }) {
  const navigate = useNavigate()
  const browse = () => navigate(`${CAPABILITIES_ROUTE}?tab=skills`)

  return (
    <Block>
      <BlockTitle onClick={browse}>{C.skillsTitle}</BlockTitle>
      <Hint>{C.skillsHint}</Hint>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="mt-1" size="sm" variant="outline">
            <Codicon name="add" size="0.8rem" />
            {C.add}
            <Codicon className="text-(--ui-text-tertiary)" name="chevron-down" size="0.7rem" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuItem onSelect={browse}>
            <Codicon name="extensions" size="0.875rem" />
            {C.browseSkills}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDraft(C.createSkillDraft)}>
            <Codicon name="edit" size="0.875rem" />
            {C.createSkill}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Art icon="extensions" />
    </Block>
  )
}

function TriggerBlock({ folder }: { folder: string }) {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const jobs = useProjectTriggers(folder)

  return (
    <Block>
      <BlockTitle onClick={() => navigate(CRON_ROUTE)}>{C.triggerTitle}</BlockTitle>
      <Hint>{C.triggerHint}</Hint>
      {jobs.length > 0 && (
        <ul className="mt-1 flex w-full flex-col gap-1">
          {jobs.map(job => (
            <li className="flex items-center gap-2 text-[0.75rem]" key={job.id}>
              <Codicon className="shrink-0 text-(--ui-text-tertiary)" name="clock" size="0.75rem" />
              <span className="min-w-0 flex-1 truncate text-foreground">{job.name || job.prompt}</span>
              <span className="shrink-0 text-(--ui-text-tertiary)">{job.schedule_display}</span>
            </li>
          ))}
        </ul>
      )}
      <AddButton onClick={() => setCreating(true)} />
      <TriggerDialog folder={folder} onClose={() => setCreating(false)} open={creating} />
    </Block>
  )
}

/** All the cards. `onDraft` puts a started request in the composer, for the "with Brain" actions. */
export function ProjectCards({ folder, onDraft }: { folder: null | string; onDraft: (draft: string) => void }) {
  return (
    <div className="flex flex-col gap-3" data-project-panel="">
      <div className={CARD}>
        <InstructionsBlock folder={folder} />
        <ConnectorsRow />
      </div>
      {folder ? (
        <>
          <div className={CARD}>
            <FilesBlock folder={folder} onDraft={onDraft} />
            <SkillsBlock onDraft={onDraft} />
          </div>
          <div className={CARD}>
            <TriggerBlock folder={folder} />
          </div>
          <div className={CARD}>
            <Block>
              <BlockTitle>{C.websiteTitle}</BlockTitle>
              <Hint>{C.websiteHint}</Hint>
              <AddButton onClick={() => onDraft(C.websiteDraft)} />
              <Art icon="browser" />
            </Block>
          </div>
        </>
      ) : (
        <p className="px-1 text-[0.8125rem] text-(--ui-text-tertiary)">{PROJECT.noFolder}</p>
      )}
      <div className={CARD}>
        <Block>
          <BlockTitle>{C.teamTitle}</BlockTitle>
          <Hint>{C.teamHint}</Hint>
          <div className="mt-1 w-full">
            <TeamSection folder={folder} />
          </div>
        </Block>
      </div>
    </div>
  )
}
