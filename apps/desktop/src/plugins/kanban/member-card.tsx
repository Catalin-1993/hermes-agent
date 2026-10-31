/**
 * One agent as a card, the same in the hierarchy and in the card grid: who it is and where it sits (level, title),
 * how it is doing (status), what it is on and last finished, and — in the detailed look — its load, its last two
 * weeks of runs, its spend against its budget, and the controls (pause, stop, budget). A ⋯ menu opens its file or
 * moves it under another manager, so the chart can be reshaped without dragging.
 */

import {
  Button,
  cn,
  Codicon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@hermes/plugin-sdk'
import type { HTMLAttributes } from 'react'

import { AgentActions, BudgetMeter, Sparkline, type Status, STATUS_TONE } from './agents-view'
import { $agentFile } from './api'
import { ORG } from './org-copy'
import { type AgentWork, type OrgLevel } from './org-model'
import type { TeamRow } from './overview-model'
import { cadenceLabel } from './rhythm-tab'
import { TEAM } from './team-copy'
import type { AgentControl, AgentRhythm, KanbanProfile } from './types'
import { ago, Avatar, type KanbanText } from './ui'

export interface MemberProps {
  color: string
  /** Handlers that make the card draggable and a drop target (the hierarchy); none in the grid. */
  dnd?: HTMLAttributes<HTMLElement> & { draggable?: boolean }
  control?: AgentControl
  dense: boolean
  dragging?: boolean
  highlight?: boolean
  k: KanbanText
  level?: OrgLevel
  /** Managers it may report to (never itself or someone under it). */
  managers: KanbanProfile[]
  onMove: (manager: string) => void
  profile: KanbanProfile
  rhythm?: AgentRhythm
  row?: TeamRow
  runs: number[]
  status: Status
  work: AgentWork
}

function MoveMenu({ managers, onMove, profile }: Pick<MemberProps, 'managers' | 'onMove' | 'profile'>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={TEAM.menu.more}
          className="size-7 shrink-0 text-(--ui-text-tertiary)"
          onClick={event => event.stopPropagation()}
          size="icon-xs"
          variant="ghost"
        >
          <Codicon name="ellipsis" size="1rem" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem onSelect={() => $agentFile.set(profile.name)}>
          <Codicon name="note" size="0.85rem" />
          {TEAM.menu.open}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>{TEAM.menu.moveHeading}</DropdownMenuItem>
        {profile.reports_to && (
          <DropdownMenuItem onSelect={() => onMove('')}>
            <Codicon name="arrow-up" size="0.85rem" />
            {TEAM.menu.top}
          </DropdownMenuItem>
        )}
        {managers.map(manager => (
          <DropdownMenuItem key={manager.name} onSelect={() => onMove(manager.name)}>
            <Avatar name={manager.name} size="1rem" />
            {manager.name}
          </DropdownMenuItem>
        ))}
        {!profile.reports_to && managers.length === 0 && <DropdownMenuItem disabled>{TEAM.menu.none}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function WorkLines({ work }: { work: AgentWork }) {
  return (
    <div className="flex flex-col gap-1 text-[0.75rem]">
      <span className="flex gap-2">
        <span className="w-[4.75rem] shrink-0 text-(--ui-text-quaternary)">{TEAM.workingOn}</span>
        <span className={cn('min-w-0 truncate', work.working ? 'text-foreground' : 'text-(--ui-text-quaternary)')}>
          {work.working?.title ?? TEAM.nothingRunning}
        </span>
      </span>
      <span className="flex gap-2">
        <span className="w-[4.75rem] shrink-0 text-(--ui-text-quaternary)">{TEAM.lastFinished}</span>
        <span
          className={cn('min-w-0 truncate', work.last ? 'text-(--ui-text-secondary)' : 'text-(--ui-text-quaternary)')}
        >
          {work.last ? `${work.last.title}${work.last.at ? ` · ${ago(work.last.at)}` : ''}` : TEAM.nothingYet}
        </span>
      </span>
    </div>
  )
}

export function MemberCard(props: MemberProps) {
  const { color, control, dense, dnd, dragging, highlight, k, level, profile, rhythm, row, runs, status, work } = props
  const counts = ['running', 'queued', 'blocked', 'done'] as const

  return (
    <div
      className={cn(
        'group/member flex flex-col gap-3 rounded-2xl border bg-(--ui-bg-elevated) p-3.5 shadow-[0_1px_0_rgb(255_255_255/0.03)_inset] transition-[box-shadow,opacity,border-color,transform]',
        'border-(--ui-stroke-tertiary) hover:border-(--ui-stroke-secondary)',
        dense ? 'w-60 gap-2.5 p-3' : 'w-80',
        dragging && 'opacity-50'
      )}
      data-org-card={profile.name}
      // The whole card opens the agent's file; its own buttons (pause, stop, budget, ⋯) keep their jobs.
      onClick={event =>
        !(event.target as HTMLElement).closest('button, a, input, [role="menuitem"]') && $agentFile.set(profile.name)
      }
      style={{
        backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${color} 9%, transparent), transparent 55%)`,
        boxShadow: highlight ? `0 0 0 2px ${color}` : undefined
      }}
      {...dnd}
    >
      <div className="flex items-start gap-3">
        <button
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
          onClick={() => $agentFile.set(profile.name)}
          type="button"
        >
          <span className="relative shrink-0">
            <Avatar name={profile.name} size={dense ? '2.25rem' : '2.75rem'} />
            <span
              aria-hidden
              className={cn(
                'absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-(--ui-bg-elevated)',
                status === 'working' && 'animate-pulse'
              )}
              style={{ backgroundColor: STATUS_TONE[status] }}
            />
          </span>
          <span className="min-w-0 flex-1">
            {level && (
              <span className="block text-[0.625rem] font-semibold tracking-[0.1em] uppercase" style={{ color }}>
                {ORG.level[level]}
              </span>
            )}
            <span className="block truncate text-[1rem] leading-tight font-semibold text-foreground">
              {profile.name}
            </span>
            <span
              className={cn(
                'block truncate text-[0.8125rem]',
                profile.title ? 'text-(--ui-text-secondary)' : 'text-(--ui-text-quaternary) italic'
              )}
            >
              {profile.title || TEAM.noTitle}
            </span>
          </span>
        </button>
        <MoveMenu managers={props.managers} onMove={props.onMove} profile={profile} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium"
          style={{
            backgroundColor: `color-mix(in srgb, ${STATUS_TONE[status]} 14%, transparent)`,
            color: STATUS_TONE[status]
          }}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: STATUS_TONE[status] }} />
          {k.agents.status[status]}
        </span>
        {rhythm?.enabled && (
          <span className="inline-flex items-center gap-1 text-[0.6875rem] text-(--ui-text-tertiary)">
            <Codicon name="pulse" size="0.7rem" />
            {k.rhythm.chip(cadenceLabel(k, rhythm.every_minutes))}
          </span>
        )}
      </div>
      <WorkLines work={work} />
      {!dense && (
        <>
          <div className="grid grid-cols-4 gap-1 text-center">
            {counts.map(key => (
              <div className="rounded-lg bg-(--ui-bg-quinary) py-1.5" key={key}>
                <div className="text-[0.9375rem] font-semibold text-foreground tabular-nums">{row?.[key] ?? 0}</div>
                <div className="text-[0.5625rem] tracking-wide text-(--ui-text-quaternary) uppercase">
                  {k.overview.team[key]}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[0.625rem] tracking-wide text-(--ui-text-quaternary) uppercase">{k.agents.runs14}</div>
            <Sparkline color={color} values={runs} />
          </div>
          {control && <BudgetMeter agent={control} k={k} />}
        </>
      )}
      {control && (
        <footer className="-mx-1 flex flex-wrap items-center gap-1 border-t border-(--ui-stroke-tertiary) pt-2.5">
          <AgentActions agent={control} k={k} running={row?.running ?? 0} status={status} />
        </footer>
      )}
    </div>
  )
}
