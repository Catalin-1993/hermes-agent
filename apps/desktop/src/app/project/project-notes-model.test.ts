/** The text of a project's two files: instructions in `.hermes.md`, knowledge notes in `.hermes-knowledge.md`. */
import { describe, expect, it } from 'vitest'

import {
  cleanBody,
  cleanTitle,
  composeInstructions,
  composeKnowledge,
  joinPath,
  parseKnowledge,
  readInstructions,
  uniqueName
} from './project-notes-model'

describe('project instructions', () => {
  it('keeps the managed knowledge pointer out of what the user edits, and writes it back only with notes', () => {
    const none = { files: [], notes: false }
    const file = composeInstructions('Always answer in Romanian.', { files: [], notes: true })

    expect(file).toContain('.hermes-knowledge.md')
    expect(readInstructions(file)).toBe('Always answer in Romanian.')
    expect(composeInstructions(readInstructions(file), none)).toBe('Always answer in Romanian.\n')
    expect(composeInstructions('', none)).toBe('')
  })

  it('points the agent at the knowledge files, naming them and the skills that read PDF and Office', () => {
    const file = composeInstructions('', { files: ['menu.pdf', 'prices.xlsx'], notes: false })

    expect(file).toContain('`knowledge/`')
    expect(file).toContain('`menu.pdf`, `prices.xlsx`')
    expect(file).toContain('pdf or microsoft-office')
    expect(file).not.toContain('.hermes-knowledge.md')
    expect(readInstructions(file)).toBe('')
  })

  it('lists only the first files of a long shelf and says how many more there are', () => {
    const files = Array.from({ length: 35 }, (_, at) => `f${at}.pdf`)

    expect(composeInstructions('', { files, notes: false })).toContain('and 5 more')
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

describe('uniqueName', () => {
  it('keeps a free name and numbers a taken one before its extension', () => {
    expect(uniqueName('menu.pdf', ['other.pdf'])).toBe('menu.pdf')
    expect(uniqueName('menu.pdf', ['menu.pdf'])).toBe('menu 2.pdf')
    expect(uniqueName('menu.pdf', ['menu.pdf', 'menu 2.pdf'])).toBe('menu 3.pdf')
    expect(uniqueName('README', ['README'])).toBe('README 2')
    expect(uniqueName('.env', ['.env'])).toBe('.env 2')
  })
})
