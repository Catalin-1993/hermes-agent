/**
 * Workflows data layer: the plugin's own `/api/plugins/workflows/*` router
 * (`plugins/workflows/dashboard/plugin_api.py`), reached through `ctx.rest`.
 */

import { host, type PluginRestOptions } from '@hermes/plugin-sdk'

type Rest = <T>(path: string, opts?: PluginRestOptions) => Promise<T>

let rest: null | Rest = null

export function bindWorkflowsApi(next: Rest): () => void {
  rest = next

  return () => {
    rest = null
  }
}

function call<T>(path: string, opts?: PluginRestOptions): Promise<T> {
  return rest ? rest<T>(path, opts) : Promise.reject(new Error('workflows api not ready'))
}

export type TriggerType = 'discord' | 'github' | 'manual' | 'schedule' | 'slack' | 'telegram' | 'webhook'
export type ScheduleMode = 'cron' | 'daily' | 'hourly' | 'weekdays' | 'weekly'
export type StepKind = 'agent' | 'answer' | 'approval' | 'condition' | 'image' | 'llm' | 'output' | 'video'
export type VisualKind = 'note' | 'shape' | 'text'
export type NodeKind = 'trigger' | StepKind | VisualKind
export type AnswerFieldType = 'boolean' | 'list' | 'number' | 'text'
export type OutputChannel = 'chat' | 'discord' | 'github' | 'notification' | 'slack' | 'telegram'
export type NoteColor = 'blue' | 'default' | 'green' | 'orange' | 'purple' | 'red' | 'yellow'
export type ShapeKind = 'diamond' | 'ellipse' | 'rectangle'
export type ImageAspect = 'landscape' | 'portrait' | 'square'

export const VIDEO_ASPECTS = ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9'] as const
export const VIDEO_RESOLUTIONS = ['480p', '540p', '720p', '768p', '1080p'] as const

export interface Schedule {
  cron: string
  minute: number
  mode: ScheduleMode
  time: string
  weekday: number
}

export interface AnswerField {
  key: string
  label: string
  options: string[]
  required: boolean
  type: AnswerFieldType
}

export interface NodeConfigs {
  agent: { agent: string; task: string; timeout_min: number }
  answer: { fields: AnswerField[]; message: string }
  approval: { message: string }
  condition: { rule: string }
  image: { aspect_ratio: ImageAspect; prompt: string; source: string }
  llm: { json: boolean; model: string; prompt: string; system: string }
  note: { color: NoteColor; text: string }
  output: { channel: OutputChannel; message: string; target: string }
  shape: { color: NoteColor; label: string; shape: ShapeKind }
  text: { size: number; text: string }
  video: { aspect_ratio: string; duration: number; prompt: string; resolution: string; source: string }
  trigger: {
    channel: string
    events: string[]
    filter: string
    pass_through: boolean
    repository: string
    schedule: Schedule
    type: TriggerType
  }
}

export interface WorkflowNode<K extends NodeKind = NodeKind> {
  config: NodeConfigs[K]
  h?: number
  id: string
  kind: K
  title: string
  w?: number
  x: number
  y: number
}

export interface WorkflowEdge {
  branch: 'no' | 'yes' | null
  id: string
  source: string
  target: string
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface WorkflowDoc {
  description: string
  edges: WorkflowEdge[]
  name: string
  nodes: WorkflowNode[]
  viewport: Viewport
}

/** Where a webhook or GitHub trigger is posted to, and the secret the sender signs with. */
export interface HookInfo {
  route_enabled: boolean
  secret: string
  server_enabled: boolean
  url: string
}

export interface WorkflowDetail extends WorkflowDoc {
  created_at: number
  hook: HookInfo | null
  id: string
  next_run: null | string
  problems: { message: string; node_id: string }[]
  updated_at: number
  version: number
}

export type RunStatus = 'cancelled' | 'failed' | 'queued' | 'rejected' | 'running' | 'succeeded' | 'waiting'
export type StepStatus = 'failed' | 'pending' | 'running' | 'skipped' | 'succeeded' | 'waiting'

export interface WorkflowSummary {
  created_at: number
  id: string
  last_run: { created_at: number; id: string; status: RunStatus } | null
  name: string
  steps: number
  trigger: TriggerType
  updated_at: number
  version: number
}

export interface RunStep {
  data: null | Record<string, unknown>
  error: null | string
  finished_at: null | number
  node_id: string
  output: string
  seq: number
  started_at: null | number
  status: StepStatus
}

export interface RunSummary {
  cancel: boolean
  counts?: Partial<Record<StepStatus, number>>
  created_at: number
  error: null | string
  finished_at: null | number
  id: string
  mode: 'all' | 'from' | 'step'
  start_node: null | string
  started_at: null | number
  status: RunStatus
  trigger: { type: string } & Record<string, unknown>
  version: number
  waiting_node: null | string
  workflow_id: string
}

export interface RunDetail extends RunSummary {
  doc: Pick<WorkflowDoc, 'description' | 'edges' | 'name' | 'nodes'>
  steps: RunStep[]
}

export interface Agent {
  default: boolean
  model: string
  name: string
}

export interface WorkflowEvent {
  at: null | number
  error?: null | string
  message?: string
  node_id?: string
  run_id: string
  status?: RunStatus
  type: 'notification' | 'run'
  waiting_node?: null | string
  workflow: string
  workflow_id: string
}

export type ChatPlatform = 'discord' | 'slack' | 'telegram'

export interface Channel {
  id: string
  name: string
  type: string
}

/** What the owner has connected: the gateway hooks, the webhook server, each bot, the GitHub CLI. */
export interface Connectors {
  gh: boolean
  hooks: boolean
  platforms: Record<ChatPlatform, { channels: Channel[]; configured: boolean; home: boolean }>
  restart_required?: boolean
  webhook: { base_url: string; enabled: boolean }
}

export const CHAT_PLATFORMS: readonly ChatPlatform[] = ['telegram', 'discord', 'slack']

export const isChatPlatform = (value: string): value is ChatPlatform =>
  (CHAT_PLATFORMS as readonly string[]).includes(value)

/** What a version changed against the one before it (`first` for the oldest kept). */
export interface VersionChanges {
  added?: string[]
  changed?: string[]
  described?: boolean
  first?: boolean
  links_added?: number
  links_removed?: number
  removed?: string[]
  renamed?: boolean
}

export interface VersionSummary {
  changes: VersionChanges
  created_at: number
  steps: number
  version: number
}

export interface MediaStatus {
  image: { model: string; provider: string; ready: boolean }
  video: { model: string; provider: string; ready: boolean }
}

export interface WorkflowExport {
  format: 'brain-workflow'
  version: number
  workflow: WorkflowDoc
}

export const ACTIVE_RUN: readonly RunStatus[] = ['queued', 'running', 'waiting']

export const keys = {
  agents: ['workflows', 'agents'] as const,
  connectors: ['workflows', 'connectors'] as const,
  media: ['workflows', 'media'] as const,
  list: ['workflows', 'list'] as const,
  run: (id: string) => ['workflows', 'run', id] as const,
  runs: (id: string) => ['workflows', 'runs', id] as const,
  version: (id: string, version: number) => ['workflows', 'version', id, version] as const,
  versions: (id: string) => ['workflows', 'versions', id] as const,
  workflow: (id: string) => ['workflows', 'workflow', id] as const
}

const json = (body: unknown, method = 'POST'): PluginRestOptions => ({ body, method })

export const fetchWorkflows = () => call<{ workflows: WorkflowSummary[] }>('/workflows').then(r => r.workflows)
export const fetchWorkflow = (id: string) => call<WorkflowDetail>(`/workflows/${id}`)
export const createWorkflow = (name = '') => call<WorkflowDetail>('/workflows', json({ name }))
export const saveWorkflow = (id: string, workflow: WorkflowDoc) =>
  call<WorkflowDetail>(`/workflows/${id}`, json({ workflow }, 'PUT'))
export const deleteWorkflow = (id: string) => call<{ ok: true }>(`/workflows/${id}`, { method: 'DELETE' })
export const duplicateWorkflow = (id: string) => call<WorkflowDetail>(`/workflows/${id}/duplicate`, json({}))
export const fetchVersions = (id: string) =>
  call<{ versions: VersionSummary[] }>(`/workflows/${id}/versions`).then(r => r.versions)
export const fetchVersion = (id: string, version: number) =>
  call<{ version: number; workflow: WorkflowDoc }>(`/workflows/${id}/versions/${version}`).then(r => r.workflow)
export const restoreVersion = (id: string, version: number) =>
  call<WorkflowDetail>(`/workflows/${id}/versions/${version}/restore`, json({}))

export const runWorkflow = (id: string, mode: RunSummary['mode'], nodeId?: string) =>
  call<{ run_id: string }>(`/workflows/${id}/run`, json({ mode, node_id: nodeId ?? null }))
export const fetchRuns = (id: string) => call<{ runs: RunSummary[] }>(`/workflows/${id}/runs`).then(r => r.runs)
export const fetchRun = (id: string) => call<RunDetail>(`/runs/${id}`)
export const cancelRun = (id: string) => call<{ ok: true }>(`/runs/${id}/cancel`, json({}))
export const replyToRun = (
  id: string,
  reply: { approved?: boolean; node_id: string; note?: string; values?: Record<string, unknown> }
) => call<{ status: RunStatus }>(`/runs/${id}/reply`, json(reply))

export const fetchAgents = () => call<{ agents: Agent[] }>('/agents').then(r => r.agents)
export const checkRule = (rule: string) => call<{ error: string }>('/rules/check', json({ rule })).then(r => r.error)
export const fetchEvents = (since: number) =>
  call<{ events: WorkflowEvent[] }>(`/events?since=${since}`).then(r => r.events)

export const fetchConnectors = () => call<Connectors>('/connectors')

/** Turn on the gateway hooks the way the Plugins page does (`plugins.manage` toggle): written to the
 *  profile's config and loaded into the running gateway. */
export const enableConnectors = async () => {
  const result = await host.request<{ ok?: boolean; restart_required?: boolean }>(
    'plugins.manage',
    { action: 'toggle', enable: true, key: 'workflows' },
    180_000
  )

  if (!result?.ok) {
    throw new Error('toggle failed')
  }

  return { ...(await fetchConnectors()), restart_required: Boolean(result.restart_required) }
}

export const rotateHookSecret = (id: string) => call<WorkflowDetail>(`/workflows/${id}/hook/rotate`, json({}))
export const testHook = (id: string) => call<{ body: string; status: number }>(`/workflows/${id}/hook/test`, json({}))
export const fetchMediaStatus = () => call<MediaStatus>('/media/status')
export const exportWorkflow = (id: string) => call<WorkflowExport>(`/workflows/${id}/export`)
export const importWorkflow = (data: unknown) => call<WorkflowDetail>('/workflows/import', json({ data }))
