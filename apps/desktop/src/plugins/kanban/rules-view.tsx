/**
 * The Rules view: the board's approval rules. Each rule names the finished cards it covers (by
 * agent, by words they mention, by priority) and who checks them before they count as Done — the
 * owner (the card waits in the Inbox) or a verifier agent. Quick-start presets fill the editor;
 * every rule switches on and off in place. Enforced when a worker finishes (`kanban_db_rules`).
 */

import {
  Button,
  cn,
  Codicon,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogTitle,
  host,
  Input,
  SegmentedControl,
  Switch,
  useQueryClient,
  useValue
} from '@hermes/plugin-sdk'
import { useState } from 'react'

import { $boardSlug, $boardView, deleteRule, rulesKey, saveRule, useKanbanScope } from './api'
import { useRoster } from './org-view'
import { useRules } from './team-queries'
import type { BoardRule, KanbanBoard, RuleDraft, RulesState } from './types'
import { Avatar, errText, FIELD_LABEL, type KanbanText, useKanban } from './ui'

/** The words a buy/sell preset watches for; the owner's agents write in English or Romanian. */
const TRADE_WORDS = ['buy', 'sell', 'rebalance', 'allocate', 'cumpăr', 'vând', 'rebalans', 'alocare']

const OWNER_TONE = '#fbbf24'
const VERIFIER_TONE = '#60a5fa'

type PresetId = 'everything' | 'priority' | 'trades' | 'verifier'

const blank = (): RuleDraft => ({
  action: 'owner',
  agents: [],
  enabled: true,
  keywords: [],
  min_priority: null,
  name: '',
  verifier: null
})

const PRESETS: Record<PresetId, (k: KanbanText) => RuleDraft> = {
  everything: k => ({ ...blank(), name: k.rules.presets.everything }),
  priority: k => ({ ...blank(), min_priority: 2, name: k.rules.presets.priority }),
  trades: k => ({ ...blank(), keywords: TRADE_WORDS, name: k.rules.presets.trades }),
  verifier: k => ({ ...blank(), action: 'verifier', name: k.rules.presets.verifier })
}

const PRESET_ICON: Record<PresetId, string> = {
  everything: 'checklist',
  priority: 'arrow-up',
  trades: 'graph-line',
  verifier: 'verified'
}

/** A rules write with its toast; the answer (the new rule list) replaces the cache. */
function useRulesWrite() {
  const qc = useQueryClient()
  const key = rulesKey(useKanbanScope(), useValue($boardSlug))

  return async (write: () => Promise<RulesState>, done?: string) => {
    try {
      qc.setQueryData(key, await write())

      if (done) {
        host.notify({ kind: 'success', message: done })
      }

      return true
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })

      return false
    }
  }
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-(--ui-bg-quaternary) px-1.5 py-0.5 text-[0.6875rem] text-(--ui-text-secondary)"
      style={tone ? { backgroundColor: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone } : undefined}
    >
      {children}
    </span>
  )
}

function Condition({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-24 shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)">{label}</span>
      {children}
    </div>
  )
}

function RuleCard({ k, onEdit, rule }: { k: KanbanText; onEdit: () => void; rule: BoardRule }) {
  const write = useRulesWrite()
  const [asking, setAsking] = useState(false)
  const { id, ...draft } = rule
  const owner = rule.action === 'owner'

  return (
    <article
      className={cn(
        'flex flex-col gap-2.5 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) p-3.5',
        !rule.enabled && 'opacity-60'
      )}
      data-rule={rule.name}
    >
      <header className="flex items-center gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${owner ? OWNER_TONE : VERIFIER_TONE} 14%, transparent)`,
            color: owner ? OWNER_TONE : VERIFIER_TONE
          }}
        >
          <Codicon name={owner ? 'person' : 'verified'} size="0.95rem" />
        </span>
        <div className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-foreground">{rule.name}</div>
        <Switch
          aria-label={k.rules.toggle}
          checked={rule.enabled}
          onCheckedChange={enabled => void write(() => saveRule({ ...draft, enabled }, id))}
          size="xs"
        />
      </header>
      <div className="flex flex-col gap-1.5">
        <Condition label={k.rules.finishedBy}>
          {rule.agents.length ? (
            rule.agents.map(name => (
              <Chip key={name}>
                <Avatar name={name} size="0.875rem" />
                {name}
              </Chip>
            ))
          ) : (
            <Chip>{k.rules.anyone}</Chip>
          )}
        </Condition>
        <Condition label={k.rules.mentions}>
          {rule.keywords.length ? rule.keywords.map(word => <Chip key={word}>{word}</Chip>) : <Chip>{k.rules.anyCard}</Chip>}
          {rule.min_priority !== null && <Chip tone="#f59e0b">{k.rules.priorityAtLeast(rule.min_priority)}</Chip>}
        </Condition>
        <Condition label={k.rules.checkedBy}>
          {owner ? (
            <Chip tone={OWNER_TONE}>{k.rules.you}</Chip>
          ) : (
            <Chip tone={VERIFIER_TONE}>
              <Avatar name={rule.verifier ?? ''} size="0.875rem" />
              {rule.verifier}
            </Chip>
          )}
        </Condition>
      </div>
      <footer className="-mx-1 flex items-center gap-1 border-t border-(--ui-stroke-tertiary) pt-2">
        <Button onClick={onEdit} size="sm" variant="ghost">
          <Codicon name="edit" size="0.8rem" />
          {k.rules.edit}
        </Button>
        <Button onClick={() => setAsking(true)} size="sm" variant="ghost">
          <Codicon className="text-destructive" name="trash" size="0.8rem" />
          {k.rules.delete}
        </Button>
      </footer>
      {asking && (
        <ConfirmDialog
          cancelLabel={k.rules.cancel}
          confirmLabel={k.rules.delete}
          description={k.rules.deleteBody}
          destructive
          onClose={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false)
            void write(() => deleteRule(id), k.rules.deleted)
          }}
          open
          title={k.rules.deleteTitle(rule.name)}
        />
      )}
    </article>
  )
}

const PRIORITIES = ['any', '1', '2', '3'] as const

function AgentPicker({
  agents,
  k,
  onChange,
  roster
}: {
  agents: string[]
  k: KanbanText
  onChange: (agents: string[]) => void
  roster: string[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {roster.map(name => {
          const on = agents.includes(name)

          return (
            <button
              aria-pressed={on}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-[0.75rem]',
                on
                  ? 'border-(--ui-text-secondary) bg-(--ui-bg-quaternary) text-foreground'
                  : 'border-(--ui-stroke-tertiary) text-(--ui-text-tertiary) hover:text-foreground'
              )}
              key={name}
              onClick={() => onChange(on ? agents.filter(other => other !== name) : [...agents, name])}
              type="button"
            >
              <Avatar name={name} size="1.1rem" />
              {name}
            </button>
          )
        })}
      </div>
      <p className="text-[0.6875rem] text-(--ui-text-quaternary)">{k.rules.agentsHint}</p>
    </div>
  )
}

function RuleEditor({
  initial,
  k,
  onClose,
  ruleId
}: {
  initial: RuleDraft
  k: KanbanText
  onClose: () => void
  ruleId?: number
}) {
  const write = useRulesWrite()
  const { data: roster } = useRoster()
  const names = (roster?.profiles ?? []).map(profile => profile.name)
  const [draft, setDraft] = useState(initial)
  const [words, setWords] = useState(initial.keywords.join(', '))
  const set = (patch: Partial<RuleDraft>) => setDraft(current => ({ ...current, ...patch }))
  const ready = draft.name.trim() && (draft.action === 'owner' || !!draft.verifier)

  const save = async () => {
    const keywords = words.split(',').map(word => word.trim()).filter(Boolean)

    if (await write(() => saveRule({ ...draft, keywords }, ruleId), k.rules.saved)) {
      onClose()
    }
  }

  return (
    <Dialog onOpenChange={open => !open && onClose()} open>
      <DialogContent aria-describedby={undefined} className="w-[min(36rem,94vw)] max-w-none">
        <div className="flex flex-col gap-4 p-5">
          <DialogTitle className="text-base font-semibold">{ruleId === undefined ? k.rules.add : k.rules.edit}</DialogTitle>
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{k.rules.name}</span>
            <Input maxLength={80} onChange={event => set({ name: event.target.value })} value={draft.name} />
          </label>
          <section className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{k.rules.checker}</span>
            <SegmentedControl<RuleDraft['action']>
              onChange={action => set({ action })}
              options={[
                { id: 'owner', label: k.rules.you },
                { id: 'verifier', label: k.rules.agent }
              ]}
              value={draft.action}
            />
            {draft.action === 'verifier' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.6875rem] text-(--ui-text-tertiary)">{k.rules.pickVerifier}</span>
                {names.map(name => (
                  <button
                    aria-pressed={draft.verifier === name}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-[0.75rem]',
                      draft.verifier === name
                        ? 'border-[#60a5fa] text-foreground'
                        : 'border-(--ui-stroke-tertiary) text-(--ui-text-tertiary) hover:text-foreground'
                    )}
                    key={name}
                    onClick={() => set({ verifier: name })}
                    type="button"
                  >
                    <Avatar name={name} size="1.1rem" />
                    {name}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{k.rules.finishedBy}</span>
            <AgentPicker agents={draft.agents} k={k} onChange={agents => set({ agents })} roster={names} />
          </section>
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{k.rules.keywords}</span>
            <Input onChange={event => setWords(event.target.value)} placeholder="buy, sell" value={words} />
            <span className="text-[0.6875rem] text-(--ui-text-quaternary)">{k.rules.keywordsHint}</span>
          </label>
          <section className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{k.rules.minPriority}</span>
            <SegmentedControl<(typeof PRIORITIES)[number]>
              onChange={value => set({ min_priority: value === 'any' ? null : Number(value) })}
              options={PRIORITIES.map(id => ({ id, label: id === 'any' ? k.rules.anyPriority : `${id}+` }))}
              value={draft.min_priority === null ? 'any' : (String(Math.min(draft.min_priority, 3)) as '1' | '2' | '3')}
            />
          </section>
          <div className="flex justify-end gap-1.5">
            <Button onClick={onClose} size="sm" variant="ghost">
              {k.rules.cancel}
            </Button>
            <Button disabled={!ready} onClick={() => void save()} size="sm">
              {k.rules.save}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface Editing {
  draft: RuleDraft
  id?: number
}

export function BoardRules(_props: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const k = useKanban()
  const { data } = useRules()
  const [editing, setEditing] = useState<Editing | null>(null)

  if (!data) {
    return <div className="grid flex-1 place-items-center text-[0.75rem] text-(--ui-text-quaternary)">…</div>
  }

  const held = Object.keys(data.holds).length
  const taken = new Set(data.rules.map(rule => rule.name))
  const presets = (Object.keys(PRESETS) as PresetId[]).filter(id => !taken.has(PRESETS[id](k).name))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-1 pb-4" data-kanban-rules="">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[0.8125rem] text-(--ui-text-secondary)">{k.rules.intro}</p>
        <Button onClick={() => setEditing({ draft: blank() })} size="sm">
          <Codicon name="add" size="0.8rem" />
          {k.rules.add}
        </Button>
      </div>
      {held > 0 && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[0.8125rem]"
          role="status"
          style={{ backgroundColor: `color-mix(in srgb, ${OWNER_TONE} 12%, transparent)`, color: OWNER_TONE }}
        >
          <Codicon name="inbox" size="0.9rem" />
          <span className="flex-1 text-foreground">{k.rules.holding(held)}</span>
          <Button onClick={() => $boardView.set('inbox')} size="sm" variant="outline">
            {k.rules.openInbox}
          </Button>
        </div>
      )}
      {presets.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-(--ui-text-tertiary)">
            {k.rules.quickStart}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {presets.map(id => (
              <button
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-(--ui-stroke-secondary) px-3 py-2.5 text-left text-[0.8125rem] text-(--ui-text-secondary) hover:border-(--ui-text-tertiary) hover:text-foreground"
                key={id}
                onClick={() => setEditing({ draft: PRESETS[id](k) })}
                type="button"
              >
                <Codicon name={PRESET_ICON[id]} size="0.95rem" />
                {PRESETS[id](k).name}
              </button>
            ))}
          </div>
        </section>
      )}
      {data.rules.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {data.rules.map(rule => (
            <RuleCard
              k={k}
              key={rule.id}
              onEdit={() => setEditing({ draft: (({ id: _id, ...rest }) => rest)(rule), id: rule.id })}
              rule={rule}
            />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-[0.8125rem] text-(--ui-text-tertiary)">{k.rules.empty}</p>
      )}
      {editing && <RuleEditor initial={editing.draft} k={k} onClose={() => setEditing(null)} ruleId={editing.id} />}
    </div>
  )
}
