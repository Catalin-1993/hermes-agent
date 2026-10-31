/**
 * "How your team works", beside the chart on the Agents page: how work moves (you decide, leads split and check,
 * executors do), then the team as a short indented outline — who sits under whom, with each agent's role — and
 * who has no place yet. It folds to one line once read.
 */

import { cn, Codicon } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { ORG } from './org-copy'
import { type OrgLevel, orgLevels, type OrgNode } from './org-model'
import type { KanbanProfile } from './types'
import { Avatar } from './ui'

const STORY = {
  title: 'How your team works',
  flow: [
    { icon: 'account', text: 'You set the goals and make the calls.' },
    { icon: 'type-hierarchy-sub', text: 'Leads split the work and check it.' },
    { icon: 'tools', text: 'Executors do the work and report back.' },
    { icon: 'inbox', text: 'Questions and approvals come to your Inbox.' }
  ],
  team: 'Your team',
  loose: 'Not placed yet',
  looseHint: 'Drag onto a lead, or use ⋯ on the card.',
  show: 'Show',
  hide: 'Hide'
}

const LEVEL_TONE: Record<OrgLevel, string> = {
  executor: 'var(--ui-text-tertiary)',
  lead: '#a78bfa',
  team: '#60a5fa'
}

function Person({ depth, level, profile }: { depth: number; level?: OrgLevel; profile: KanbanProfile }) {
  return (
    <li className="relative flex min-w-0 items-center gap-2 py-1" style={{ paddingLeft: `${depth * 1.125}rem` }}>
      {depth > 0 && (
        <span
          aria-hidden
          className="absolute top-0 h-1/2 w-2 rounded-bl-md border-b border-l border-(--ui-stroke-secondary)"
          style={{ left: `${depth * 1.125 - 0.75}rem` }}
        />
      )}
      <Avatar name={profile.name} size="1.25rem" />
      <span className="min-w-0 flex-1 truncate text-[0.8125rem]">
        <span className="font-medium text-foreground">{profile.display_name || profile.name}</span>
        {profile.title && <span className="text-(--ui-text-tertiary)"> · {profile.title}</span>}
      </span>
      {level && (
        <span
          className="shrink-0 text-[0.625rem] font-semibold tracking-wide uppercase"
          style={{ color: LEVEL_TONE[level] }}
        >
          {ORG.level[level]}
        </span>
      )}
    </li>
  )
}

function Outline({
  depth,
  levels,
  nodes
}: {
  depth: number
  levels: Map<string, OrgLevel>
  nodes: readonly OrgNode[]
}) {
  return (
    <>
      {nodes.map(node => (
        <Branch depth={depth} key={node.profile.name} levels={levels} node={node} />
      ))}
    </>
  )
}

function Branch({ depth, levels, node }: { depth: number; levels: Map<string, OrgLevel>; node: OrgNode }) {
  return (
    <>
      <Person depth={depth} level={levels.get(node.profile.name)} profile={node.profile} />
      <Outline depth={depth + 1} levels={levels} nodes={node.reports} />
    </>
  )
}

export function TeamStory({ loose, trees }: { loose: KanbanProfile[]; trees: OrgNode[] }) {
  const [open, setOpen] = useState(true)
  const levels = orgLevels(trees)

  return (
    <section
      className="flex shrink-0 flex-col gap-2.5 rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) px-3.5 py-3"
      data-team-story=""
    >
      <button
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 text-left"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <Codicon className="text-(--ui-text-tertiary)" name="type-hierarchy" size="0.9rem" />
        <span className="text-[0.8125rem] font-semibold text-foreground">{STORY.title}</span>
        <span className="ml-auto text-[0.6875rem] text-(--ui-text-tertiary)">{open ? STORY.hide : STORY.show}</span>
        <Codicon className="text-(--ui-text-tertiary)" name={open ? 'chevron-up' : 'chevron-down'} size="0.75rem" />
      </button>
      {open && (
        <>
          <ol className="flex flex-col gap-1.5">
            {STORY.flow.map((step, index) => (
              <li className="flex items-center gap-2.5 text-[0.75rem] text-(--ui-text-secondary)" key={step.text}>
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ui-bg-tertiary) text-[0.625rem] font-semibold text-foreground">
                  {index + 1}
                </span>
                {step.text}
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-0.5 border-t border-(--ui-stroke-tertiary) pt-2.5">
            <span className="text-[0.625rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
              {STORY.team}
            </span>
            <ul className="flex flex-col">
              <li className="flex items-center gap-2 py-1 text-[0.8125rem]">
                <span className="grid size-5 place-items-center rounded-full bg-(--ui-control-active-background) text-foreground">
                  <Codicon name="account" size="0.7rem" />
                </span>
                <span className="flex-1 font-medium text-foreground">{ORG.ceo.name}</span>
                <span className="text-[0.625rem] font-semibold tracking-wide text-foreground uppercase">
                  {ORG.ceo.level}
                </span>
              </li>
              <Outline depth={1} levels={levels} nodes={trees} />
            </ul>
          </div>
          {loose.length > 0 && (
            <div className={cn('flex flex-col gap-1 border-t border-(--ui-stroke-tertiary) pt-2.5')}>
              <span className="text-[0.625rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
                {STORY.loose}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {loose.map(profile => (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-(--ui-bg-tertiary) py-0.5 pr-2 pl-0.5 text-[0.75rem] text-foreground"
                    key={profile.name}
                  >
                    <Avatar name={profile.name} size="1.05rem" />
                    {profile.name}
                  </span>
                ))}
              </div>
              <span className="text-[0.6875rem] text-(--ui-text-tertiary)">{STORY.looseHint}</span>
            </div>
          )}
        </>
      )}
    </section>
  )
}
