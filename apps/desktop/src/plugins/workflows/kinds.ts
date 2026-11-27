/**
 * What each node kind looks like and starts as: its icon, its colour (one of the theme's accent
 * tokens, so every theme keeps it), its default config, and where its ports sit.
 */

import type { NodeConfigs, NodeKind, NoteColor, StepKind, WorkflowNode } from './api'
import { COPY, WEEKDAYS } from './copy'

export const STEP_KINDS: readonly StepKind[] = [
  'agent',
  'llm',
  'image',
  'video',
  'condition',
  'approval',
  'answer',
  'output'
]
export const VISUAL_KINDS = ['text', 'note', 'shape'] as const

export const isVisual = (kind: NodeKind) => (VISUAL_KINDS as readonly string[]).includes(kind)

export const KIND_ICON: Record<NodeKind, string> = {
  agent: 'hubot',
  answer: 'checklist',
  approval: 'verified',
  condition: 'repo-forked',
  image: 'file-media',
  llm: 'sparkle',
  note: 'note',
  output: 'send',
  shape: 'primitive-square',
  text: 'text-size',
  trigger: 'zap',
  video: 'device-camera-video'
}

export const KIND_TONE: Record<NodeKind, string> = {
  agent: 'var(--ui-blue)',
  answer: 'var(--ui-cyan)',
  approval: 'var(--ui-orange)',
  condition: 'var(--ui-purple)',
  image: 'color-mix(in srgb, var(--ui-red) 55%, var(--ui-purple))',
  llm: 'var(--ui-accent)',
  note: 'var(--ui-yellow)',
  output: 'var(--ui-green)',
  shape: 'var(--ui-text-tertiary)',
  text: 'var(--ui-text-tertiary)',
  trigger: 'var(--ui-yellow)',
  video: 'color-mix(in srgb, var(--ui-orange) 55%, var(--ui-red))'
}

export const TRIGGER_ICON: Record<string, string> = {
  discord: 'comment-discussion',
  github: 'github',
  manual: 'play',
  schedule: 'clock',
  slack: 'mention',
  telegram: 'send',
  webhook: 'plug',
  workflow: 'debug-step-over'
}

export const NOTE_FILL: Record<NoteColor, string> = {
  blue: 'var(--ui-blue)',
  default: 'var(--ui-text-tertiary)',
  green: 'var(--ui-green)',
  orange: 'var(--ui-orange)',
  purple: 'var(--ui-purple)',
  red: 'var(--ui-red)',
  yellow: 'var(--ui-yellow)'
}

/** Width and height of a step card on the canvas; visual nodes carry their own size. */
export const CARD_W = 264
export const CARD_H = 104

export const DEFAULT_CONFIG: { [K in NodeKind]: () => NodeConfigs[K] } = {
  agent: () => ({ agent: '', task: '', timeout_min: 30 }),
  answer: () => ({
    fields: [{ key: 'raspuns', label: 'Răspuns', options: [], required: true, type: 'text' }],
    message: ''
  }),
  approval: () => ({ message: '' }),
  condition: () => ({ rule: '' }),
  image: () => ({ aspect_ratio: 'landscape', prompt: '', source: '' }),
  llm: () => ({ json: false, model: '', prompt: '', system: '' }),
  note: () => ({ color: 'yellow', text: '' }),
  output: () => ({ channel: 'notification', message: '', target: '' }),
  shape: () => ({ color: 'default', label: '', shape: 'rectangle' }),
  text: () => ({ size: 22, text: 'Titlu' }),
  video: () => ({ aspect_ratio: '16:9', duration: 0, prompt: '', resolution: '720p', source: '' }),
  trigger: () => ({
    channel: '',
    events: [],
    filter: '',
    pass_through: false,
    repository: '',
    schedule: { cron: '', minute: 0, mode: 'daily', time: '09:00', weekday: 0 },
    source: '',
    type: 'manual',
    when: 'succeeded'
  })
}

export const VISUAL_SIZE: Record<(typeof VISUAL_KINDS)[number], { h: number; w: number }> = {
  note: { h: 160, w: 220 },
  shape: { h: 200, w: 320 },
  text: { h: 48, w: 260 }
}

export function nodeSize(node: WorkflowNode): { h: number; w: number } {
  return isVisual(node.kind) ? { h: node.h ?? 100, w: node.w ?? 200 } : { h: CARD_H, w: CARD_W }
}

export function nodeLabel(node: WorkflowNode): string {
  return node.title.trim() || COPY.kinds[node.kind].label
}

/** The input port (left) and output ports (right; a Condition has Da above and Nu below). */
export function portPoint(node: WorkflowNode, port: 'in' | 'no' | 'out' | 'yes'): { x: number; y: number } {
  const { h, w } = nodeSize(node)

  if (port === 'in') {
    return { x: node.x, y: node.y + h / 2 }
  }

  if (port === 'yes') {
    return { x: node.x + w, y: node.y + h * 0.36 }
  }

  if (port === 'no') {
    return { x: node.x + w, y: node.y + h * 0.72 }
  }

  return { x: node.x + w, y: node.y + h / 2 }
}

const clip = (text: string, max = 90) => {
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

export function scheduleSummary(config: NodeConfigs['trigger']): string {
  const s = config.schedule

  const lines: Record<string, () => string> = {
    cron: () => (s.cron ? `cron ${s.cron}` : 'cron —'),
    daily: () => `Zilnic la ${s.time}`,
    hourly: () => `Din oră în oră, la minutul ${String(s.minute).padStart(2, '0')}`,
    weekdays: () => `Luni–vineri la ${s.time}`,
    weekly: () => `${WEEKDAYS[s.weekday]} la ${s.time}`
  }

  return lines[s.mode]()
}

function triggerSummary(c: NodeConfigs['trigger']): string {
  if (c.type === 'schedule') {
    return scheduleSummary(c)
  }

  if (c.type === 'github') {
    const what = c.events.length ? c.events.join(', ') : 'orice eveniment'

    return `${c.repository || 'GitHub'} · ${clip(what, 48)}`
  }

  if (c.type === 'workflow') {
    return COPY.after.summary(c.source ? 'un workflow ales' : COPY.after.anyName, COPY.after.whens[c.when ?? 'succeeded'])
  }

  if (['discord', 'slack', 'telegram'].includes(c.type)) {
    const where = c.channel ? 'o conversație' : 'orice conversație'

    return `${COPY.triggers[c.type]} · ${where}${c.filter ? ` · „${clip(c.filter, 24)}”` : ''}`
  }

  return COPY.triggers[c.type]
}

/** One line under a card's title: what the step will do, or what it still needs. */
export function nodeSummary(node: WorkflowNode, agentLabel: (name: string) => string): string {
  const summaries: Record<string, () => string> = {
    agent: () => {
      const c = node.config as NodeConfigs['agent']

      return c.task ? `${agentLabel(c.agent)} · ${clip(c.task, 70)}` : `${agentLabel(c.agent)} · fără sarcină`
    },
    answer: () => {
      const c = node.config as NodeConfigs['answer']

      return c.fields.map(f => f.label).join(', ') || 'fără câmpuri'
    },
    approval: () => clip((node.config as NodeConfigs['approval']).message) || 'Așteaptă confirmarea ta',
    condition: () => clip((node.config as NodeConfigs['condition']).rule) || 'fără regulă',
    image: () => {
      const c = node.config as NodeConfigs['image']

      return `${COPY.media.aspects[c.aspect_ratio]} · ${clip(c.prompt, 60) || 'din pasul anterior'}`
    },
    video: () => {
      const c = node.config as NodeConfigs['video']
      const length = c.duration ? ` · ${c.duration} s` : ''

      return `${c.aspect_ratio} · ${c.resolution}${length} · ${clip(c.prompt, 44) || 'din pasul anterior'}`
    },
    llm: () => {
      const c = node.config as NodeConfigs['llm']

      return `${c.model || 'model activ'} · ${clip(c.prompt, 60) || 'fără prompt'}`
    },
    output: () => {
      const c = node.config as NodeConfigs['output']
      const where = c.target && c.channel !== 'chat' && c.channel !== 'notification' ? ` ${clip(c.target, 24)}` : ''

      return `${COPY.channels[c.channel]}${where}${c.message ? ` · ${clip(c.message, 44)}` : ''}`
    },
    trigger: () => {
      const c = node.config as NodeConfigs['trigger']

      return triggerSummary(c)
    }
  }

  return summaries[node.kind]?.() ?? ''
}
