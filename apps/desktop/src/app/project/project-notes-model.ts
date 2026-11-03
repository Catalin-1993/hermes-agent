/**
 * What a project page keeps for the project itself, as two plain files in the project's folder, so everything a chat
 * started there reads is in the folder and travels with it:
 *
 * - **Instructions** — `.hermes.md`, the per-project context file Hermes already reads into every chat started in
 *   (or under) the folder.
 * - **Knowledge** — `.hermes-knowledge.md`, one `## Title` section per note. Reference material the agent reads when
 *   it is relevant, not on every turn: `.hermes.md` carries a small managed pointer to it while it has notes.
 *
 * Pure text in, text out, so it is tested.
 */

export const INSTRUCTIONS_FILE = '.hermes.md'
export const KNOWLEDGE_FILE = '.hermes-knowledge.md'

const POINTER_OPEN = '<!-- hermes:knowledge -->'
const POINTER_CLOSE = '<!-- /hermes:knowledge -->'
const POINTER = `${POINTER_OPEN}\nProject knowledge: notes for this project are in \`${KNOWLEDGE_FILE}\` (next to this file). Read it when a task may depend on them.\n${POINTER_CLOSE}`

export interface KnowledgeNote {
  body: string
  title: string
}

/** A folder and a file name joined the way the folder spells its separators. */
export function joinPath(folder: string, name: string): string {
  const sep = folder.includes('\\') && !folder.includes('/') ? '\\' : '/'

  return `${folder.replace(/[\\/]+$/, '')}${sep}${name}`
}

/** The instructions text without the managed knowledge pointer (which the user never edits). */
export function readInstructions(raw: string): string {
  const open = raw.indexOf(POINTER_OPEN)
  const close = raw.indexOf(POINTER_CLOSE)

  if (open === -1 || close === -1 || close < open) {
    return raw.trim()
  }

  return `${raw.slice(0, open)}${raw.slice(close + POINTER_CLOSE.length)}`.replace(/\n{3,}/g, '\n\n').trim()
}

/** The text of `.hermes.md`: the instructions, then the pointer to the knowledge notes when there are any. Empty
 *  instructions and no notes give an empty string (the caller then has nothing to write). */
export function composeInstructions(instructions: string, hasKnowledge: boolean): string {
  const text = instructions.trim()
  const parts = [text, hasKnowledge ? POINTER : ''].filter(Boolean)

  return parts.length ? `${parts.join('\n\n')}\n` : ''
}

export function parseKnowledge(raw: string): KnowledgeNote[] {
  const notes: KnowledgeNote[] = []
  let current: KnowledgeNote | null = null

  for (const line of raw.split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line)

    if (heading) {
      current = { body: '', title: heading[1]! }
      notes.push(current)
    } else if (current) {
      current.body += `${line}\n`
    }
  }

  return notes.map(note => ({ ...note, body: note.body.trim() }))
}

export function composeKnowledge(notes: readonly KnowledgeNote[]): string {
  if (!notes.length) {
    return ''
  }

  const sections = notes.map(note => `## ${note.title.trim()}\n\n${note.body.trim()}\n`)

  return `# Project knowledge\n\n${sections.join('\n')}`
}

/** A note title that cannot break the file's own structure: one line, no leading `#`. */
export const cleanTitle = (title: string) =>
  title
    .replace(/\s+/g, ' ')
    .replace(/^#+\s*/, '')
    .trim()

/** A note body that cannot open a section of its own: a line starting `## ` is indented one space. */
export const cleanBody = (body: string) => body.replace(/^(##\s)/gm, ' $1').trim()
