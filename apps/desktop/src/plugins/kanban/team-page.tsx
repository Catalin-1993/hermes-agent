/**
 * The Agents page: the whole team in one place. Above, the board's controls (pause or stop everyone, this month's
 * spend); then one quiet bar for how to look at the team — a hierarchy under you (the CEO) that fits the screen and
 * whose cards you can drag anywhere (`org-canvas`), or a grid of cards — and for how much to show on each card.
 * "How your team works" stands beside the chart and folds away to the right, giving the chart the room. Every card carries what the two old pages split: level and
 * title, status, what it is on and last finished, its load and runs, its budget, and the controls (pause, stop,
 * budget); its ⋯ menu opens its file or moves it under another manager.
 */

import { cn, Codicon, Tip, useQuery, useValue } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { AGENT_PALETTE, chartColors, MasterControl, SpendRing, statusOf } from './agents-view'
import { $boardSlug, $orgPlaced, activityKey, fetchActivity, useKanbanScope } from './api'
import { useControls } from './inbox'
import { clampZoom, MAX_ZOOM, MIN_ZOOM, OrgCanvas } from './org-canvas'
import { agentWork, canReportTo, flattenTree, orgLevels, type OrgNode, orgTree } from './org-model'
import { ChartMember, type ChartState, useDragState, useOrgMove, useRoster } from './org-view'
import { teamRows } from './overview-model'
import { TEAM } from './team-copy'
import { TeamGalleryButton } from './team-gallery'
import { useRhythms } from './team-queries'
import { TeamStory } from './team-story'
import type { KanbanBoard } from './types'
import { usd, useKanban } from './ui'

type Look = 'chart' | 'list'

const ICON_BTN =
  'grid h-6 min-w-6 cursor-pointer place-items-center rounded-md px-1 text-(--ui-text-secondary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent'

const Divider = () => <span aria-hidden className="mx-0.5 h-4 w-px bg-(--ui-stroke-tertiary)" />

function IconButton({
  icon,
  label,
  onClick,
  pressed,
  disabled
}: {
  disabled?: boolean
  icon: string
  label: string
  onClick: () => void
  pressed?: boolean
}) {
  return (
    <Tip label={label}>
      <button
        aria-label={label}
        aria-pressed={pressed}
        className={cn(ICON_BTN, pressed && 'bg-(--ui-control-active-background) text-foreground')}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        <Codicon name={icon} size="0.95rem" />
      </button>
    </Tip>
  )
}

interface ToolbarProps {
  arranged: boolean
  detailed: boolean
  look: Look
  onArrange: () => void
  scale: number
  setDetailed: (detailed: boolean) => void
  setLook: (look: Look) => void
  setZoom: (zoom: null | number) => void
  zoom: null | number
}

/** One quiet bar: the look (hierarchy or cards), the zoom, auto-arrange, and how much each card shows. */
function Toolbar({ arranged, detailed, look, onArrange, scale, setDetailed, setLook, setZoom, zoom }: ToolbarProps) {
  const lookBtn = (id: Look, label: string) => (
    <button
      aria-pressed={look === id}
      className={cn(
        'h-6 cursor-pointer rounded-md px-2.5 text-[0.75rem] font-medium transition-colors',
        look === id
          ? 'bg-(--ui-control-active-background) text-foreground'
          : 'text-(--ui-text-tertiary) hover:text-foreground'
      )}
      onClick={() => setLook(id)}
      type="button"
    >
      {label}
    </button>
  )

  return (
    <div
      className="flex h-8 items-center gap-0.5 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) px-1"
      data-team-toolbar=""
    >
      {lookBtn('chart', TEAM.view.chart)}
      {lookBtn('list', TEAM.view.list)}
      {look === 'chart' && (
        <>
          <Divider />
          <IconButton
            disabled={scale <= MIN_ZOOM}
            icon="remove"
            label={TEAM.zoom.out}
            onClick={() => setZoom(clampZoom(scale / 1.25))}
          />
          <Tip label={zoom === null ? TEAM.zoom.fitting : TEAM.zoom.fit}>
            <button
              aria-label={TEAM.zoom.fit}
              aria-pressed={zoom === null}
              className={cn(
                ICON_BTN,
                'w-12 text-[0.75rem] font-medium tabular-nums',
                zoom === null && 'text-foreground'
              )}
              onClick={() => setZoom(null)}
              type="button"
            >
              {Math.round(scale * 100)}%
            </button>
          </Tip>
          <IconButton
            disabled={scale >= MAX_ZOOM}
            icon="add"
            label={TEAM.zoom.in}
            onClick={() => setZoom(clampZoom(scale * 1.25))}
          />
          <Divider />
          <IconButton disabled={!arranged} icon="layout" label={TEAM.arrange} onClick={onArrange} />
        </>
      )}
      <Divider />
      <IconButton
        icon="list-flat"
        label={detailed ? TEAM.detail.hide : TEAM.detail.show}
        onClick={() => setDetailed(!detailed)}
        pressed={detailed}
      />
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
  const [scale, setScale] = useState(1)
  const placed = useValue($orgPlaced)
  const dense = !detailed
  const arranged = Object.keys(placed[dense ? 'dense' : 'detailed'] ?? {}).length > 0

  const { data: activity } = useQuery({
    queryFn: fetchActivity,
    queryKey: activityKey(scope, slug),
    refetchInterval: 30_000
  })

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
      dense,
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
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-6"
      data-kanban-agents=""
      data-kanban-org=""
    >
      <div className="grid shrink-0 gap-3 md:grid-cols-2">
        <MasterControl board={board} controls={controls} k={k} />
        <SpendRing agents={controls.agents} colors={colors} k={k} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.8125rem] text-(--ui-text-secondary)">
          <span className="text-[1rem] font-semibold text-foreground">{TEAM.agents(profiles.length)}</span>
          <span style={{ color: working ? '#34d399' : undefined }}>{TEAM.working(working)}</span>
          {pausedCount > 0 && <span style={{ color: '#fbbf24' }}>{TEAM.paused(pausedCount)}</span>}
          <span className="text-(--ui-text-tertiary) tabular-nums">{TEAM.spent(usd(spent))}</span>
        </div>
        <div className="flex items-center gap-2">
          <Toolbar
            arranged={arranged}
            detailed={detailed}
            look={look}
            onArrange={() => $orgPlaced.set({ ...placed, [dense ? 'dense' : 'detailed']: {} })}
            scale={scale}
            setDetailed={setDetailed}
            setLook={setLook}
            setZoom={setZoom}
            zoom={zoom}
          />
          <TeamGalleryButton />
        </div>
      </div>
      {look === 'chart' ? (
        <ChartArea
          board={board}
          chart={chart}
          dense={dense}
          loose={loose}
          onScale={setScale}
          setZoom={setZoom}
          trees={trees}
          zoom={zoom}
        />
      ) : (
        <>
          <TeamStory loose={loose} trees={trees} />
          <div
            className="grid shrink-0 gap-4"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${detailed ? '19rem' : '15rem'}, 1fr))` }}
          >
            {[...flattenTree(trees), ...loose].map(profile => (
              <ChartMember chart={chart} key={profile.name} profile={profile} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** The chart with "How your team works" beside it (under it on narrower screens), and the agents not placed yet. */
function ChartArea({
  board,
  chart,
  dense,
  loose,
  onScale,
  setZoom,
  trees,
  zoom
}: {
  board: KanbanBoard
  chart: ChartState
  dense: boolean
  loose: ChartState['profiles']
  onScale: (scale: number) => void
  setZoom: (zoom: null | number) => void
  trees: OrgNode[]
  zoom: null | number
}) {
  const [storyOpen, setStoryOpen] = useState(true)

  return (
    <>
      {trees.length > 0 && (
        <div
          className={cn(
            'grid shrink-0 gap-3',
            storyOpen ? 'xl:grid-cols-[minmax(0,1fr)_19rem]' : 'xl:grid-cols-[minmax(0,1fr)_2.75rem]'
          )}
        >
          <section
            className="h-[max(26rem,calc(100dvh-19rem))] overflow-hidden rounded-2xl border border-(--ui-stroke-tertiary)"
            style={{
              backgroundColor: 'var(--ui-bg-quinary)',
              backgroundImage:
                'radial-gradient(color-mix(in srgb, var(--ui-text-quaternary) 22%, transparent) 1px, transparent 1px)',
              backgroundSize: '18px 18px'
            }}
          >
            <OrgCanvas
              board={board}
              chart={chart}
              dense={dense}
              onScale={onScale}
              setZoom={setZoom}
              trees={trees}
              zoom={zoom}
            />
          </section>
          <div className="xl:relative">
            <div className="xl:absolute xl:inset-0">
              <TeamStory loose={loose} onToggle={() => setStoryOpen(!storyOpen)} open={storyOpen} side trees={trees} />
            </div>
          </div>
        </div>
      )}
      {loose.length > 0 && (
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
    </>
  )
}
