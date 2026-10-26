/**
 * The body of a decision, written so it can be answered without opening anything else: what the agent asks,
 * why it needs you, its report (long ones scroll, none cut off), the files it attached (a PDF downloads with
 * one press), and what each button will do. The agent's own wording comes from the labels it was asked to use;
 * the effect lines come from the app, so they are true whatever the agent wrote.
 */

import { Button, Codicon, useQuery, useValue } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'

import { $boardSlug, fetchTask, pluginOs, taskKey, useKanbanScope } from './api'
import { DECISION } from './decision-copy'
import { parseDecision } from './decision-model'
import type { InboxItem } from './inbox-model'
import type { KanbanAttachment } from './types'

/** The kinds that are a task waiting on the owner's word; the rest keep their one-line body. */
export const DECISION_KINDS = new Set(['blocked', 'question', 'review'])

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.6875rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

const BODY = 'text-[0.8125rem] leading-relaxed whitespace-pre-line text-(--ui-text-secondary)'

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
    <li className="flex items-center gap-2.5 rounded-lg border border-(--ui-stroke-tertiary) px-2.5 py-2">
      <Codicon className="text-(--ui-text-tertiary)" name={pdf ? 'file-pdf' : 'file'} size="1.1rem" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium text-foreground">{attachment.filename}</span>
        <span className="text-[0.6875rem] text-(--ui-text-quaternary)">
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
    <Field label={DECISION.files}>
      <ul className="flex flex-col gap-1.5">
        {files.map(file => (
          <FileRow attachment={file} key={file.id} onDownload={data.downloadAttachment} />
        ))}
      </ul>
    </Field>
  )
}

function Effect({ children, icon, label }: { children: ReactNode; icon: string; label: string }) {
  return (
    <div className="flex items-start gap-2 text-[0.75rem] text-(--ui-text-tertiary)">
      <Codicon className="mt-0.5 shrink-0" name={icon} size="0.8rem" />
      <span>
        <span className="font-medium text-(--ui-text-secondary)">{label}: </span>
        {children}
      </span>
    </div>
  )
}

/** What each button on the card does, per kind of decision. */
function Effects({ agentApprove, agentDecline, kind }: { agentApprove: string; agentDecline: string; kind: string }) {
  const e = DECISION.effect

  if (kind === 'review') {
    return (
      <div className="flex flex-col gap-1.5">
        <Effect icon="check" label={DECISION.ifApprove}>
          {e.approve}
          {agentApprove && <AgentSays text={agentApprove} />}
        </Effect>
        <Effect icon="reply" label={DECISION.ifChanges}>
          {e.changes}
          {agentDecline && <AgentSays text={agentDecline} />}
        </Effect>
      </div>
    )
  }

  return kind === 'question' ? (
    <Effect icon="comment" label={DECISION.ifAnswer}>
      {e.answer}
    </Effect>
  ) : (
    <Effect icon="debug-continue" label={DECISION.ifUnblock}>
      {e.unblock}
    </Effect>
  )
}

function AgentSays({ text }: { text: string }) {
  return (
    <span className="mt-0.5 block whitespace-pre-line text-(--ui-text-secondary)">
      {DECISION.agentSays}: {text}
    </span>
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
    <div className="flex flex-col gap-3" data-decision-details="">
      <Field label={DECISION.ask}>
        <p className={BODY}>{parsed.ask || DECISION.noAsk[kind]}</p>
      </Field>
      <Field label={DECISION.why}>
        <p className={BODY}>{why || fallbackWhy}</p>
      </Field>
      {parsed.report && (
        <Field label={DECISION.report}>
          <div className={`${BODY} max-h-56 overflow-y-auto rounded-lg bg-(--ui-bg-secondary) p-2.5`}>
            {parsed.report}
          </div>
        </Field>
      )}
      <DecisionFiles taskId={task.id} />
      <Effects agentApprove={parsed.approve} agentDecline={parsed.decline} kind={kind} />
    </div>
  )
}
