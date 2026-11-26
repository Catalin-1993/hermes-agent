import { useStore } from '@nanostores/react'
import type * as React from 'react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'

import { $atlasSelection, type AtlasSelection, fetchAtlasDetail } from './atlas-data'
import { SECTION_TITLE, when } from './atlas-side'

type Record_ = Record<string, unknown>

const str = (value: unknown) => (typeof value === 'string' ? value : '')
const num = (value: unknown) => (typeof value === 'number' ? value : 0)
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/** The record's own text: fact texts carry " | When: … | Involving: …" tails, shown as fields instead. */
const mainText = (text: string) => text.split(' | ')[0]

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="py-2">
      <div className="mb-1 text-[0.6875rem] text-(--ui-text-tertiary)">{label}</div>
      <div className="text-[0.8125rem] leading-relaxed text-(--ui-text-primary)">{children}</div>
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <span className="rounded-full bg-(--ui-bg-tertiary) px-2 py-0.5 text-xs text-(--ui-text-secondary)" key={item}>
          {item}
        </span>
      ))}
    </div>
  )
}

function MemoryBody({ item }: { item: Record_ }) {
  const copy = useI18n().t.library.home
  const text = str(item.text)
  const tails = text.split(' | ').slice(1)
  const entities = list(item.entities).map(String)

  return (
    <>
      <p className="m-0 text-[0.9375rem] leading-relaxed text-(--ui-text-primary)">{mainText(text)}</p>
      {tails.length > 0 && (
        <ul className="mt-3 mb-0 list-none space-y-1 p-0 text-xs leading-relaxed text-(--ui-text-secondary)">
          {tails.map(line => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 divide-y divide-(--ui-stroke-quaternary)">
        {str(item.type) && <Field label={copy.detail.type}>{copy.modes[item.type as 'world'] ?? str(item.type)}</Field>}
        {str(item.mentioned_at || item.date) && (
          <Field label={copy.detail.remembered}>{new Date(str(item.mentioned_at || item.date)).toLocaleString()}</Field>
        )}
        {str(item.context) && str(item.context) !== 'N/A' && <Field label={copy.detail.context}>{str(item.context)}</Field>}
        {entities.length > 0 && (
          <Field label={copy.detail.entities}>
            <Chips items={entities} />
          </Field>
        )}
      </div>
    </>
  )
}

function EntityBody({ item }: { item: Record_ }) {
  const copy = useI18n().t.library.home
  const observations = list(item.observations).map(row => (typeof row === 'string' ? row : str((row as Record_)?.text)))

  return (
    <div className="divide-y divide-(--ui-stroke-quaternary)">
      <Field label={copy.detail.mentions}>{num(item.mention_count)}</Field>
      {str(item.first_seen) && <Field label={copy.detail.firstSeen}>{new Date(str(item.first_seen)).toLocaleString()}</Field>}
      {str(item.last_seen) && <Field label={copy.detail.lastSeen}>{when(str(item.last_seen))}</Field>}
      {observations.filter(Boolean).length > 0 && (
        <Field label={copy.detail.observations}>
          <ul className="m-0 list-disc space-y-1.5 pl-4">
            {observations.filter(Boolean).map(text => (
              <li key={text}>{mainText(text)}</li>
            ))}
          </ul>
        </Field>
      )}
    </div>
  )
}

function DocumentBody({ item }: { item: Record_ }) {
  const copy = useI18n().t.library.home
  const params = (item.retain_params ?? {}) as Record_
  const text = str(item.original_text)

  return (
    <>
      <div className="divide-y divide-(--ui-stroke-quaternary)">
        {str(params.context) && <Field label={copy.detail.context}>{str(params.context)}</Field>}
        <Field label={copy.detail.saved}>{new Date(str(item.updated_at || item.created_at)).toLocaleString()}</Field>
        <Field label={copy.detail.extracted}>{copy.memoriesCount(num(item.memory_unit_count))}</Field>
      </div>
      {text && (
        <>
          <h4 className={`${SECTION_TITLE} mt-4`}>{copy.detail.transcript}</h4>
          <div className="rounded-xl bg-(--ui-bg-tertiary) p-3 font-mono text-[0.75rem] leading-relaxed whitespace-pre-wrap text-(--ui-text-secondary)">
            {text}
          </div>
        </>
      )}
    </>
  )
}

const BODY: Record<AtlasSelection['kind'], (props: { item: Record_ }) => React.ReactNode> = {
  document: DocumentBody,
  entity: EntityBody,
  memory: MemoryBody
}

const ICON: Record<AtlasSelection['kind'], string> = {
  document: 'comment-discussion',
  entity: 'person',
  memory: 'circle-filled'
}

/** One memory, entity or conversation in full, over the right column. */
export function AtlasDetail() {
  const copy = useI18n().t.library.home
  const selection = useStore($atlasSelection)
  const [item, setItem] = useState<null | Record_>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!selection) {
      return
    }

    let live = true

    setItem(null)
    setFailed(false)
    fetchAtlasDetail(selection.kind, selection.id).then(
      reply => live && (reply.item ? setItem(reply.item as Record_) : setFailed(true)),
      () => live && setFailed(true)
    )

    return () => {
      live = false
    }
  }, [selection])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && $atlasSelection.set(null)

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!selection) {
    return null
  }

  const Body = BODY[selection.kind]
  const title = selection.kind === 'entity' ? str(item?.canonical_name) || selection.label : selection.label

  return (
    <div className="library-home-detail absolute inset-0 z-10 flex flex-col bg-(--ui-bg-editor)">
      <div className="flex items-center gap-2 border-b border-(--ui-stroke-quaternary) px-4 py-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-(--ui-bg-tertiary) text-(--ui-accent)">
          <Codicon name={ICON[selection.kind]} size="0.75rem" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.6875rem] text-(--ui-text-tertiary)">{copy.detail.kinds[selection.kind]}</div>
          <div className="truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">
            {selection.kind === 'memory' ? copy.detail.kinds.memory : title}
          </div>
        </div>
        <Button aria-label={copy.detail.close} onClick={() => $atlasSelection.set(null)} size="icon-sm" variant="ghost">
          <Codicon name="close" size="0.875rem" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {item ? (
          <Body item={item} />
        ) : failed ? (
          <p className="m-0 text-xs text-(--ui-text-tertiary)">{copy.detail.failed}</p>
        ) : (
          <div className="grid h-32 place-items-center">
            <Loader />
          </div>
        )}
      </div>
    </div>
  )
}
