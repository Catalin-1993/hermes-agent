'use client'

import { useStore } from '@nanostores/react'
import { type FC, useMemo, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { AccessBadge } from '@/app/library/access'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import {
  CARD_BUTTON_CLASS,
  HermesCard,
  HermesCardActions,
  HermesCardBody,
  HermesCardField,
  HermesCardHeader,
  HermesCardWell
} from '@/components/ui/hermes-card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import {
  answerLibraryConsent,
  type LibraryConsentAction,
  type LibraryConsentEdits,
  type LibraryConsentRequest,
  sessionLibraryConsents
} from '@/store/library-consent'
import { notifyError } from '@/store/notifications'

const ACTION_ICON: Record<LibraryConsentAction, string> = {
  attach: 'file-add',
  create: 'new-file',
  delete: 'trash',
  read: 'eye',
  search: 'search',
  update: 'edit'
}

/** Transcript-level host for the session's Library consent cards (beside the approval stack). */
export const LibraryConsentStack: FC = () => {
  const sessionId = useStore(useSessionView().$runtimeId)
  const requests = useStore(useMemo(() => sessionLibraryConsents(sessionId), [sessionId]))

  if (requests.length === 0) {
    return null
  }

  return (
    <section className="flex w-full max-w-xl flex-col gap-2 self-center py-2" data-slot="library-consent-stack">
      {requests.map(request => (
        <LibraryConsentCard key={request.requestId} request={request} />
      ))}
    </section>
  )
}

/** One Library action spelled out for the owner: what, on which item, why, what changes, a preview. */
function LibraryConsentCard({ request }: { request: LibraryConsentRequest }) {
  const { t } = useI18n()
  const copy = t.library.consent
  const [answered, setAnswered] = useState<'approve' | 'decline' | null>(null)
  const [editing, setEditing] = useState(false)
  const draft = useConsentDraft(request)
  const destructive = request.action === 'delete'

  const answer = (approved: boolean) => {
    if (answered) {
      return
    }

    setAnswered(approved ? 'approve' : 'decline')
    triggerHaptic(approved ? 'success' : 'tap')

    if (!answerLibraryConsent(request.requestId, approved, draft.edits)) {
      notifyError(new Error(copy.expired), t.assistant.approval.sendFailed)
    }
  }

  return (
    <HermesCard data-action={request.action} data-request-id={request.requestId} data-slot="library-consent-card">
      <HermesCardHeader
        eyebrow={
          <span className="flex items-center gap-1">
            <Codicon name="library" size="0.6875rem" />
            {copy.eyebrow}
          </span>
        }
        icon={<Codicon name={ACTION_ICON[request.action]} size="1rem" />}
        title={copy.actions[request.action]}
        tone={destructive ? 'danger' : 'accent'}
      />

      <HermesCardBody>
        {request.target && (
          <HermesCardWell className="flex items-center gap-2.5">
            <Codicon
              className="text-(--ui-text-tertiary)"
              name={request.target.kind === 'file' ? 'file' : 'note'}
              size="0.875rem"
            />
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">
              {request.target.title || t.library.untitled}
            </span>
            {request.target.visibility && <AccessBadge visibility={request.target.visibility} />}
          </HermesCardWell>
        )}

        <dl className="m-0 flex flex-col gap-3">
          {request.query && <HermesCardField label={copy.query}>“{request.query}”</HermesCardField>}
          {request.reason && <HermesCardField label={copy.why}>{request.reason}</HermesCardField>}
          {request.changes.length > 0 && (
            <HermesCardField label={copy.changes}>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {request.changes.map(change => (
                  <li className="flex items-start gap-2" key={change}>
                    <span aria-hidden className="mt-[0.5rem] size-1 shrink-0 rounded-full bg-(--ui-text-tertiary)" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </HermesCardField>
          )}
          {editing ? (
            <ConsentEditor draft={draft} request={request} />
          ) : (
            <ConsentPreview draft={draft} request={request} />
          )}
        </dl>
      </HermesCardBody>

      <HermesCardActions note={copy.footnote}>
        {draft.editable && (
          <Button
            aria-pressed={editing}
            className={CARD_BUTTON_CLASS}
            data-library-consent="edit"
            disabled={answered !== null}
            onClick={() => setEditing(value => !value)}
            size="sm"
            variant="ghost"
          >
            <Codicon name={editing ? 'eye' : 'edit'} size="0.8125rem" />
            {editing ? copy.preview : copy.edit}
          </Button>
        )}
        <Button
          className={CARD_BUTTON_CLASS}
          data-library-consent="decline"
          disabled={answered !== null}
          onClick={() => answer(false)}
          size="sm"
          variant="secondary"
        >
          {copy.decline}
        </Button>
        <Button
          className={CARD_BUTTON_CLASS}
          data-library-consent="approve"
          disabled={answered !== null}
          onClick={() => answer(true)}
          size="sm"
          variant={destructive ? 'destructive' : 'default'}
        >
          {draft.edited ? copy.approveEdited : copy.approve}
        </Button>
      </HermesCardActions>
    </HermesCard>
  )
}

type ConsentDraft = ReturnType<typeof useConsentDraft>

/** An editable card's title and body as the owner is leaving them, and what changed from the proposal. */
function useConsentDraft(request: LibraryConsentRequest) {
  const [title, setTitle] = useState(request.title ?? '')
  const [content, setContent] = useState(request.content ?? '')
  const titleEdited = request.title !== null && title.trim() !== request.title.trim()
  const contentEdited = request.content !== null && content !== request.content

  const edits: LibraryConsentEdits = {
    ...(titleEdited && title.trim() ? { title: title.trim() } : {}),
    ...(contentEdited ? { content } : {})
  }

  return {
    content,
    editable: request.editable && (request.title !== null || request.content !== null),
    edited: titleEdited || contentEdited,
    edits,
    setContent,
    setTitle,
    title
  }
}

/** The page's title and body, editable before the owner approves. */
function ConsentEditor({ draft, request }: { draft: ConsentDraft; request: LibraryConsentRequest }) {
  const copy = useI18n().t.library.consent

  return (
    <>
      {request.title !== null && (
        <HermesCardField label={copy.titleLabel}>
          <Input
            aria-label={copy.titleLabel}
            className="h-8 text-[0.8125rem]"
            onChange={event => draft.setTitle(event.target.value)}
            value={draft.title}
          />
        </HermesCardField>
      )}
      {request.content !== null && (
        <HermesCardField label={copy.contentLabel}>
          <Textarea
            aria-label={copy.contentLabel}
            className="max-h-[22rem] min-h-40 font-mono text-xs leading-relaxed"
            onChange={event => draft.setContent(event.target.value)}
            value={draft.content}
          />
        </HermesCardField>
      )}
    </>
  )
}

/** What will be written: the agent's preview, or the owner's edit once they made one. */
function ConsentPreview({ draft, request }: { draft: ConsentDraft; request: LibraryConsentRequest }) {
  const copy = useI18n().t.library.consent
  const text = draft.edited ? draft.content.trim() : request.preview.trim()

  if (!text) {
    return null
  }

  return (
    <HermesCardField label={draft.edited ? `${copy.preview} · ${copy.editedNote}` : copy.preview}>
      <HermesCardWell className="max-h-36 overflow-auto">
        <pre className="m-0 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-(--ui-text-secondary)">
          {text}
        </pre>
      </HermesCardWell>
    </HermesCardField>
  )
}
