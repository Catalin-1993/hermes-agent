/** Reading and saving a project's two files (see `project-notes-model`), on this computer or the connected backend. */

import { DesktopFileMissingError, readDesktopFileText, writeDesktopFileText } from '@/lib/desktop-fs'

import { listKnowledgeFiles } from './project-files'
import {
  cleanBody,
  cleanTitle,
  composeInstructions,
  composeKnowledge,
  INSTRUCTIONS_FILE,
  joinPath,
  KNOWLEDGE_FILE,
  type KnowledgeNote,
  parseKnowledge,
  readInstructions
} from './project-notes-model'

export interface ProjectNotes {
  /** Names of the files in the project's `knowledge/` folder. */
  files: string[]
  instructions: string
  knowledge: KnowledgeNote[]
}

/** A file's text, or '' when it is not there yet. */
async function readOrEmpty(path: string): Promise<string> {
  try {
    return (await readDesktopFileText(path)).text ?? ''
  } catch (error) {
    if (error instanceof DesktopFileMissingError) {
      return ''
    }

    throw error
  }
}

export async function loadProjectNotes(folder: string): Promise<ProjectNotes> {
  const [instructions, knowledge, files] = await Promise.all([
    readOrEmpty(joinPath(folder, INSTRUCTIONS_FILE)),
    readOrEmpty(joinPath(folder, KNOWLEDGE_FILE)),
    listKnowledgeFiles(folder)
  ])

  return { files, instructions: readInstructions(instructions), knowledge: parseKnowledge(knowledge) }
}

/** Writes both files from the project's whole state. An empty file is written empty (not left stale). */
export async function saveProjectNotes(folder: string, notes: ProjectNotes): Promise<void> {
  const knowledge = notes.knowledge.map(note => ({ body: cleanBody(note.body), title: cleanTitle(note.title) }))
  const kept = knowledge.filter(note => note.title)

  await writeDesktopFileText(joinPath(folder, KNOWLEDGE_FILE), composeKnowledge(kept))
  await writeDesktopFileText(
    joinPath(folder, INSTRUCTIONS_FILE),
    composeInstructions(notes.instructions, { files: notes.files, notes: kept.length > 0 })
  )
}
