/**
 * The project's Journal: at the top, the project at a glance (what was decided and how, reported and discussed,
 * week by week, by whom); below, every decision, report and conversation by month, newest first, on the left, and
 * the one picked laid out as a short, easy-to-read report on the right (`journal-report`). The files live in the project's folder on this computer (year / month), so they
 * can be read without the app; this view is the way to browse and search them.
 */

import { Button, cn, Codicon, Input, Loader, useQuery, useValue } from '@hermes/plugin-sdk'
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
import { EntryReport, JournalSummary, OUTCOME_TONE, outcomeLabel, TYPE_META } from './journal-report'
import type { JournalEntry, KanbanBoard } from './types'

type Filter = 'all' | 'conversation' | 'decision' | 'report'

const monthOf = (entry: JournalEntry) => entry.date.slice(0, 7)

const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString('en', { month: 'long', year: 'numeric' })

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short' })

function EntryPanel({ entry }: { entry: JournalEntry }) {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)

  const { data, error } = useQuery({
    queryFn: () => fetchJournalEntry(entry.path),
    queryKey: journalEntryKey(scope, slug, entry.path)
  })

  if (error) {
    return <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{JOURNAL.loadFailed}</p>
  }

  return data ? <EntryReport content={data.content} entry={entry} /> : <Loader type="lemniscate-bloom" />
}

function EntryRow({ active, entry, onSelect }: { active: boolean; entry: JournalEntry; onSelect: () => void }) {
  const meta = TYPE_META[entry.type] ?? TYPE_META.report!

  return (
    <li data-journal-entry={entry.path}>
      <button
        className={cn(
          'relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
          active
            ? 'bg-(--ui-control-active-background) ring-1 ring-(--ui-stroke-secondary) ring-inset'
            : 'hover:bg-(--chrome-action-hover)'
        )}
        onClick={onSelect}
        type="button"
      >
        {active && (
          <span
            className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full"
            style={{ backgroundColor: meta.tone }}
          />
        )}
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`, color: meta.tone }}
        >
          <Codicon name={meta.icon} size="0.85rem" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-medium text-foreground">{entry.title}</span>
          <span className="flex items-center gap-1.5 truncate text-[0.6875rem] text-(--ui-text-tertiary)">
            <span style={{ color: meta.tone }}>
              {JOURNAL.types[entry.type as keyof typeof JOURNAL.types] ?? entry.type}
            </span>
            {entry.outcome && (
              <span style={{ color: OUTCOME_TONE[entry.outcome] }}>· {outcomeLabel(entry.outcome)}</span>
            )}
            {entry.agent && <span>· {entry.agent}</span>}
          </span>
        </span>
        <span className="shrink-0 self-start pt-0.5 text-[0.6875rem] text-(--ui-text-quaternary) tabular-nums">
          {dayLabel(entry.date)}
        </span>
      </button>
    </li>
  )
}

export function BoardJournal({ board: _board }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<null | string>(null)

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
  const current = shown.find(entry => entry.path === chosen) ?? shown[0] ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4" data-kanban-journal="">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
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
            <JournalSummary entries={data.entries} />
            <div className="grid gap-4 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
              <nav className="flex flex-col gap-3 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-12rem)] lg:self-start lg:overflow-y-auto">
                {months.length === 0 && <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{JOURNAL.noMatch}</p>}
                {months.map(month => (
                  <section className="flex flex-col gap-1" key={month}>
                    <h3 className="px-2.5 text-[0.625rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
                      {monthLabel(month)}
                    </h3>
                    <ul className="flex flex-col gap-0.5">
                      {shown
                        .filter(entry => monthOf(entry) === month)
                        .map(entry => (
                          <EntryRow
                            active={entry.path === current?.path}
                            entry={entry}
                            key={entry.path}
                            onSelect={() => setChosen(entry.path)}
                          />
                        ))}
                    </ul>
                  </section>
                ))}
              </nav>
              <main className="min-w-0 rounded-2xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) px-6 py-5">
                {current ? (
                  <EntryPanel entry={current} key={current.path} />
                ) : (
                  <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{JOURNAL.pick}</p>
                )}
              </main>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
