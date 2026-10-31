/**
 * The Agents page: the whole team in one place. Above, the board's controls (pause or stop everyone, this month's
 * spend); then one switch for how to look at the team — a hierarchy under you (the CEO) that fits the screen, or a
 * grid of cards — and for how much to show on each card. Every card carries what the two old pages split: level and
 * title, status, what it is on and last finished, its load and runs, its budget, and the controls (pause, stop,
 * budget); its ⋯ menu opens its file or moves it under another manager.
 */

import { cn, Codicon, SegmentedControl, Tip, useQuery, useValue } from '@hermes/plugin-sdk'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { AGENT_PALETTE, chartColors, MasterControl, SpendRing, statusOf } from './agents-view'
import { $boardSlug, activityKey, fetchActivity, useKanbanScope } from './api'
import { useControls } from './inbox'
import { agentWork, canReportTo, flattenTree, orgLevels, orgTree } from './org-model'
import { ChartMember, type ChartState, ChartTree, useDragState, useOrgMove, useRoster } from './org-view'
import { teamRows } from './overview-model'
import { TEAM } from './team-copy'
import { TeamGalleryButton } from './team-gallery'
import { useRhythms } from './team-queries'
import { TeamStory } from './team-story'
import type { KanbanBoard } from './types'
import { usd, useKanban } from './ui'

type Look = 'chart' | 'list'

/** The chart's zoom range: from the whole team at a glance to one card up close. */
const MIN_ZOOM = 0.3
const MAX_ZOOM = 2
const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))

/** The chart's scale: `null` fits it to the room on screen (down to MIN_ZOOM, never above 100%); a number is fixed.
 *  Ctrl/⌘ + mouse wheel over the chart zooms in and out. */
function useChartScale(zoom: null | number, setZoom: (zoom: number) => void) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) {
        return
      }

      if (zoom !== null) {
        setScale(zoom)

        return
      }

      // The tree's natural size: measured at zoom 1 (put back before the browser paints).
      const el = inner.current
      const was = el.style.zoom
      el.style.zoom = '1'
      const { height, width } = el.getBoundingClientRect()
      el.style.zoom = was

      // Room on screen: the page's visible height from the chart's top, less the chart's own padding.
      const page = (outer.current.closest('[data-kanban-agents]') as HTMLElement | null) ?? outer.current.parentElement!
      const top = outer.current.getBoundingClientRect().top + page.scrollTop - page.getBoundingClientRect().top
      const roomH = page.clientHeight - top - 16 - 40
      const roomW = outer.current.clientWidth - 8

      const next = Math.max(MIN_ZOOM, Math.min(1, roomW / width, roomH / height))

      // A scrollbar coming and going can nudge the room by a few pixels: ignore changes that small.
      setScale(current => (Math.abs(current - next) < 0.02 ? current : next))
    }

    measure()
    const observer = new ResizeObserver(measure)
    outer.current && observer.observe(outer.current)

    return () => observer.disconnect()
  })

  useEffect(() => {
    const el = outer.current

    if (!el) {
      return
    }

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        setZoom(clampZoom(scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12)))
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })

    return () => el.removeEventListener('wheel', onWheel)
  }, [scale, setZoom])

  return { inner, outer, scale }
}

function Toolbar({
  detailed,
  look,
  scale,
  setDetailed,
  setLook,
  setZoom,
  zoom
}: {
  detailed: boolean
  look: Look
  scale: number
  setDetailed: (detailed: boolean) => void
  setLook: (look: Look) => void
  setZoom: (zoom: null | number) => void
  zoom: null | number
}) {
  const zoomBtn =
    'grid size-8 cursor-pointer place-items-center rounded-md text-(--ui-text-secondary) hover:bg-(--chrome-action-hover) hover:text-foreground disabled:opacity-40'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl<Look>
        onChange={setLook}
        options={[
          { id: 'chart', label: TEAM.view.chart },
          { id: 'list', label: TEAM.view.list }
        ]}
        value={look}
      />
      {look === 'chart' && (
        <div className="flex items-center gap-0.5 rounded-lg bg-(--ui-bg-tertiary) p-0.5">
          <Tip label={TEAM.zoom.out}>
            <button
              aria-label={TEAM.zoom.out}
              className={zoomBtn}
              disabled={scale <= MIN_ZOOM}
              onClick={() => setZoom(clampZoom(scale / 1.25))}
              type="button"
            >
              <Codicon name="zoom-out" size="0.95rem" />
            </button>
          </Tip>
          <Tip label={zoom === null ? TEAM.zoom.fitting : TEAM.zoom.fit}>
            <button
              aria-label={TEAM.zoom.fit}
              aria-pressed={zoom === null}
              className={cn(
                zoomBtn,
                'w-auto min-w-14 px-2 text-[0.75rem] font-medium tabular-nums',
                zoom === null && 'bg-background text-foreground shadow-sm'
              )}
              onClick={() => setZoom(null)}
              type="button"
            >
              {zoom === null ? TEAM.zoom.fitShort : `${Math.round(scale * 100)}%`}
            </button>
          </Tip>
          <Tip label={TEAM.zoom.in}>
            <button
              aria-label={TEAM.zoom.in}
              className={zoomBtn}
              disabled={scale >= MAX_ZOOM}
              onClick={() => setZoom(clampZoom(scale * 1.25))}
              type="button"
            >
              <Codicon name="zoom-in" size="0.95rem" />
            </button>
          </Tip>
        </div>
      )}
      <Tip label={detailed ? TEAM.detail.hide : TEAM.detail.show}>
        <button
          aria-label={detailed ? TEAM.detail.hide : TEAM.detail.show}
          aria-pressed={detailed}
          className={cn(
            'grid size-9 cursor-pointer place-items-center rounded-lg text-(--ui-text-secondary) hover:bg-(--chrome-action-hover) hover:text-foreground',
            detailed && 'bg-(--ui-control-active-background) text-foreground'
          )}
          onClick={() => setDetailed(!detailed)}
          type="button"
        >
          <Codicon name="list-flat" size="1rem" />
        </button>
      </Tip>
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
  const [detailed, setDetailed] = useState(false)
  const [zoom, setZoom] = useState<null | number>(null)

  const { data: activity } = useQuery({
    queryFn: fetchActivity,
    queryKey: activityKey(scope, slug),
    refetchInterval: 30_000
  })

  const { inner, outer, scale } = useChartScale(zoom, setZoom)

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
      dense: !detailed,
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
      <div className="grid shrink-0 gap-3 md:grid-cols-2">
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
            detailed={detailed}
            look={look}
            scale={scale}
            setDetailed={setDetailed}
            setLook={setLook}
            setZoom={setZoom}
            zoom={zoom}
          />
          <TeamGalleryButton />
        </div>
      </div>
      {look === 'list' && <TeamStory loose={loose} trees={trees} />}
      {look === 'chart' ? (
        trees.length > 0 && (
          // The chart takes the width; the story of who directs whom stands beside it.
          <div className="grid shrink-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <section
              className="kanban-org shrink-0 overflow-x-auto rounded-2xl border border-(--ui-stroke-tertiary) py-5"
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
            <TeamStory loose={loose} trees={trees} />
          </div>
        )
      ) : (
        <div
          className="grid shrink-0 gap-4"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${detailed ? '19rem' : '15rem'}, 1fr))` }}
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
