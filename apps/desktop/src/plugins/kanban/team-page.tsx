/**
 * The Agents page: the whole team in one place. Above, the board's controls (pause or stop everyone, this month's
 * spend); then one switch for how to look at the team — a hierarchy under you (the CEO) that fits the screen, or a
 * grid of cards — and for how much to show on each card. Every card carries what the two old pages split: level and
 * title, status, what it is on and last finished, its load and runs, its budget, and the controls (pause, stop,
 * budget); its ⋯ menu opens its file or moves it under another manager.
 */

import { cn, Codicon, SegmentedControl, useQuery, useValue } from '@hermes/plugin-sdk'
import { useLayoutEffect, useRef, useState } from 'react'

import { AGENT_PALETTE, chartColors, MasterControl, SpendRing, statusOf } from './agents-view'
import { $boardSlug, activityKey, fetchActivity, useKanbanScope } from './api'
import { useControls } from './inbox'
import { agentWork, canReportTo, flattenTree, orgLevels, orgTree } from './org-model'
import { ChartMember, type ChartState, ChartTree, useDragState, useOrgMove, useRoster } from './org-view'
import { teamRows } from './overview-model'
import { TEAM } from './team-copy'
import { TeamGalleryButton } from './team-gallery'
import { useRhythms } from './team-queries'
import type { KanbanBoard } from './types'
import { usd, useKanban } from './ui'

type Look = 'chart' | 'list'
type Detail = 'compact' | 'full'

const ZOOMS = [0.7, 0.85, 1, 1.15] as const
/** "Fit to screen" never shrinks the chart below this: smaller than that is unreadable, and the page scrolls. */
const MIN_SCALE = 0.7

/** The chart's scale: "fit" shrinks it to the room on screen (never below MIN_SCALE, never above 100%); a step is fixed. */
function useChartScale(fit: boolean, step: number) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) {
        return
      }

      if (!fit) {
        setScale(step)

        return
      }

      // The tree's natural size: measured at zoom 1 (put back before the browser paints).
      const el = inner.current
      const was = el.style.zoom
      el.style.zoom = '1'
      const { height, width } = el.getBoundingClientRect()
      el.style.zoom = was

      // Room on screen: the page's visible height from the chart's top, less the chart's own padding.
      const page = outer.current.parentElement!
      const top = outer.current.getBoundingClientRect().top + page.scrollTop - page.getBoundingClientRect().top
      const roomH = page.clientHeight - top - 16 - 56
      const roomW = outer.current.clientWidth - 8

      setScale(Math.max(MIN_SCALE, Math.min(1, roomW / width, roomH / height)))
    }

    measure()
    const observer = new ResizeObserver(measure)
    outer.current && observer.observe(outer.current)

    return () => observer.disconnect()
  })

  return { inner, outer, scale }
}

function Toolbar({
  detail,
  fit,
  look,
  setDetail,
  setFit,
  setLook,
  setStep,
  step
}: {
  detail: Detail
  fit: boolean
  look: Look
  setDetail: (detail: Detail) => void
  setFit: (fit: boolean) => void
  setLook: (look: Look) => void
  setStep: (step: number) => void
  step: number
}) {
  const index = ZOOMS.indexOf(step as (typeof ZOOMS)[number])

  const zoomBtn =
    'grid size-8 cursor-pointer place-items-center rounded-md text-(--ui-text-secondary) hover:bg-(--chrome-action-hover) hover:text-foreground disabled:opacity-40'

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SegmentedControl<Look>
        onChange={setLook}
        options={[
          { id: 'chart', label: TEAM.view.chart },
          { id: 'list', label: TEAM.view.list }
        ]}
        value={look}
      />
      <SegmentedControl<Detail>
        onChange={setDetail}
        options={[
          { id: 'compact', label: TEAM.detail.compact },
          { id: 'full', label: TEAM.detail.full }
        ]}
        value={detail}
      />
      {look === 'chart' && (
        <div className="flex items-center gap-0.5 rounded-lg bg-(--ui-bg-tertiary) p-0.5">
          <button
            aria-label={TEAM.zoom.out}
            className={zoomBtn}
            disabled={!fit && index <= 0}
            onClick={() => {
              setFit(false)
              setStep(ZOOMS[Math.max(0, (fit ? ZOOMS.indexOf(1) : index) - 1)]!)
            }}
            type="button"
          >
            <Codicon name="zoom-out" size="0.95rem" />
          </button>
          <button
            aria-pressed={fit}
            className={cn(
              zoomBtn,
              'w-auto px-2.5 text-[0.75rem] font-medium',
              fit && 'bg-background text-foreground shadow-sm'
            )}
            onClick={() => setFit(true)}
            type="button"
          >
            {TEAM.zoom.fit}
          </button>
          <button
            aria-label={TEAM.zoom.in}
            className={zoomBtn}
            disabled={!fit && index >= ZOOMS.length - 1}
            onClick={() => {
              setFit(false)
              setStep(ZOOMS[Math.min(ZOOMS.length - 1, (fit ? ZOOMS.indexOf(1) : index) + 1)]!)
            }}
            type="button"
          >
            <Codicon name="zoom-in" size="0.95rem" />
          </button>
        </div>
      )}
    </div>
  )
}

export function BoardTeam({ board }: { board: KanbanBoard; onOpen: (id: string) => void }) {
  const k = useKanban()
  const scope = useKanbanScope()
  const slug = useValue($boardSlug)
  const { data: roster } = useRoster()
  const { data: controls } = useControls()
  const { data: rhythms } = useRhythms()
  const move = useOrgMove()
  const drag = useDragState()
  const [look, setLook] = useState<Look>('chart')
  const [detail, setDetail] = useState<Detail>('compact')
  const [fit, setFit] = useState(true)
  const [step, setStep] = useState(1)

  const { data: activity } = useQuery({
    queryFn: fetchActivity,
    queryKey: activityKey(scope, slug),
    refetchInterval: 30_000
  })

  const { inner, outer, scale } = useChartScale(fit, step)

  if (!roster || !controls) {
    return <div className="grid flex-1 place-items-center text-[0.75rem] text-(--ui-text-quaternary)">…</div>
  }

  const profiles = roster.profiles
  const rows = new Map(teamRows(board).map(row => [row.name, row]))
  const agents = new Map(controls.agents.map(agent => [agent.profile, agent]))
  const colors = chartColors(controls.agents)
  const days = activity?.days.length ?? 14
  const events = activity?.events ?? []
  const { loose, trees } = orgTree(profiles)
  const levels = orgLevels(trees)
  const working = profiles.filter(profile => (rows.get(profile.name)?.running ?? 0) > 0).length
  const pausedCount = controls.agents.filter(agent => agent.paused).length
  const spent = controls.agents.reduce((sum, agent) => sum + (agent.month_spend_usd ?? 0), 0)

  const member: ChartState['member'] = profile => {
    const control = agents.get(profile.name)
    const row = rows.get(profile.name)

    return {
      color: colors.get(profile.name) ?? AGENT_PALETTE[0]!,
      control,
      dense: detail === 'compact',
      k,
      level: levels.get(profile.name),
      managers: profiles.filter(
        other =>
          other.name !== profile.name &&
          other.name !== profile.reports_to &&
          canReportTo(profiles, profile.name, other.name)
      ),
      onMove: manager => void move(profile.name, manager),
      profile,
      rhythm: rhythms?.rhythms[profile.name],
      row,
      runs: activity?.by_profile?.[profile.name] ?? Array.from({ length: days }, () => 0),
      status: control ? statusOf(control, row, controls.all_paused) : (row?.running ?? 0) > 0 ? 'working' : 'idle',
      work: agentWork(board, events, profile.name)
    }
  }

  const chart: ChartState = { ...drag, member, move: (name, manager) => void move(name, manager), profiles }

  if (!profiles.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{k.org.empty}</p>
        <TeamGalleryButton cta />
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-1 pb-6"
      data-kanban-agents=""
      data-kanban-org=""
    >
      <div className="grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <MasterControl board={board} controls={controls} k={k} />
        <SpendRing agents={controls.agents} colors={colors} k={k} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-(--ui-text-secondary)">
          <span className="text-[1rem] font-semibold text-foreground">{TEAM.agents(profiles.length)}</span>
          <span style={{ color: working ? '#34d399' : undefined }}>{TEAM.working(working)}</span>
          {pausedCount > 0 && <span style={{ color: '#fbbf24' }}>{TEAM.paused(pausedCount)}</span>}
          <span className="text-(--ui-text-tertiary) tabular-nums">{TEAM.spent(usd(spent))}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Toolbar
            detail={detail}
            fit={fit}
            look={look}
            setDetail={setDetail}
            setFit={setFit}
            setLook={setLook}
            setStep={setStep}
            step={step}
          />
          <TeamGalleryButton />
        </div>
      </div>
      <p className="-mt-2 shrink-0 text-[0.75rem] text-(--ui-text-tertiary)">{TEAM.hint}</p>
      {look === 'chart' ? (
        trees.length > 0 && (
          <section
            className="kanban-org shrink-0 overflow-x-auto rounded-2xl border border-(--ui-stroke-tertiary) py-7"
            ref={outer}
            style={{
              backgroundColor: 'var(--ui-bg-quinary)',
              backgroundImage:
                'radial-gradient(color-mix(in srgb, var(--ui-text-quaternary) 22%, transparent) 1px, transparent 1px)',
              backgroundSize: '18px 18px'
            }}
          >
            <div ref={inner} style={{ margin: '0 auto', width: 'max-content', zoom: scale }}>
              <ChartTree board={board} chart={chart} trees={trees} />
            </div>
          </section>
        )
      ) : (
        <div
          className="grid shrink-0 gap-4"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${detail === 'compact' ? '18rem' : '20rem'}, 1fr))` }}
        >
          {[...flattenTree(trees), ...loose].map(profile => (
            <ChartMember chart={chart} key={profile.name} profile={profile} />
          ))}
        </div>
      )}
      {look === 'chart' && loose.length > 0 && (
        <section className="flex shrink-0 flex-col gap-2.5">
          <div>
            <div className="text-[0.75rem] font-semibold tracking-wide text-(--ui-text-secondary) uppercase">
              {TEAM.loose.title}
            </div>
            <div className="text-[0.75rem] text-(--ui-text-tertiary)">{TEAM.loose.hint}</div>
          </div>
          <div className="flex flex-wrap gap-4">
            {loose.map(profile => (
              <ChartMember chart={chart} key={profile.name} profile={profile} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
