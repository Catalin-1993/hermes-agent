/**
 * Brain (Pro Mode): what the agent did, in plain words — read from the chat's own tool calls, nothing new asked of
 * the backend. `describeTool` turns `{ toolName, args }` into "Edited board-tab.tsx", "Ran git status", …
 */

import { useStore } from '@nanostores/react'

import { $messages } from '@/store/session'

export interface ToolAction {
  done: boolean
  failed: boolean
  id: string
  /** What happened, in a few words. */
  label: string
  /** The tool (or skill) behind it, for the "Using" chips. */
  using: string
}

const fileName = (path: unknown) =>
  typeof path === 'string' ? (path.split(/[\\/]/).filter(Boolean).pop() ?? path) : ''

const short = (value: unknown, max = 40) => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''

  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const readable = (name: string) =>
  name
    .replace(/^mcp__/, '')
    .replace(/__/g, ' · ')
    .replace(/[_.]+/g, ' ')

type Describe = (args: Record<string, unknown>) => string

/** The tools people meet most, said the way a person would; anything else falls back to its own name. */
const DESCRIBE: Record<string, Describe> = {
  browser_navigate: args => `Opened ${short(args.url)}`,
  delegate_task: args => `Helper agent: ${short(args.goal ?? args.task, 34)}`,
  desktop_preview: args => (args.action === 'open' ? `Opened ${short(args.url)}` : 'Read the page'),
  drive_preview: args => `${String(args.action ?? 'Used')} in the browser`,
  execute_code: () => 'Ran code',
  patch: args => `Edited ${fileName(args.path ?? args.file_path)}`,
  read_file: args => `Read ${fileName(args.path ?? args.file_path)}`,
  search_files: args => `Searched for ${short(args.pattern ?? args.query, 28)}`,
  skill_view: args => `Read skill ${short(args.name, 28)}`,
  terminal: args => `Ran ${short(args.command, 36)}`,
  todo: () => 'Updated the plan',
  web_extract: args => `Read ${short(args.url ?? (Array.isArray(args.urls) ? args.urls[0] : ''))}`,
  web_search: args => `Searched the web for ${short(args.query, 26)}`,
  write_file: args => `Wrote ${fileName(args.path ?? args.file_path)}`
}

export function describeTool(name: string, args: unknown): { label: string; using: string } {
  const fields = args && typeof args === 'object' ? (args as Record<string, unknown>) : {}
  // A describer whose object is missing ("Edited ") ends in a space: say the tool's name instead.
  const label = DESCRIBE[name]?.(fields)
  const using = name === 'skill_view' && typeof fields.name === 'string' ? `Skill ${fields.name}` : readable(name)

  return { label: label && !/\s$/.test(label) ? label : readable(name), using }
}

interface ToolPart {
  args?: unknown
  completedAt?: unknown
  isError?: boolean
  toolCallId?: string
  toolName?: string
  type?: string
}

/** The newest `limit` tool calls of the chat on screen, newest first. */
export function useRecentActions(limit = 8): ToolAction[] {
  const messages = useStore($messages)
  const actions: ToolAction[] = []

  for (let i = messages.length - 1; i >= 0 && actions.length < limit; i -= 1) {
    const parts = (messages[i]?.parts ?? []) as ToolPart[]

    for (let j = parts.length - 1; j >= 0 && actions.length < limit; j -= 1) {
      const part = parts[j]

      if (part?.type === 'tool-call' && part.toolName) {
        actions.push({
          done: part.completedAt !== undefined,
          failed: part.isError === true,
          id: part.toolCallId ?? `${i}:${j}`,
          ...describeTool(part.toolName, part.args)
        })
      }
    }
  }

  return actions
}
