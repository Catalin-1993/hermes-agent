import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import {
  buildXlsx,
  buildZip,
  columnLetters,
  exportFormatsFor,
  libraryLinks,
  relinkLibrary,
  safeName,
  subjectType,
  tableToJson,
  tableToMarkdown,
  uniqueNames
} from './export-formats'

const table = {
  delimiter: ',' as const,
  rows: [
    ['City', 'Population', ''],
    ['Cluj', '286598', 'a|b'],
    ['Iasi', '272000']
  ]
}

describe('what an item can be exported as', () => {
  it('tells kinds apart and offers each its own formats, the archive last', () => {
    expect(subjectType({ deck: true, kind: 'page' })).toBe('deck')
    expect(subjectType({ deck: false, kind: 'page' })).toBe('page')
    expect(subjectType({ deck: false, file_name: 'a.CSV', kind: 'file' })).toBe('table')
    expect(subjectType({ deck: false, file_name: 'a.heic', kind: 'file', mime: 'image/heic' })).toBe('image')
    expect(subjectType({ deck: false, kind: 'folder' })).toBe('folder')

    for (const subject of [
      { deck: true, kind: 'page' },
      { deck: false, kind: 'page' },
      { deck: false, file_name: 'x.csv', kind: 'file' }
    ] as const) {
      expect(exportFormatsFor(subject).at(-1)).toBe(subject.deck ? 'bundle' : 'zip')
    }
  })

  it('does not offer an image as the format it already is', () => {
    expect(exportFormatsFor({ deck: false, file_name: 'a.png', kind: 'file' })).not.toContain('png')
    expect(exportFormatsFor({ deck: false, file_name: 'a.jpg', kind: 'file' })).not.toContain('jpeg')
    expect(exportFormatsFor({ deck: false, file_name: 'a.webp', kind: 'file' })).toContain('png')
  })
})

describe('names', () => {
  it('makes a title safe for a file and numbers duplicates inside an archive', () => {
    expect(safeName('a/b:c*?')).toBe('abc')
    expect(safeName('  ', 'Page')).toBe('Page')
    expect(safeName('.hidden')).toBe('hidden')
    expect(uniqueNames(['Notes.md', 'notes.md', 'Other.md', 'Notes.md'])).toEqual([
      'Notes.md',
      'notes 2.md',
      'Other.md',
      'Notes 3.md'
    ])
  })

  it('points a page’s Library links at the files saved beside it', () => {
    const text = '![a](library://img1) and [b](library://img2) and library://img1'

    expect(libraryLinks(text)).toEqual(['img1', 'img2'])
    expect(relinkLibrary(text, { img1: 'assets/my pic.png' })).toBe(
      '![a](assets/my%20pic.png) and [b](library://img2) and assets/my%20pic.png'
    )
  })
})

describe('archives and tables', () => {
  it('builds a ZIP that opens back into the same files', () => {
    const files = unzipSync(
      buildZip([
        { data: 'hello', name: 'a/b.txt' },
        { data: new Uint8Array([1, 2, 3]), name: 'c.png' }
      ])
    )

    expect(strFromU8(files['a/b.txt'])).toBe('hello')
    expect([...files['c.png']]).toEqual([1, 2, 3])
  })

  it('writes JSON keyed by the header and Markdown with escaped bars', () => {
    expect(JSON.parse(tableToJson(table))).toEqual([
      { City: 'Cluj', 'Column 3': 'a|b', Population: '286598' },
      { City: 'Iasi', 'Column 3': '', Population: '272000' }
    ])
    expect(tableToMarkdown(table)).toBe(
      '| City | Population | Column 3 |\n| --- | --- | --- |\n| Cluj | 286598 | a\\|b |\n| Iasi | 272000 |  |\n'
    )
  })

  it('names spreadsheet columns the way a spreadsheet does', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnLetters)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA'])
  })

  it('writes a workbook whose parts are well-formed and whose cells keep numbers and text apart', () => {
    const files = unzipSync(buildXlsx(table, 'Cities'))

    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml'
    ])

    for (const name of Object.keys(files)) {
      const doc = new DOMParser().parseFromString(strFromU8(files[name]), 'application/xml')

      expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
    }

    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])

    expect(sheet).toContain('<c r="B2"><v>286598</v></c>')
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Cluj</t></is></c>')
    expect(sheet).not.toContain('r="C1"')
  })
})
