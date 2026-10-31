/**
 * "How your team works": the chain of command in plain sentences, under the toolbar of the Agents page — you are
 * the CEO, who directs whom, and who does the hands-on work. It folds to one line once read.
 */

import { cn, Codicon } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { ORG } from './org-copy'
import { type OrgNode, teamStory } from './org-model'
import type { KanbanProfile } from './types'
import { Avatar } from './ui'

const STORY = {
  title: 'How your team works',
  you: 'You are the CEO. Agents work for you; anything above their role comes to your Inbox.',
  directs: 'directs',
  doers: 'do the hands-on work and report to their lead.',
  loose: 'have no place yet — use ⋯ on their card to give them a manager.',
  show: 'Show',
  hide: 'Hide'
}

function Name({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-foreground">
      <Avatar name={name} size="0.95rem" />
      {name}
    </span>
  )
}

function List({ names }: { names: readonly string[] }) {
  return (
    <>
      {names.map((name, index) => (
        <span key={name}>
          {index > 0 && (index === names.length - 1 ? ' and ' : ', ')}
          <Name name={name} />
        </span>
      ))}
    </>
  )
}

export function TeamStory({ loose, trees }: { loose: KanbanProfile[]; trees: OrgNode[] }) {
  const [open, setOpen] = useState(true)
  const { doers, leads } = teamStory(trees)

  return (
    <section
      className="flex shrink-0 flex-col gap-2 rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) px-4 py-3"
      data-team-story=""
    >
      <button
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 text-left"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <Codicon className="text-(--ui-text-tertiary)" name="type-hierarchy" size="0.95rem" />
        <span className="text-[0.75rem] font-semibold tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
          {STORY.title}
        </span>
        <span className="ml-auto text-[0.75rem] text-(--ui-text-tertiary)">{open ? STORY.hide : STORY.show}</span>
        <Codicon className="text-(--ui-text-tertiary)" name={open ? 'chevron-up' : 'chevron-down'} size="0.8rem" />
      </button>
      {open && (
        <ol className={cn('flex flex-col gap-1.5 text-[0.8125rem] leading-relaxed text-(--ui-text-secondary)')}>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 rounded bg-(--ui-control-active-background) px-1.5 text-[0.625rem] font-bold tracking-wider text-foreground">
              {ORG.ceo.level}
            </span>
            {STORY.you}
          </li>
          {leads.map(line => (
            <li className="flex flex-wrap items-center gap-x-1.5" key={line.lead}>
              <span className="text-[0.625rem] font-semibold tracking-wider text-(--ui-text-tertiary) uppercase">
                {ORG.level[line.level]}
              </span>
              <Name name={line.lead} />
              {STORY.directs}
              <List names={line.reports} />
            </li>
          ))}
          {doers.length > 0 && (
            <li className="flex flex-wrap items-center gap-x-1.5">
              <span className="text-[0.625rem] font-semibold tracking-wider text-(--ui-text-tertiary) uppercase">
                {ORG.level.executor}s
              </span>
              <List names={doers} /> {STORY.doers}
            </li>
          )}
          {loose.length > 0 && (
            <li className="flex flex-wrap items-center gap-x-1.5 text-(--ui-text-tertiary)">
              <List names={loose.map(profile => profile.name)} /> {STORY.loose}
            </li>
          )}
        </ol>
      )}
    </section>
  )
}
