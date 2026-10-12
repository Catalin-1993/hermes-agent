import { strToU8, zipSync } from 'fflate'

import { type Delimited, parseDelimited, serializeDelimited } from './csv'
import { extensionOf } from './file-types'

/** What an item can be turned into, and the pieces that turn it: the file-making parts are pure (bytes in,
 *  bytes out) so they can be checked without a window; `export-actions.ts` does the fetching and saving. */

export type ExportFormat =
  | 'bundle'
  | 'csv'
  | 'docx'
  | 'html'
  | 'images'
  | 'jpeg'
  | 'json'
  | 'markdown'
  | 'original'
  | 'pdf'
  | 'png'
  | 'pptx'
  | 'tsv'
  | 'webp'
  | 'xlsx'
  | 'zip'

export interface ExportSubject {
  /** A presentation is a page whose text starts with the deck marker. */
  deck: boolean
  file_name?: null | string
  kind: 'file' | 'folder' | 'page'
  mime?: null | string
}

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']
const TABLE_EXT = ['csv', 'tsv']

export type SubjectType = 'deck' | 'file' | 'folder' | 'image' | 'page' | 'table'

export function subjectType(item: ExportSubject): SubjectType {
  if (item.kind === 'folder') {
    return 'folder'
  }

  if (item.kind === 'page') {
    return item.deck ? 'deck' : 'page'
  }

  const ext = extensionOf(item.file_name)

  if (TABLE_EXT.includes(ext)) {
    return 'table'
  }

  return IMAGE_EXT.includes(ext) || (item.mime ?? '').startsWith('image/') ? 'image' : 'file'
}

/** The formats offered for each kind of item, in the order a menu lists them: the usual one first, the
 *  archive last. */
const FORMATS: Record<SubjectType, readonly ExportFormat[]> = {
  deck: ['pptx', 'docx', 'pdf', 'markdown', 'images', 'bundle'],
  file: ['original', 'zip'],
  folder: ['zip'],
  image: ['png', 'jpeg', 'webp', 'original', 'zip'],
  page: ['pdf', 'html', 'markdown', 'zip'],
  table: ['csv', 'tsv', 'json', 'markdown', 'xlsx', 'zip']
}

export const exportFormatsFor = (item: ExportSubject): readonly ExportFormat[] => {
  const formats = FORMATS[subjectType(item)]
  const ext = extensionOf(item.file_name)

  // An image is not offered as the format it already is; a table's own separator is "original".
  return formats.filter(
    format => !(subjectType(item) === 'image' && (format === ext || (format === 'jpeg' && ext === 'jpg')))
  )
}

// ── names ────────────────────────────────────────────────────────────────────────────────────────

/** A title as a file name: no path or control characters, bounded, with a fallback for an empty one. */
export const safeName = (title: string, fallback = 'Untitled') =>
  [...title]
    .filter(char => char.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(char))
    .join('')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80) || fallback

/** Names made unique inside one archive: a second "Notes.md" becomes "Notes 2.md". */
export function uniqueNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>()

  return names.map(name => {
    const key = name.toLowerCase()
    const count = (seen.get(key) ?? 0) + 1

    seen.set(key, count)

    if (count === 1) {
      return name
    }

    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''

    return `${stem} ${count}${ext}`
  })
}

// ── archives ─────────────────────────────────────────────────────────────────────────────────────

export interface ZipEntry {
  data: Uint8Array | string
  /** Path inside the archive, `/`-separated. */
  name: string
}

/** A ZIP of the entries. Already-compressed media is stored, text and the rest are deflated. */
export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {}

  for (const entry of entries) {
    const bytes = typeof entry.data === 'string' ? strToU8(entry.data) : entry.data
    const stored = /\.(png|jpe?g|webp|gif|zip|pdf|mp3|mp4|mov|pptx|docx|xlsx)$/i.test(entry.name)

    files[entry.name] = [bytes, { level: stored ? 0 : 6 }]
  }

  return zipSync(files)
}

// ── pages ────────────────────────────────────────────────────────────────────────────────────────

/** The Library items a page's text points at (`library://<id>`), once each. */
export const libraryLinks = (markdown: string): string[] => [
  ...new Set([...markdown.matchAll(/library:\/\/([\w-]+)/g)].map(match => match[1]))
]

/** The page's text with each `library://<id>` pointing at the file it was saved as in the archive. */
export const relinkLibrary = (markdown: string, paths: Readonly<Record<string, string>>): string =>
  markdown.replace(/library:\/\/([\w-]+)/g, (whole, id: string) => (paths[id] ? encodeURI(paths[id]) : whole))

// ── tables ───────────────────────────────────────────────────────────────────────────────────────

const header = (rows: readonly string[][]) => (rows[0] ?? []).map((cell, index) => cell || `Column ${index + 1}`)

export const tableToTsv = (table: Delimited): string => serializeDelimited({ delimiter: '\t', rows: table.rows })

export const tableToCsv = (table: Delimited): string => serializeDelimited({ delimiter: ',', rows: table.rows })

/** The rows as a JSON array of objects, keyed by the header row (a blank header is "Column N"). */
export function tableToJson(table: Delimited): string {
  const keys = header(table.rows)

  const records = table.rows.slice(1).map(row => {
    const record: Record<string, string> = {}

    keys.forEach((key, index) => {
      record[key] = row[index] ?? ''
    })

    return record
  })

  return `${JSON.stringify(records, null, 2)}\n`
}

const mdCell = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

export function tableToMarkdown(table: Delimited): string {
  const keys = header(table.rows)
  const line = (cells: readonly string[]) => `| ${keys.map((_, index) => mdCell(cells[index] ?? '')).join(' | ')} |`

  return [line(keys), `| ${keys.map(() => '---').join(' | ')} |`, ...table.rows.slice(1).map(line)].join('\n') + '\n'
}

const xml = (text: string) =>
  text.replace(/[&<>"]/g, char => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!)

/** Spreadsheet column letters: 0 → A, 26 → AA. */
export const columnLetters = (index: number): string => {
  let letters = ''

  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters
  }

  return letters
}

const PLAIN_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/

/** The rows as an Excel workbook (.xlsx): one sheet, numbers as numbers and everything else as text. */
export function buildXlsx(table: Delimited, sheetName = 'Sheet1'): Uint8Array {
  const rows = table.rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${columnLetters(c)}${r + 1}`

          if (value === '') {
            return ''
          }

          return PLAIN_NUMBER.test(value)
            ? `<c r="${ref}"><v>${value}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
        })
        .join('')

      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')

  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

  return buildZip([
    {
      data: `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
      name: '[Content_Types].xml'
    },
    {
      data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      name: '_rels/.rels'
    },
    {
      data: `${head}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(safeName(sheetName, 'Sheet1').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      name: 'xl/workbook.xml'
    },
    {
      data: `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
      name: 'xl/_rels/workbook.xml.rels'
    },
    {
      data: `${head}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
      name: 'xl/worksheets/sheet1.xml'
    }
  ])
}

/** A table file's text read as rows, for the converters above. */
export const readTable = (text: string, fileName?: null | string): Delimited =>
  parseDelimited(text, extensionOf(fileName) === 'tsv' ? '\t' : undefined)
