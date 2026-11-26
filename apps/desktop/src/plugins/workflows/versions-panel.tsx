/**
 * The right panel's Versions tab: every kept version, newest first, with what it changed against the
 * one before it (steps added, removed or edited, links, a new name). A version's steps open in place;
 * restoring one asks first and makes it the newest version, so nothing is lost.
 */

import { cn, Codicon, ConfirmDialog, host, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { type ReactNode, useEffect, useState } from 'react'

import { fetchVersion, fetchVersions, keys, restoreVersion, type VersionSummary, type WorkflowDetail } from './api'
import type { NodeConfigs } from './api'
import { COPY } from './copy'
import { runOrder } from './doc'
import type { Editor } from './editor-state'
import { isVisual, KIND_ICON, KIND_TONE, nodeLabel, nodeSummary, TRIGGER_ICON } from './kinds'
import { ago, BTN, HINT, KindTile, Section } from './ui'

const V = COPY.versions

function Chip({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[0.6875rem]"
      style={{ background: `color-mix(in srgb, ${tone} 13%, transparent)`, color: tone }}
    >
      {children}
    </span>
  )
}

function Changes({ changes }: { changes: VersionSummary['changes'] }) {
  if (changes.first) {
    return <span className={HINT}>{V.first}</span>
  }

  const chips: ReactNode[] = [
    ...(changes.added ?? []).map(name => (
      <Chip key={`a${name}`} tone="var(--ui-green)">
        + {name}
      </Chip>
    )),
    ...(changes.removed ?? []).map(name => (
      <Chip key={`r${name}`} tone="var(--ui-red)">
        − {name}
      </Chip>
    )),
    ...(changes.changed ?? []).map(name => (
      <Chip key={`c${name}`} tone="var(--ui-blue)">
        ~ {name}
      </Chip>
    ))
  ]

  if (changes.links_added) {
    chips.push(
      <Chip key="la" tone="var(--ui-text-secondary)">
        {V.linksAdded(changes.links_added)}
      </Chip>
    )
  }

  if (changes.links_removed) {
    chips.push(
      <Chip key="lr" tone="var(--ui-text-secondary)">
        {V.linksRemoved(changes.links_removed)}
      </Chip>
    )
  }

  if (changes.renamed) {
    chips.push(
      <Chip key="rn" tone="var(--ui-text-secondary)">
        {V.renamed}
      </Chip>
    )
  }

  if (changes.described) {
    chips.push(
      <Chip key="ds" tone="var(--ui-text-secondary)">
        {V.described}
      </Chip>
    )
  }

  return chips.length ? <div className="flex flex-wrap gap-1">{chips}</div> : <span className={HINT}>{V.noChange}</span>
}

function VersionSteps({ id, version }: { id: string; version: number }) {
  const { data: doc } = useQuery({
    queryFn: () => fetchVersion(id, version),
    queryKey: keys.version(id, version),
    staleTime: Infinity
  })

  if (!doc) {
    return <p className={HINT}>…</p>
  }

  const order = runOrder(doc)

  const nodes = [...doc.nodes]
    .filter(node => !isVisual(node.kind))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))

  return (
    <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
      {nodes.map(node => (
        <li className="flex items-center gap-2" key={node.id}>
          <KindTile
            icon={
              node.kind === 'trigger'
                ? (TRIGGER_ICON[(node.config as NodeConfigs['trigger']).type] ?? 'zap')
                : KIND_ICON[node.kind]
            }
            size="sm"
            tone={KIND_TONE[node.kind]}
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.75rem] font-medium text-(--ui-text-primary)">{nodeLabel(node)}</span>
            <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">
              {nodeSummary(node, name => name || COPY.inspector.defaultAgent)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function VersionCard({
  current,
  id,
  onRestore,
  version
}: {
  current: boolean
  id: string
  onRestore: () => void
  version: VersionSummary
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-[12px] border px-3 py-2.5',
        current ? 'border-(--ui-accent)' : 'border-(--card-stroke)'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[0.8125rem] font-semibold text-(--ui-text-primary)">v{version.version}</span>
        <span className="flex-1 truncate text-[0.71875rem] text-(--ui-text-tertiary)">
          {ago(version.created_at)} · {V.steps(version.steps)}
        </span>
        {current && (
          <span className="rounded-full bg-(--card-well) px-2 py-0.5 text-[0.65625rem] text-(--ui-text-secondary)">
            {V.current}
          </span>
        )}
      </div>
      <Changes changes={version.changes} />
      {open && <VersionSteps id={id} version={version.version} />}
      <div className="flex gap-2">
        <button className={cn(BTN, 'h-7 px-2.5 text-[0.75rem]')} onClick={() => setOpen(!open)} type="button">
          <Codicon name={open ? 'chevron-up' : 'list-ordered'} size="0.75rem" />
          {open ? V.hide : V.show}
        </button>
        {!current && (
          <button className={cn(BTN, 'h-7 px-2.5 text-[0.75rem]')} onClick={onRestore} type="button">
            <Codicon name="history" size="0.75rem" />
            {V.restore}
          </button>
        )}
      </div>
    </div>
  )
}

export function VersionsPanel({
  editor,
  onRestored
}: {
  editor: Editor
  onRestored: (detail: WorkflowDetail) => void
}) {
  const id = editor.id
  const queryClient = useQueryClient()
  const [restoring, setRestoring] = useState<null | number>(null)
  const { data: versions } = useQuery({ queryFn: () => fetchVersions(id), queryKey: keys.versions(id) })

  // A save that made a new version: the list follows.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: keys.versions(id) })
  }, [editor.meta.version, id, queryClient])

  return (
    <>
      <Section>
        <p className={HINT}>{V.hint}</p>
      </Section>
      <Section>
        {versions?.length === 0 && <p className={HINT}>{V.empty}</p>}
        {versions?.map(version => (
          <VersionCard
            current={version.version === editor.meta.version}
            id={id}
            key={version.version}
            onRestore={() => setRestoring(version.version)}
            version={version}
          />
        ))}
      </Section>
      <ConfirmDialog
        busyLabel={V.restoreBusy}
        confirmLabel={V.restore}
        description={V.restoreDescription}
        onClose={() => setRestoring(null)}
        onConfirm={async () => {
          if (restoring === null) {
            return
          }

          const detail = await restoreVersion(id, restoring)
          host.notify({ kind: 'success', message: V.restored(restoring) })
          void queryClient.invalidateQueries({ queryKey: ['workflows'] })
          onRestored(detail)
        }}
        open={restoring !== null}
        title={restoring === null ? '' : V.restoreTitle(restoring)}
      />
    </>
  )
}
