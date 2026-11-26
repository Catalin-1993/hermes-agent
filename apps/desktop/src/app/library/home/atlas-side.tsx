import type * as React from 'react'

import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { relativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'

import { $atlasMode, $atlasSelection, type AtlasOverview } from './atlas-data'

export const SECTION_TITLE = 'mb-2.5 text-[0.6875rem] font-medium tracking-[0.08em] text-(--ui-text-tertiary) uppercase'

const ROW =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-(--ui-row-hover-background)'

export const when = (iso: null | string | undefined) => (iso ? relativeTime(Date.parse(iso)) : '')

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="border-t border-(--ui-stroke-quaternary) px-5 py-4 first:border-t-0">
      <h3 className={SECTION_TITLE}>{title}</h3>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-(--ui-bg-tertiary) px-3 py-2.5">
      <div className="text-[1.25rem] leading-none font-semibold tracking-tight text-(--ui-text-primary) tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="mt-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">{label}</div>
    </div>
  )
}

/** New memories per day over the last 30 days, as quiet bars. */
function Activity({ activity }: { activity: AtlasOverview['activity'] }) {
  const copy = useI18n().t.library.home
  const max = Math.max(1, ...activity.map(day => day.count))
  const total = activity.reduce((sum, day) => sum + day.count, 0)

  return (
    <div>
      <div aria-label={copy.activityLabel(total)} className="flex h-12 items-end gap-[2px]" role="img">
        {activity.map((day, index) => (
          <div
            className={cn(
              'min-h-[2px] flex-1 rounded-[2px]',
              day.count ? 'bg-(--ui-accent)' : 'bg-(--ui-stroke-tertiary)'
            )}
            key={day.time ?? index}
            style={{ height: `${Math.max(4, (day.count / max) * 100)}%`, opacity: day.count ? 0.35 + 0.65 * (day.count / max) : 1 }}
            title={day.time ? `${new Date(day.time).toLocaleDateString()} · ${day.count}` : undefined}
          />
        ))}
      </div>
      <div className="mt-2 text-[0.6875rem] text-(--ui-text-tertiary)">{copy.activityCaption(total)}</div>
    </div>
  )
}

/** The memory at a glance, beside the graph: counts, activity, who and what it mentions most, the
 *  conversations it was read from, and its knowledge pages. */
export function AtlasSide({ overview }: { overview: AtlasOverview }) {
  const copy = useI18n().t.library.home
  const { counts } = overview

  return (
    <div className="pb-4">
      <Section title={copy.atGlance}>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={copy.counts.memories} value={counts.memories} />
          <Stat label={copy.counts.links} value={counts.links} />
          <Stat label={copy.counts.entities} value={counts.entities} />
          <Stat label={copy.counts.documents} value={counts.documents} />
        </div>
        {overview.last_write_at && (
          <div className="mt-3 text-[0.6875rem] text-(--ui-text-tertiary)">{copy.lastWrite(when(overview.last_write_at))}</div>
        )}
      </Section>

      {overview.activity.length > 0 && (
        <Section title={copy.activity}>
          <Activity activity={overview.activity} />
        </Section>
      )}

      {overview.entities.length > 0 && (
        <Section title={copy.topEntities}>
          <div className="flex flex-wrap gap-1.5">
            {overview.entities.map(entity => (
              <button
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-(--ui-stroke-tertiary) px-2.5 py-1 text-xs text-(--ui-text-secondary) transition-colors hover:border-(--ui-stroke-secondary) hover:text-(--ui-text-primary)"
                key={entity.id}
                onClick={() => {
                  $atlasMode.set('entities')
                  $atlasSelection.set({ id: entity.id, kind: 'entity', label: entity.name })
                }}
                type="button"
              >
                {entity.name}
                <span className="text-(--ui-text-quaternary) tabular-nums">{entity.mentions}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title={copy.recentDocuments}>
        {overview.documents.length ? (
          <div className="-mx-2">
            {overview.documents.map(doc => (
              <button
                className={ROW}
                key={doc.id}
                onClick={() => $atlasSelection.set({ id: doc.id, kind: 'document', label: doc.context || copy.conversation })}
                type="button"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)">
                  <Codicon name="comment-discussion" size="0.8125rem" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] text-(--ui-text-primary)">
                    {doc.context || copy.conversation}
                  </span>
                  <span className="block truncate text-[0.6875rem] text-(--ui-text-tertiary)">
                    {[when(doc.updated_at ?? doc.created_at), copy.memoriesCount(doc.memories)].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="m-0 text-xs text-(--ui-text-tertiary)">{copy.noDocuments}</p>
        )}
      </Section>

      <Section title={copy.knowledge}>
        {overview.knowledge.length ? (
          <div className="-mx-2">
            {overview.knowledge.map(page => (
              <div className={cn(ROW, 'cursor-default')} key={page.id} style={{ paddingLeft: `${0.5 + page.depth * 0.875}rem` }}>
                <Codicon
                  className="shrink-0 text-(--ui-text-tertiary)"
                  name={page.kind === 'folder' ? 'folder' : page.kind === 'model' ? 'lightbulb' : 'note'}
                  size="0.8125rem"
                />
                <span className="truncate text-[0.8125rem] text-(--ui-text-primary)">{page.title || copy.untitled}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 text-xs leading-relaxed text-(--ui-text-tertiary)">{copy.noKnowledge}</p>
        )}
      </Section>
    </div>
  )
}
