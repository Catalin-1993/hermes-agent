/**
 * Ready-made teams, opened from the Org chart: pick a template, see who it brings (their titles,
 * who reports to whom, their budgets, which names are already yours) and the rules it adds to this
 * board, then create it in one step (`kanban_team_templates`). Existing agents are kept as they are.
 */

import {
  Button,
  cn,
  Codicon,
  Dialog,
  DialogContent,
  DialogTitle,
  host,
  useQuery,
  useQueryClient,
  useValue
} from '@hermes/plugin-sdk'
import { useState } from 'react'

import {
  $boardSlug,
  controlsKey,
  fetchTeamTemplates,
  installTeam,
  profilesKey,
  rulesKey,
  teamTemplatesKey,
  useKanbanScope
} from './api'
import type { TeamMember, TeamTemplate } from './types'
import { Avatar, errText, FIELD_LABEL, type KanbanText, usd, useKanban } from './ui'

type TemplateId = keyof KanbanText['teams']['names']

const named = (k: KanbanText, id: string) => k.teams.names[id as TemplateId] ?? id
const blurb = (k: KanbanText, id: string) => k.teams.blurbs[id as TemplateId] ?? ''

/** Members in reporting order: each manager, then (indented) whoever reports to it. */
function ordered(members: TeamMember[]): { depth: number; member: TeamMember }[] {
  const out: { depth: number; member: TeamMember }[] = []
  const names = new Set(members.map(member => member.name))

  const walk = (boss: string, depth: number) => {
    for (const member of members.filter(m => (names.has(m.reports_to) ? m.reports_to : '') === boss)) {
      out.push({ depth, member })
      walk(member.name, depth + 1)
    }
  }

  walk('', 0)

  return out
}

function TemplateCard({
  k,
  onPick,
  picked,
  template
}: {
  k: KanbanText
  onPick: () => void
  picked: boolean
  template: TeamTemplate
}) {
  return (
    <button
      aria-pressed={picked}
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
        picked
          ? 'border-(--ui-text-secondary) bg-(--ui-bg-quaternary)'
          : 'border-(--ui-stroke-tertiary) hover:border-(--ui-stroke-secondary)'
      )}
      data-team-template={template.id}
      onClick={onPick}
      type="button"
    >
      <span className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-(--ui-bg-quinary) text-(--ui-text-secondary)">
          <Codicon name={template.icon} size="1rem" />
        </span>
        <span className="text-[0.875rem] font-semibold text-foreground">{named(k, template.id)}</span>
      </span>
      <span className="line-clamp-3 text-[0.75rem] leading-relaxed text-(--ui-text-tertiary)">{blurb(k, template.id)}</span>
      <span className="flex -space-x-1.5">
        {template.members.map(member => (
          <Avatar key={member.name} name={member.name} size="1.5rem" />
        ))}
      </span>
    </button>
  )
}

function TemplateDetail({ k, onDone, template }: { k: KanbanText; onDone: () => void; template: TeamTemplate }) {
  const qc = useQueryClient()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const [busy, setBusy] = useState(false)
  const fresh = template.members.filter(member => !member.exists).length

  const install = async () => {
    setBusy(true)

    try {
      const result = await installTeam(template.id)
      const changed = result.created.length + result.rules.length > 0
      host.notify({
        kind: 'success',
        message: changed ? k.teams.installed(result.created.length) : k.teams.nothingNew
      })

      for (const key of [profilesKey(scope), teamTemplatesKey(scope), controlsKey(scope, slug), rulesKey(scope, slug)]) {
        void qc.invalidateQueries({ queryKey: key })
      }

      onDone()
    } catch (error) {
      host.notify({ kind: 'error', message: errText(error) })
    }

    setBusy(false)
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className="flex flex-col gap-1.5">
        <div className={FIELD_LABEL}>{k.teams.members}</div>
        <ul className="flex flex-col gap-1">
          {ordered(template.members).map(({ depth, member }) => (
            <li
              className="flex items-center gap-2.5 rounded-md bg-(--ui-bg-quinary) px-2.5 py-2"
              key={member.name}
              style={{ marginLeft: `${depth * 1.25}rem` }}
            >
              <Avatar name={member.name} size="1.75rem" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium text-foreground">
                  {member.name} <span className="font-normal text-(--ui-text-tertiary)">· {member.title}</span>
                </span>
                <span className="block truncate text-[0.6875rem] text-(--ui-text-tertiary)">{member.description}</span>
              </span>
              {member.exists ? (
                <span className="shrink-0 text-[0.625rem] text-(--ui-text-quaternary)">{k.teams.exists}</span>
              ) : (
                member.budget_usd && (
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)">
                    {k.teams.perMonth(usd(member.budget_usd))}
                  </span>
                )
              )}
            </li>
          ))}
        </ul>
      </section>
      {template.rules.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <div className={FIELD_LABEL}>{k.teams.rules}</div>
          <ul className="flex flex-col gap-1">
            {template.rules.map(rule => (
              <li className="flex items-center gap-2 text-[0.75rem] text-(--ui-text-secondary)" key={rule.name}>
                <Codicon
                  className={rule.action === 'owner' ? 'text-[#fbbf24]' : 'text-[#60a5fa]'}
                  name={rule.action === 'owner' ? 'person' : 'verified'}
                  size="0.8rem"
                />
                {rule.name}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-[0.6875rem] text-(--ui-text-quaternary)">{k.teams.clones}</p>
      <div className="flex justify-end">
        <Button disabled={busy} onClick={() => void install()} size="sm">
          <Codicon name={fresh ? 'organization' : 'law'} size="0.8rem" />
          {busy ? k.teams.installing : fresh ? k.teams.install(fresh) : k.teams.addRules}
        </Button>
      </div>
    </div>
  )
}

function Gallery({ k, onClose }: { k: KanbanText; onClose: () => void }) {
  const scope = useKanbanScope()
  const { data } = useQuery({ queryFn: fetchTeamTemplates, queryKey: teamTemplatesKey(scope), staleTime: 60_000 })
  const [pickedId, setPickedId] = useState<null | string>(null)
  const templates = data?.templates ?? []
  const picked = templates.find(template => template.id === pickedId) ?? templates[0]

  return (
    <Dialog onOpenChange={open => !open && onClose()} open>
      <DialogContent
        aria-describedby={undefined}
        bodyClassName="flex max-h-[min(86vh,48rem)] flex-col gap-0 overflow-hidden p-0"
        className="w-[min(60rem,94vw)] max-w-none"
        data-team-gallery=""
      >
        <header className="flex flex-col gap-1 px-5 pt-5 pb-3">
          <DialogTitle className="text-lg font-semibold">{k.teams.title}</DialogTitle>
          <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{k.teams.intro}</p>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 pb-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {templates.map(template => (
              <TemplateCard
                k={k}
                key={template.id}
                onPick={() => setPickedId(template.id)}
                picked={template === picked}
                template={template}
              />
            ))}
          </div>
          {picked && (
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-foreground">{named(k, picked.id)}</h3>
              <TemplateDetail k={k} key={picked.id} onDone={onClose} template={picked} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The Org chart's "Add a ready-made team" button (or the empty chart's call to action). */
export function TeamGalleryButton({ cta = false }: { cta?: boolean }) {
  const k = useKanban()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant={cta ? 'default' : 'outline'}>
        <Codicon name="organization" size="0.8rem" />
        {cta ? k.teams.emptyCta : k.teams.add}
      </Button>
      {open && <Gallery k={k} onClose={() => setOpen(false)} />}
    </>
  )
}
