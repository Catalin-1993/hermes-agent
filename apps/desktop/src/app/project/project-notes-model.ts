/**
 * What a project page keeps for the project itself, as two plain files in the project's folder, so everything a chat
 * started there reads is in the folder and travels with it:
 *
 * - **Instructions** — `.hermes.md`, the per-project context file Hermes already reads into every chat started in
 *   (or under) the folder.
 * - **Knowledge** — `.hermes-knowledge.md` (one `## Title` section per note) and the files in `knowledge/` (PDFs,
 *   spreadsheets, anything). Reference material the agent reads when it is relevant, not on every turn: `.hermes.md`
 *   carries a small managed pointer to both while there are any.
 *
 * Pure text in, text out, so it is tested.
 */

export const INSTRUCTIONS_FILE = '.hermes.md'
export const KNOWLEDGE_FILE = '.hermes-knowledge.md'

const POINTER_OPEN = '<!-- hermes:knowledge -->'
const POINTER_CLOSE = '<!-- /hermes:knowledge -->'
export const KNOWLEDGE_DIR = 'knowledge'
const LISTED_FILES = 30

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

export interface KnowledgeSources {
  files: readonly string[]
  notes: boolean
}

/** The managed block that tells the agent where the project's knowledge is; '' when there is none. */
export function knowledgePointer({ files, notes }: KnowledgeSources): string {
  if (!notes && !files.length) {
    return ''
  }

  const lines = ['Project knowledge: reference material for this project. Read it when a task may depend on it.']

  if (notes) {
    lines.push(`- Notes: \`${KNOWLEDGE_FILE}\` (next to this file).`)
  }

  if (files.length) {
    const shown = files.slice(0, LISTED_FILES).map(name => `\`${name}\``)
    const more = files.length > shown.length ? `, and ${files.length - shown.length} more` : ''

    lines.push(
      `- Files in \`${KNOWLEDGE_DIR}/\`: ${shown.join(', ')}${more}. Use the pdf or microsoft-office skill to read PDF and Office files.`
    )
  }

  return `${POINTER_OPEN}\n${lines.join('\n')}\n${POINTER_CLOSE}`
}

/** A file name that is not in `taken` yet: `report.pdf` → `report 2.pdf` → `report 3.pdf`. */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set(taken)

  if (!used.has(name)) {
    return name
  }

  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let n = 2

  while (used.has(`${stem} ${n}${ext}`)) {
    n += 1
  }

  return `${stem} ${n}${ext}`
}

/** The text of `.hermes.md`: the instructions, then the pointer to the knowledge when there is any. Empty
 *  instructions and no knowledge give an empty string (the caller then has nothing to write). */
export function composeInstructions(instructions: string, knowledge: KnowledgeSources): string {
  const text = instructions.trim()
  const parts = [text, knowledgePointer(knowledge)].filter(Boolean)

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
