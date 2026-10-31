/**
 * The body of a decision, written for someone seeing it for the first time: what the agent is asking, why it
 * needs you, its report (long ones fold, with a button to read them whole), and the files it attached (a PDF
 * downloads with one press). What each button does sits beside the buttons, in the Inbox's actions.
 */

import { Button, Codicon, useQuery, useValue } from '@hermes/plugin-sdk'
import { type ReactNode, useState } from 'react'

import { $boardSlug, fetchTask, pluginOs, taskKey, useKanbanScope } from './api'
import { DECISION } from './decision-copy'
import { parseDecision } from './decision-model'
import { INBOX } from './inbox-copy'
import type { InboxItem } from './inbox-model'
import type { KanbanAttachment } from './types'

/** The kinds that are a task waiting on the owner's word; the rest keep their one-line body. */
export const DECISION_KINDS = new Set(['blocked', 'question', 'review'])

/** A labelled part of the decision: the label on the left on wide screens, above on narrow ones. */
function Block({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
      <h4 className="pt-0.5 text-[0.6875rem] font-semibold tracking-[0.06em] text-(--ui-text-tertiary) uppercase">
        {title}
      </h4>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

const BODY = 'text-[0.875rem] leading-relaxed whitespace-pre-line text-(--ui-text-secondary)'

const sizeLabel = (bytes?: null | number) =>
  bytes
    ? bytes >= 1_048_576
      ? `${(bytes / 1_048_576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`
    : ''

function FileRow({
  attachment,
  onDownload
}: {
  attachment: KanbanAttachment
  onDownload: (path: string, name: string) => Promise<void>
}) {
  const path = attachment.stored_path?.trim()
  const pdf = /\.pdf$/i.test(attachment.filename)
  const reveal = pluginOs()?.revealPath

  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-(--ui-stroke-tertiary) px-3 py-2.5">
      <Codicon className="text-(--ui-text-tertiary)" name={pdf ? 'file-pdf' : 'file'} size="1.2rem" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-medium text-foreground">{attachment.filename}</span>
        <span className="text-[0.75rem] text-(--ui-text-tertiary)">
          {[pdf ? DECISION.file.pdf : '', sizeLabel(attachment.size)].filter(Boolean).join(' · ')}
        </span>
      </span>
      <Button disabled={!path} onClick={() => void onDownload(path!, attachment.filename)} size="sm" variant="outline">
        <Codicon name="cloud-download" size="0.8rem" />
        {DECISION.file.download}
      </Button>
      {reveal && path && (
        <Button onClick={() => void reveal(path)} size="sm" variant="ghost">
          <Codicon name="folder-opened" size="0.8rem" />
          {DECISION.file.show}
        </Button>
      )}
    </li>
  )
}

/** The files the agent attached to this card; nothing at all when there are none. */
export function DecisionFiles({ taskId }: { taskId: string }) {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  const { data } = useQuery({
    queryFn: () => fetchTask(taskId),
    queryKey: taskKey(scope, slug, taskId),
    refetchInterval: 30_000
  })

  const files = data?.attachments ?? []

  if (!files.length || !data) {
    return null
  }

  return (
    <Block title={INBOX.block.files}>
      <ul className="flex flex-col gap-1.5">
        {files.map(file => (
          <FileRow attachment={file} key={file.id} onDownload={data.downloadAttachment} />
        ))}
      </ul>
    </Block>
  )
}

/** A long report folds to a few lines with a button to read it whole; a short one is just shown. */
const LONG_REPORT = 320

function Report({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > LONG_REPORT || text.split('\n').length > 5

  return (
    <Block title={INBOX.block.report}>
      <div className="rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3">
        <p className={`${BODY} ${long && !open ? 'line-clamp-5' : ''}`}>{text}</p>
        {long && (
          <button
            className="mt-2 cursor-pointer text-[0.8125rem] font-medium text-foreground underline-offset-2 hover:underline"
            onClick={() => setOpen(value => !value)}
            type="button"
          >
            {open ? INBOX.hideReport : INBOX.readReport}
          </button>
        )}
      </div>
    </Block>
  )
}

export function DecisionDetails({ item }: { item: InboxItem }) {
  const task = item.task!
  const kind = item.kind as 'blocked' | 'question' | 'review'
  const read = parseDecision(task.latest_summary || task.body)
  // A question the agent wrote without labels is the ask itself, not a report.
  const parsed = kind === 'question' && !read.ask ? { ...read, ask: read.report, report: '' } : read
  const why = parsed.why || (item.heldBy ? DECISION.noWhy.heldBy(item.heldBy) : '')
  const fallbackWhy = kind === 'blocked' ? DECISION.noWhy.blocked(task.block_kind) : DECISION.noWhy[kind]

  return (
    <div
      className="flex flex-col gap-4 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) px-4 py-4"
      data-decision-details=""
    >
      <Block title={INBOX.block.ask}>
        <p className={BODY}>{parsed.ask || DECISION.noAsk[kind]}</p>
      </Block>
      <Block title={INBOX.block.why}>
        <p className={BODY}>{why || fallbackWhy}</p>
      </Block>
      {parsed.report && <Report text={parsed.report} />}
      <DecisionFiles taskId={task.id} />
    </div>
  )
}
