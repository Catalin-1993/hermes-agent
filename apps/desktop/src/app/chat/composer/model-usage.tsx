/**
 * Brain: how full this chat's context is and what it has used, beside the composer's model pill.
 *
 * - `ContextRing`: a small ring in front of the model name that fills as the context does, live.
 * - `ModelUsageHeader`: the top of the model menu — the context (bar, tokens, Compact) and the usage (this chat's
 *   tokens and cost, and the plan's allowance when the provider has one), above the model list.
 *
 * The figures are the ones the status bar's meters show: this surface's session usage (streamed with every turn),
 * with the measured / estimated context breakdown taking over when the backend has one (a resumed chat that has not
 * spoken yet still knows how full it is). Compact is the status bar's own action, with its confirmation.
 */

import './model-usage.css'

import { compactNumber, gaugeTitle } from '@hermes/shared'
import { useStore } from '@nanostores/react'
import { useCallback, useContext, useMemo } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { useCompactConversation } from '@/app/shell/hooks/use-compact-conversation'
import { useContextBreakdown } from '@/app/shell/hooks/use-context-breakdown'
import { ModelMenuCloseContext } from '@/app/shell/model-menu-panel'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { Loader2 } from '@/lib/icons'
import { formatPercentUsed, formatResetsIn } from '@/lib/usage-percent'
import { useStoreSelector } from '@/lib/use-session-slice'
import { cn } from '@/lib/utils'
import { requestGatewayForActiveRoute } from '@/store/active-route-request'
import { $activeGatewayProfile } from '@/store/profile'
import { $currentUsage } from '@/store/session'
import { $sessionStates } from '@/store/session-states'
import type { UsageStats } from '@/types/hermes'

const EMPTY_USAGE: UsageStats = { calls: 0, input: 0, output: 0, total: 0 }

/** This surface's usage, with the context breakdown preferred for the context figures. */
function useSurfaceUsage(): { busy: boolean; sessionId: null | string; usage: UsageStats } {
  const view = useSessionView()
  const sessionId = useStore(view.$runtimeId)
  const busy = useStore(view.$busy)
  const profile = useStore($activeGatewayProfile)
  const primaryUsage = useStore($currentUsage)
  const tileUsage = useStoreSelector($sessionStates, states => (sessionId ? states[sessionId]?.usage : undefined))
  const primary = view.kind === 'primary'
  const usage = (primary ? primaryUsage : tileUsage) ?? EMPTY_USAGE

  const requestGateway = useCallback(
    <T,>(method: string, params?: Record<string, unknown>) => requestGatewayForActiveRoute<T>(profile, method, params),
    [profile]
  )

  const { breakdown } = useContextBreakdown({ busy, enabled: primary && Boolean(sessionId), requestGateway, sessionId })

  const merged = useMemo<UsageStats>(
    () =>
      breakdown && breakdown.context_max > 0
        ? {
            ...usage,
            context_estimated: breakdown.context_estimated,
            context_max: breakdown.context_max,
            context_percent: breakdown.context_percent,
            context_used: breakdown.context_used
          }
        : usage,
    [breakdown, usage]
  )

  return { busy, sessionId, usage: merged }
}

const percentOf = (usage: UsageStats) => Math.max(0, Math.min(100, usage.context_percent ?? 0))

/** Calm until it matters: the theme's text colour, amber past 75 %, red past 90 %. */
const toneOf = (percent: number) =>
  percent >= 90 ? 'var(--ui-red, #f85149)' : percent >= 75 ? 'var(--ui-yellow, #d29922)' : 'currentColor'

/** A ring that fills clockwise from the top with `percent`. */
export function ContextRing({ className, percent }: { className?: string; percent: number }) {
  const radius = 5.25
  const circumference = 2 * Math.PI * radius

  return (
    <svg aria-hidden className={cn('size-3.5 shrink-0 -rotate-90', className)} viewBox="0 0 14 14">
      <circle cx="7" cy="7" fill="none" r={radius} stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.75" />
      <circle
        className="transition-[stroke-dashoffset] duration-500 ease-out"
        cx="7"
        cy="7"
        fill="none"
        r={radius}
        stroke={toneOf(percent)}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

/** The pill's ring: this chat's context, live. */
export function ComposerContextRing() {
  const { usage } = useSurfaceUsage()

  return <ContextRing className="opacity-90" percent={percentOf(usage)} />
}

function Section({
  children,
  title,
  trailing
}: {
  children: React.ReactNode
  title: string
  trailing?: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 px-3 py-2.5">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-[0.6875rem] font-medium tracking-wide text-(--ui-text-tertiary) uppercase">{title}</h3>
        {trailing}
      </header>
      {children}
    </section>
  )
}

function Meter({ percent, tone }: { percent: number; tone?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-(--ui-stroke-tertiary)">
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ background: tone ?? 'var(--ui-text-secondary)', width: `${Math.max(percent > 0 ? 2 : 0, percent)}%` }}
      />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-(--ui-bg-quaternary,var(--chrome-action-hover)) px-2.5 py-2">
      <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary)">{label}</span>
      <span className="truncate text-[0.8125rem] font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

const money = (usd: number) =>
  usd >= 100 ? `$${usd.toFixed(0)}` : usd >= 1 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(3)}`

/** The model menu's head: Context, then Usage. */
export function ModelUsageHeader() {
  const { t } = useI18n()
  const copy = t.composer.modelUsage
  const plans = t.modelPicker
  const closeMenu = useContext(ModelMenuCloseContext)
  const { busy, sessionId, usage } = useSurfaceUsage()
  const compact = useCompactConversation({ busy, sessionId })
  const percent = percentOf(usage)
  const known = (usage.context_max ?? 0) > 0
  const gauge = usage.plan_gauge
  const planUsed = gauge ? Math.min(1, Math.max(0, gauge.used_bp / 10_000)) : 0
  const resetsIn = gauge ? formatResetsIn(gauge.resets_at_ms) : null

  const compactButton = compact.pending ? (
    <span className="inline-flex items-center gap-1 text-[0.6875rem] text-(--ui-text-tertiary)">
      <Loader2 className="size-3 animate-spin" />
      {copy.compacting}
    </span>
  ) : (
    <button
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] text-(--ui-text-secondary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      disabled={compact.busy || compact.unavailable || !known}
      onClick={() => {
        closeMenu?.()
        compact.onRequest()
      }}
      title={compact.busy ? copy.compactBusy : copy.compactHint}
      type="button"
    >
      <Codicon name="archive" size="0.6875rem" />
      {copy.compact}
    </button>
  )

  return (
    <div className="border-b border-(--ui-stroke-tertiary)" data-slot="model-usage-header">
      <Section title={copy.context} trailing={compactButton}>
        <div className="flex items-center gap-2.5">
          <ContextRing className="size-7 text-foreground" percent={percent} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[0.8125rem] font-medium text-foreground tabular-nums">
                {known ? `${usage.context_estimated ? '~' : ''}${Math.round(percent)}%` : '—'}
              </span>
              <span className="truncate text-[0.6875rem] text-(--ui-text-tertiary) tabular-nums">
                {known
                  ? copy.tokensOf(compactNumber(usage.context_used ?? 0), compactNumber(usage.context_max ?? 0))
                  : copy.noData}
              </span>
            </div>
            <Meter percent={percent} tone={percent >= 75 ? toneOf(percent) : undefined} />
          </div>
        </div>
      </Section>
      <Section title={copy.usage}>
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label={copy.thisChat} value={copy.tokens(compactNumber(usage.total ?? 0))} />
          <Stat label={copy.cost} value={usage.cost_usd ? money(usage.cost_usd) : '—'} />
        </div>
        {gauge && (
          <div className="flex flex-col gap-1.5 pt-0.5">
            <div className="flex items-baseline justify-between gap-2 text-[0.6875rem]">
              <span className="text-(--ui-text-secondary)">
                {gaugeTitle(
                  { label: gauge.id, title: gauge.label },
                  { day: plans.today, month: plans.month, top_tier: plans.topTier, week: plans.week }
                )}
              </span>
              <span className="text-(--ui-text-tertiary) tabular-nums">
                {formatPercentUsed(planUsed)}
                {resetsIn ? ` · ${copy.resetsIn(resetsIn)}` : ''}
              </span>
            </div>
            <Meter percent={planUsed * 100} tone={planUsed >= 0.75 ? toneOf(planUsed * 100) : 'var(--ui-accent)'} />
          </div>
        )}
      </Section>
    </div>
  )
}
