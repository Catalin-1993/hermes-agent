/** The text of a project's two files: instructions in `.hermes.md`, knowledge notes in `.hermes-knowledge.md`. */
import { describe, expect, it } from 'vitest'

import {
  cleanBody,
  cleanTitle,
  composeInstructions,
  composeKnowledge,
  joinPath,
  parseKnowledge,
  readInstructions
} from './project-notes-model'

describe('project instructions', () => {
  it('keeps the managed knowledge pointer out of what the user edits, and writes it back only with notes', () => {
    const file = composeInstructions('Always answer in Romanian.', true)

    expect(file).toContain('.hermes-knowledge.md')
    expect(readInstructions(file)).toBe('Always answer in Romanian.')
    expect(composeInstructions(readInstructions(file), false)).toBe('Always answer in Romanian.\n')
    expect(composeInstructions('', false)).toBe('')
  })

  it('reads a file that was never ours as plain instructions', () => {
    expect(readInstructions('# Rules\n\nBe brief.\n')).toBe('# Rules\n\nBe brief.')
  })
})

describe('project knowledge', () => {
  it('round-trips notes through their file', () => {
    const notes = [
      { body: 'Starter 12, main 28.', title: 'Menu prices' },
      { body: 'Open Tue–Sun.\n\nClosed Monday.', title: 'Hours' }
    ]

    expect(parseKnowledge(composeKnowledge(notes))).toEqual(notes)
    expect(composeKnowledge([])).toBe('')
  })

  it('stops a note from breaking the file: titles stay on one line, bodies cannot open a section', () => {
    expect(cleanTitle('## Menu \n prices')).toBe('Menu prices')
    expect(cleanBody('before\n## sneaky\nafter')).toBe('before\n ## sneaky\nafter')

    const notes = parseKnowledge(composeKnowledge([{ body: cleanBody('a\n## b'), title: 'T' }]))

    expect(notes).toHaveLength(1)
  })
})

describe('joinPath', () => {
  it('follows the folder’s own separators and does not double them', () => {
    expect(joinPath('/home/c/cafe/', '.hermes.md')).toBe('/home/c/cafe/.hermes.md')
    expect(joinPath('C:\\Users\\c\\cafe', '.hermes.md')).toBe('C:\\Users\\c\\cafe\\.hermes.md')
  })
})
