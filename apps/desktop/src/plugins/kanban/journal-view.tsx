/**
 * The project's Journal: every decision, report and conversation as a timeline by month, newest first, each
 * opening to its full text. The files live in the project's folder on this computer (year / month), so they
 * can be read without the app; this view is the way to browse and search them.
 */

import { Button, cn, Codicon, Input, Loader, Streamdown, useQuery, useValue } from '@hermes/plugin-sdk'
import { useState } from 'react'

import {
  $boardSlug,
  fetchJournal,
  fetchJournalEntry,
  journalEntryKey,
  journalKey,
  pluginOs,
  useKanbanScope
} from './api'
import { JOURNAL } from './journal-copy'
import type { JournalEntry, KanbanBoard } from './types'

type Filter = 'all' | 'conversation' | 'decision' | 'report'

const TYPE_META: Record<string, { icon: string; tone: string }> = {
  conversation: { icon: 'comment-discussion', tone: '#a78bfa' },
  decision: { icon: 'verified', tone: '#60a5fa' },
  report: { icon: 'file-text', tone: '#34d399' }
}

/** The file's own header and title line are shown by the row; the body is what is left. */
const withoutHeader = (content: string) => content.replace(/^---\n[\s\S]*?\n---\n+/, '').replace(/^# .*\n+/, '')

const monthOf = (entry: JournalEntry) => entry.date.slice(0, 7)

const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString('en', { month: 'long', year: 'numeric' })

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', weekday: 'short' })

const outcomeLabel = (outcome: string) => JOURNAL.outcomes[outcome as keyof typeof JOURNAL.outcomes] ?? outcome

function EntryBody({ path }: { path: string }) {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  const { data, error } = useQuery({
    queryFn: () => fetchJournalEntry(path),
    queryKey: journalEntryKey(scope, slug, path)
  })

  if (error) {
    return <p className="text-[0.75rem] text-(--ui-text-quaternary)">{JOURNAL.loadFailed}</p>
  }

  return data ? (
    <div className="max-w-none text-[0.8125rem] leading-relaxed text-(--ui-text-secondary) [&_h1]:text-[1rem] [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[0.75rem] [&_h2]:font-semibold [&_h2]:tracking-[0.08em] [&_h2]:text-(--ui-text-tertiary) [&_h2]:uppercase">
      <Streamdown>{withoutHeader(data.content)}</Streamdown>
    </div>
  ) : (
    <Loader type="lemniscate-bloom" />
  )
}

function EntryRow({ entry, open, onToggle }: { entry: JournalEntry; onToggle: () => void; open: boolean }) {
  const meta = TYPE_META[entry.type] ?? TYPE_META.report!

  return (
    <li
      className="rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated)"
      data-journal-entry={entry.path}
    >
      <button className="flex w-full cursor-pointer items-center gap-3 p-3 text-left" onClick={onToggle} type="button">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
        >
          <Codicon name={meta.icon} size="0.95rem" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-(--ui-text-tertiary)">
            <span className="font-semibold" style={{ color: meta.tone }}>
              {JOURNAL.types[entry.type as keyof typeof JOURNAL.types] ?? entry.type}
            </span>
            {entry.outcome && <span className="text-(--ui-text-secondary)">{outcomeLabel(entry.outcome)}</span>}
            {entry.agent && <span>{JOURNAL.by(entry.agent)}</span>}
          </span>
          <span className="block truncate text-[0.9375rem] font-medium text-foreground">{entry.title}</span>
        </span>
        <span className="shrink-0 text-[0.75rem] text-(--ui-text-tertiary) tabular-nums">{dayLabel(entry.date)}</span>
        <Codicon
          className="shrink-0 text-(--ui-text-quaternary)"
          name={open ? 'chevron-up' : 'chevron-down'}
          size="0.85rem"
        />
      </button>
      {open && (
        <div className="border-t border-(--ui-stroke-tertiary) px-4 py-3">
          <EntryBody path={entry.path} />
        </div>
      )}
    </li>
  )
}

export function BoardJournal({ board: _board }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [openPath, setOpenPath] = useState<null | string>(null)

  const { data, error } = useQuery({
    queryFn: fetchJournal,
    queryKey: journalKey(scope, slug),
    refetchInterval: 30_000
  })

  const reveal = pluginOs()?.revealPath
  const needle = query.trim().toLowerCase()

  const shown = (data?.entries ?? []).filter(
    entry =>
      (filter === 'all' || entry.type === filter) &&
      (!needle || `${entry.title} ${entry.agent} ${entry.outcome}`.toLowerCase().includes(needle))
  )

  const months = [...new Set(shown.map(monthOf))]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4" data-kanban-journal="">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">{JOURNAL.title}</h2>
            <p className="text-[0.75rem] text-(--ui-text-tertiary)">{JOURNAL.subtitle}</p>
          </div>
          {reveal && data?.entries.length ? (
            <Button onClick={() => void reveal(data.root)} size="sm" variant="outline">
              <Codicon name="folder-opened" size="0.85rem" />
              {JOURNAL.showFolder}
            </Button>
          ) : null}
        </header>
        {error ? (
          <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{JOURNAL.loadFailed}</p>
        ) : !data ? (
          <Loader type="lemniscate-bloom" />
        ) : data.entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-(--ui-stroke-secondary) px-6 py-12 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)">
              <Codicon name="book" size="1.1rem" />
            </span>
            <p className="text-[0.875rem] font-medium text-foreground">{JOURNAL.emptyTitle}</p>
            <p className="max-w-sm text-[0.75rem] text-(--ui-text-tertiary)">{JOURNAL.emptyBody}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {(Object.keys(JOURNAL.filters) as Filter[]).map(id => (
                  <button
                    aria-pressed={filter === id}
                    className={cn(
                      'h-7 cursor-pointer rounded-full px-3 text-[0.75rem] transition-colors',
                      filter === id
                        ? 'bg-(--ui-control-active-background) font-medium text-foreground'
                        : 'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
                    )}
                    key={id}
                    onClick={() => setFilter(id)}
                    type="button"
                  >
                    {JOURNAL.filters[id]}
                  </button>
                ))}
              </div>
              <Input
                aria-label={JOURNAL.search}
                className="ml-auto h-8 w-56 text-[0.8125rem]"
                onChange={event => setQuery(event.target.value)}
                placeholder={JOURNAL.search}
                value={query}
              />
            </div>
            {months.length === 0 && <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{JOURNAL.noMatch}</p>}
            {months.map(month => (
              <section className="flex flex-col gap-2" key={month}>
                <h3 className="text-[0.6875rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
                  {monthLabel(month)}
                </h3>
                <ul className="flex flex-col gap-2">
                  {shown
                    .filter(entry => monthOf(entry) === month)
                    .map(entry => (
                      <EntryRow
                        entry={entry}
                        key={entry.path}
                        onToggle={() => setOpenPath(openPath === entry.path ? null : entry.path)}
                        open={openPath === entry.path}
                      />
                    ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
