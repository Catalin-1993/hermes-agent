/**
 * Brain (Pro Mode): what the agent did, in plain words — read from the chat's own tool calls, nothing new asked of
 * the backend. `describeTool` turns `{ toolName, args }` into what a person would say: "Reading notes.md" while it
 * runs, "Read notes.md" once done; shell commands by what they do ("Ran the tests", "Sent the changes to GitHub").
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

/** One step said twice: while it runs ("Reading notes.md") and once it is done ("Read notes.md"). */
interface Said {
  done: string
  now: string
}

type Describe = (args: Record<string, unknown>) => Said | null

const said = (now: string, done = now): Said => ({ done, now })

const quoted = (value: unknown, max = 30) => {
  const text = short(value, max)

  return text ? `“${text}”` : ''
}

const host = (url: unknown) => {
  const text = typeof url === 'string' ? url : ''

  try {
    return new URL(text).host.replace(/^www\./, '')
  } catch {
    return short(text, 34)
  }
}

/** Common shell commands, in words; anything else keeps a short form of the command itself. */
const COMMANDS: [RegExp, (match: RegExpMatchArray) => Said][] = [
  [/^git\s+(status|diff)\b/, () => said('Checking what changed in the project', 'Checked what changed in the project')],
  [/^git\s+log\b/, () => said('Looking through the project history', 'Looked through the project history')],
  [/^git\s+add\b/, () => said('Preparing the changes to save', 'Prepared the changes to save')],
  [/^git\s+commit\b/, () => said('Saving the changes in git', 'Saved the changes in git')],
  [/^git\s+push\b/, () => said('Sending the changes to GitHub', 'Sent the changes to GitHub')],
  [/^git\s+(pull|fetch)\b/, () => said('Getting the latest version', 'Got the latest version')],
  [/^git\s+(checkout|switch|branch)\b/, () => said('Switching branch', 'Switched branch')],
  [/^git\s+merge\b/, () => said('Merging the latest changes', 'Merged the latest changes')],
  [
    /\b(vitest|pytest|jest|run_tests|npm (run )?test|pnpm test|yarn test)\b/,
    () => said('Running the tests', 'Ran the tests')
  ],
  [/\b(eslint|prettier|tsc|ruff|lint|typecheck)\b/, () => said('Checking the code for mistakes', 'Checked the code')],
  [/\b(npm|pnpm|yarn|pip|uv) (install|add|i)\b/, () => said('Installing what the project needs', 'Installed packages')],
  [/\b(npm|pnpm|yarn) (run )?(build|dev|start)\b/, () => said('Building the app', 'Built the app')],
  [/^(ls|tree|find)\b/, () => said('Looking at the files', 'Looked at the files')],
  [/^(cat|head|tail|less|sed -n)\b/, () => said('Reading a file', 'Read a file')],
  [/^(grep|rg)\b/, () => said('Searching the code', 'Searched the code')],
  [/^(mkdir|touch|cp|mv)\b/, () => said('Organizing files', 'Organized files')],
  [/^(rm)\b/, () => said('Removing files', 'Removed files')],
  [/^(curl|wget)\b/, () => said('Downloading from the internet', 'Downloaded from the internet')],
  [/^(python3?|node)\b/, () => said('Running a script', 'Ran a script')]
]

function describeCommand(command: unknown): Said | null {
  const text = typeof command === 'string' ? command.trim().replace(/^cd\s+\S+\s*&&\s*/, '') : ''

  if (!text) {
    return null
  }

  for (const [pattern, describe] of COMMANDS) {
    const match = text.match(pattern)

    if (match) {
      return describe(match)
    }
  }

  return said(`Running a command: ${short(text, 30)}`, `Ran a command: ${short(text, 30)}`)
}

const named = (verbNow: string, verbDone: string, object: string) =>
  object ? said(`${verbNow} ${object}`, `${verbDone} ${object}`) : null

/** The tools people meet most, said the way a person would; anything else falls back to its own name. */
const DESCRIBE: Record<string, Describe> = {
  browser_back: () => said('Going back a page', 'Went back a page'),
  browser_click: args =>
    said(
      `Clicking ${quoted(args.ref ?? args.text ?? args.element) || 'on the page'}`,
      `Clicked ${quoted(args.ref ?? args.text ?? args.element) || 'on the page'}`
    ),
  browser_navigate: args => named('Opening', 'Opened', host(args.url)),
  browser_snapshot: () => said('Looking at the page', 'Looked at the page'),
  browser_type: () => said('Typing into the page', 'Typed into the page'),
  browser_vision: () => said('Looking at the page', 'Looked at the page'),
  clarify: () => said('Asking you a question', 'Asked you a question'),
  computer_use: args =>
    args.action === 'capture'
      ? said('Looking at your screen', 'Looked at your screen')
      : said('Using your computer', 'Used your computer'),
  cronjob: () => said('Scheduling a task', 'Scheduled a task'),
  delegate_task: args =>
    named(
      'Asking a helper agent to',
      'A helper agent did:',
      short(args.goal ?? args.task, 34).replace(/^./, c => c.toLowerCase())
    ),
  desktop_preview: args =>
    args.action === 'open' ? named('Opening', 'Opened', host(args.url)) : said('Reading the page', 'Read the page'),
  drive_preview: () => said('Using the browser', 'Used the browser'),
  execute_code: () => said('Running some code', 'Ran some code'),
  image_generate: () => said('Creating an image', 'Created an image'),
  memory: () => said('Saving something to remember', 'Saved something to remember'),
  patch: args => named('Editing', 'Edited', fileName(args.path ?? args.file_path)),
  process: () => said('Checking a background job', 'Checked a background job'),
  read_file: args => named('Reading', 'Read', fileName(args.path ?? args.file_path)),
  search_files: args =>
    named('Searching the files for', 'Searched the files for', quoted(args.pattern ?? args.query, 26)),
  send_message: () => said('Sending a message', 'Sent a message'),
  session_search: () => said('Looking through past conversations', 'Looked through past conversations'),
  skill_manage: () => said('Updating a skill', 'Updated a skill'),
  skill_view: args => named('Reading the skill', 'Read the skill', short(args.name, 28)),
  skills_list: () => said('Looking through skills', 'Looked through skills'),
  terminal: args => describeCommand(args.command),
  text_to_speech: () => said('Speaking aloud', 'Spoke aloud'),
  todo: () => said('Updating the plan', 'Updated the plan'),
  vision_analyze: () => said('Looking at an image', 'Looked at an image'),
  web_extract: args => named('Reading', 'Read', host(args.url ?? (Array.isArray(args.urls) ? args.urls[0] : ''))),
  web_search: args => named('Searching the web for', 'Searched the web for', quoted(args.query, 26)),
  write_file: args => named('Writing', 'Wrote', fileName(args.path ?? args.file_path))
}

/** A step in plain words — as it is happening, or as it happened once `done` — and the tool behind it. */
export function describeTool(name: string, args: unknown, done = true): { label: string; using: string } {
  const fields = args && typeof args === 'object' ? (args as Record<string, unknown>) : {}
  const step = DESCRIBE[name]?.(fields)
  const using = name === 'skill_view' && typeof fields.name === 'string' ? `Skill ${fields.name}` : readable(name)
  const fallback = readable(name).replace(/^./, c => c.toUpperCase())

  return { label: step ? (done ? step.done : step.now) : fallback, using }
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
        const done = part.completedAt !== undefined

        actions.push({
          done,
          failed: part.isError === true,
          id: part.toolCallId ?? `${i}:${j}`,
          ...describeTool(part.toolName, part.args, done)
        })
      }
    }
  }

  return actions
}
