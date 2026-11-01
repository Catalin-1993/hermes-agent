/**
 * The New agent wizard's state and what pressing Create Agent does, kept free of React so it can be tested.
 *
 * A new agent is a Hermes profile: `profiles.create` makes it (cloned from the default profile, so it starts with
 * your keys and settings, never your messaging bots), `profiles.configure` narrows its tools, integrations and
 * skills, `config set` (via `cli.exec`) sets what has no configure field (reasoning effort, memory), and the Kanban
 * routes place it in the team (title, manager), give it a monthly budget and a check-in schedule. Only steps whose
 * choice differs from what the profile already starts with run.
 */

export const WIZARD_STEPS = ['identity', 'model', 'tools', 'invocations', 'knowledge'] as const

export type WizardStep = (typeof WIZARD_STEPS)[number]

/** One switchable thing in a list (a toolset, an MCP integration, a skill). */
export interface Toggle {
  description?: string
  enabled: boolean
  label?: string
  name: string
  /** Tools a toolset brings (toolsets only). */
  count?: number
}

/** What the clone source starts with: the lists the Tools and Knowledge steps show, as they would be. */
export interface WizardBase {
  integrations: Toggle[]
  skills: Toggle[]
  toolsets: Toggle[]
}

export interface Schedule {
  enabled: boolean
  endHour: number
  everyMinutes: number
  startHour: number
  weekdaysOnly: boolean
}

export interface WizardDraft {
  name: string
  description: string
  title: string
  reportsTo: string
  soul: string
  model: string
  provider: string
  /** '' = keep the default profile's depth. */
  effort: string
  /** '' = no cap. */
  budget: string
  toolsets: Record<string, boolean>
  integrations: Record<string, boolean>
  skills: Record<string, boolean>
  schedule: Schedule
  memory: boolean
  userProfile: boolean
}

export const EMPTY_DRAFT: WizardDraft = {
  name: '',
  description: '',
  title: '',
  reportsTo: '',
  soul: '',
  model: '',
  provider: '',
  effort: '',
  budget: '',
  toolsets: {},
  integrations: {},
  skills: {},
  schedule: { enabled: false, endHour: 18, everyMinutes: 60, startHour: 9, weekdaysOnly: true },
  memory: true,
  userProfile: true
}

/** Same rule as `hermes_constants.PROFILE_ID_RE` plus the reserved names `hermes_cli.profiles` refuses. */
const PROFILE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/

const RESERVED = new Set([
  'hermes',
  'default',
  'test',
  'tmp',
  'root',
  'sudo',
  'chat',
  'model',
  'gateway',
  'setup',
  'whatsapp',
  'login',
  'logout',
  'status',
  'cron',
  'doctor',
  'dump',
  'config',
  'pairing',
  'skills',
  'tools',
  'mcp',
  'connectors',
  'sessions',
  'insights',
  'version',
  'update',
  'uninstall',
  'profile',
  'plugins',
  'honcho',
  'acp'
])

/** The profile id a typed name becomes: lower case, spaces and odd marks to dashes. */
export const agentSlug = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|-+$/g, '')
    .slice(0, 64)

export type NameProblem = 'empty' | 'invalid' | 'reserved' | 'taken'

export function nameProblem(name: string, taken: readonly string[]): NameProblem | null {
  const slug = agentSlug(name)

  if (!name.trim()) {
    return 'empty'
  }

  if (!PROFILE_ID.test(slug)) {
    return 'invalid'
  }

  if (RESERVED.has(slug)) {
    return 'reserved'
  }

  return taken.includes(slug) ? 'taken' : null
}

/** Whether a toggle is on in the draft: the user's pick, else what the profile starts with. */
export const isOn = (picks: Record<string, boolean>, item: Toggle) => picks[item.name] ?? item.enabled

export const countOn = (picks: Record<string, boolean>, items: readonly Toggle[]) =>
  items.filter(item => isOn(picks, item)).length

/** All on, or all off: the All / None buttons. */
export const setAll = (items: readonly Toggle[], on: boolean) =>
  Object.fromEntries(items.map(item => [item.name, on])) as Record<string, boolean>

const changed = (picks: Record<string, boolean>, items: readonly Toggle[]) =>
  items.some(item => isOn(picks, item) !== item.enabled)

/** The `profiles.configure` fields, only for the lists the user changed. */
export function configurePatch(draft: WizardDraft, base: WizardBase) {
  const patch: Record<string, string[]> = {}

  if (changed(draft.toolsets, base.toolsets)) {
    patch.enabled_toolsets = base.toolsets.filter(item => isOn(draft.toolsets, item)).map(item => item.name)
  }

  if (changed(draft.integrations, base.integrations)) {
    patch.enabled_mcp_servers = base.integrations.filter(item => isOn(draft.integrations, item)).map(item => item.name)
  }

  if (changed(draft.skills, base.skills)) {
    patch.disabled_skills = base.skills.filter(item => !isOn(draft.skills, item)).map(item => item.name)
  }

  return patch
}

/** `hermes config set` pairs for what configure has no field for. */
export function configSets(draft: WizardDraft): [string, string][] {
  const sets: [string, string][] = []

  if (draft.effort.trim()) {
    sets.push(['agent.reasoning_effort', draft.effort.trim()])
  }

  if (!draft.memory) {
    sets.push(['memory.memory_enabled', 'false'])
  }

  if (!draft.userProfile) {
    sets.push(['memory.user_profile_enabled', 'false'])
  }

  return sets
}

/** A positive dollar amount, or null for no cap (blank, zero, or not a number). */
export function budgetUsd(text: string): null | number {
  const value = Number(text.replace(',', '.').replace(/[$\s]/g, ''))

  return text.trim() && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
}

/** Everything Create Agent sends, in order. */
export function createPlan(draft: WizardDraft, base: WizardBase) {
  const name = agentSlug(draft.name)
  const model = draft.model.trim()
  const provider = draft.provider.trim()

  return {
    name,
    create: {
      name,
      clone_from: 'default',
      description: draft.description.trim(),
      share_auth: true,
      ...(draft.soul.trim() ? { soul: draft.soul.trim() } : {}),
      ...(model && provider ? { model, provider } : {})
    },
    configure: configurePatch(draft, base),
    sets: configSets(draft),
    org: { reports_to: draft.reportsTo, title: draft.title.trim() },
    budget: budgetUsd(draft.budget),
    rhythm: draft.schedule.enabled
      ? {
          enabled: true,
          end_hour: draft.schedule.endHour,
          every_minutes: draft.schedule.everyMinutes,
          start_hour: draft.schedule.startHour,
          weekdays_only: draft.schedule.weekdaysOnly
        }
      : null
  }
}

export type CreatePlan = ReturnType<typeof createPlan>

/** The steps a draft still blocks on: only Identity has a required field (the name). */
export const stepReady = (step: WizardStep, problem: NameProblem | null) => step !== 'identity' || problem === null
