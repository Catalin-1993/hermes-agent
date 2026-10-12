import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { translateNow } from '@/i18n'
import { notify, notifyError } from '@/store/notifications'

import { getLibraryItem, type LibraryItem, listLibrary, readLibraryBlob } from './data'
import { isDeck, parseDeck } from './deck'
import { buildDocx } from './deck-docx'
import { exportDeckPdf, exportDeckPptx, loadPptxImage } from './deck-export'
import { buildPptx } from './deck-pptx'
import { Slide } from './deck-slide'
import {
  buildXlsx,
  buildZip,
  type ExportFormat,
  libraryLinks,
  readTable,
  relinkLibrary,
  safeName,
  subjectType,
  tableToCsv,
  tableToJson,
  tableToMarkdown,
  tableToTsv,
  uniqueNames,
  type ZipEntry
} from './export-formats'
import { extensionOf } from './file-types'
import { exportPage } from './page-export-actions'
import { rasterizeElement } from './rasterize'

/** Turning a Library item into a file on the owner's disk, in the format they pick. The pure pieces live in
 *  `export-formats.ts`; this reads the item (and what it points at), builds the file and hands it to the
 *  browser's download. */

const MIME: Partial<Record<ExportFormat, string>> = {
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html',
  jpeg: 'image/jpeg',
  json: 'application/json',
  markdown: 'text/markdown',
  png: 'image/png',
  tsv: 'text/tab-separated-values',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip'
}

const EXTENSION: Partial<Record<ExportFormat, string>> = {
  bundle: 'zip',
  csv: 'csv',
  docx: 'docx',
  html: 'html',
  images: 'zip',
  jpeg: 'jpg',
  json: 'json',
  markdown: 'md',
  png: 'png',
  tsv: 'tsv',
  webp: 'webp',
  xlsx: 'xlsx',
  zip: 'zip'
}

/** A folder this big is refused rather than built in memory. */
const FOLDER_MAX_BYTES = 400 * 1024 * 1024
const FOLDER_MAX_ITEMS = 3000

const done = () => void notify({ durationMs: 2500, kind: 'success', message: translateNow('library.actions.exported') })

function save(data: Blob | Uint8Array | string, name: string, type: string) {
  const blob =
    data instanceof Blob ? data : new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type })

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The item's name as a file name; a file's own extension is left off, since each format adds its own. */
const titleOf = (item: LibraryItem) =>
  safeName(
    (item.title || item.file_name || '').replace(item.kind === 'file' ? /\.[a-z0-9]{1,5}$/i : /(?!)/, ''),
    translateNow('library.untitled')
  )

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())

/** An image re-encoded as `type` (a canvas does the work); JPEG gets a white ground, as it has no alpha. */
async function convertImage(blob: Blob, type: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')

  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('no canvas')
  }

  if (type === 'image/jpeg') {
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const out = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.92))

  if (!out) {
    throw new Error('could not encode the image')
  }

  return out
}

const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** Each slide as a 1280×720 PNG: drawn off screen from the same component the canvas and the exports use. */
async function renderSlides(markdown: string): Promise<Uint8Array[]> {
  const deck = parseDeck(markdown)
  const images: Record<string, string> = {}

  await Promise.all(
    libraryLinks(markdown).map(async id => {
      images[id] = await readLibraryBlob(id).then(dataUrl)
    })
  ).catch(() => undefined)

  const stage = document.createElement('div')

  stage.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:720px;pointer-events:none'
  document.body.append(stage)

  const root = createRoot(stage)
  const out: Uint8Array[] = []

  try {
    for (const slide of deck.slides) {
      flushSync(() => root.render(createElement(Slide, { images, slide, theme: deck.theme })))
      // Pictures inside the slide decode on their own clock.
      await Promise.all([...stage.querySelectorAll('img')].map(img => img.decode().catch(() => undefined)))

      const el = stage.querySelector<HTMLElement>('[data-slide]')

      if (el) {
        const png = await rasterizeElement(el)

        out.push(Uint8Array.from(atob(png.split(',')[1]), char => char.charCodeAt(0)))
      }
    }
  } finally {
    root.unmount()
    stage.remove()
  }

  return out
}

/** A page's pictures read once and kept under `assets/`, the page's text pointed at them. */
async function pageFiles(item: LibraryItem, folder: string): Promise<ZipEntry[]> {
  const markdown = item.markdown ?? ''
  const ids = libraryLinks(markdown)
  const blobs = await Promise.all(ids.map(id => readLibraryBlob(id).catch(() => null)))
  const found = ids.map((id, index) => ({ blob: blobs[index], id })).filter(entry => entry.blob)

  const names = uniqueNames(
    found.map(entry => `image-${entry.id}.${(entry.blob as Blob).type.split('/')[1]?.split('+')[0] || 'bin'}`)
  )

  const paths: Record<string, string> = {}
  const entries: ZipEntry[] = []

  for (const [index, entry] of found.entries()) {
    paths[entry.id] = `assets/${names[index]}`
    entries.push({ data: await bytesOf(entry.blob as Blob), name: `${folder}assets/${names[index]}` })
  }

  return [{ data: relinkLibrary(markdown, paths), name: `${folder}${safeName(item.title, 'Page')}.md` }, ...entries]
}

async function folderEntries(
  folderId: string,
  prefix: string,
  budget: { bytes: number; count: number }
): Promise<ZipEntry[]> {
  const { items } = await listLibrary({ order: 'asc', parentId: folderId, sort: 'name' })
  const names = uniqueNames(items.map(child => safeName(child.title || child.file_name || '', 'Untitled')))
  const entries: ZipEntry[] = []

  for (const [index, child] of items.entries()) {
    budget.count += 1

    if (budget.count > FOLDER_MAX_ITEMS) {
      throw new Error(translateNow('library.export.tooMany'))
    }

    if (child.kind === 'folder') {
      entries.push(...(await folderEntries(child.id, `${prefix}${names[index]}/`, budget)))
    } else if (child.kind === 'file') {
      const blob = await readLibraryBlob(child.id)

      budget.bytes += blob.size

      if (budget.bytes > FOLDER_MAX_BYTES) {
        throw new Error(translateNow('library.export.tooLarge'))
      }

      entries.push({ data: await bytesOf(blob), name: `${prefix}${child.file_name || names[index]}` })
    } else {
      const { item } = await getLibraryItem(child.id)

      entries.push({ data: item.markdown ?? '', name: `${prefix}${names[index]}.md` })
    }
  }

  return entries
}

/** Everything `format` makes for `item`, or why not. Pages and decks are read fresh from the Library. */
export async function exportItem(item: LibraryItem, format: ExportFormat): Promise<void> {
  try {
    const full = item.kind === 'page' ? (await getLibraryItem(item.id)).item : item
    const type = subjectType({ ...full, deck: isDeck(full.markdown) })
    const name = titleOf(full)

    if (type === 'page') {
      if (format === 'pdf' || format === 'html') {
        return void (await exportPage(full.id, format))
      }

      if (format === 'markdown') {
        save(full.markdown ?? '', `${name}.md`, MIME.markdown!)
      } else {
        const { pageHtml } = await import('./page-export')

        const html = await pageHtml({
          content: full.content ?? null,
          fit: true,
          markdown: full.markdown ?? '',
          title: name
        })

        save(
          buildZip([...(await pageFiles(full, `${name}/`)), { data: html, name: `${name}/${name}.html` }]),
          `${name}.zip`,
          MIME.zip!
        )
      }

      return done()
    }

    if (type === 'deck') {
      const deck = parseDeck(full.markdown ?? '')

      if (format === 'pptx') {
        return void (await exportDeckPptx(deck, name))
      }

      if (format === 'pdf') {
        return void (await exportDeckPdf(deck, name))
      }

      if (format === 'docx') {
        save(await buildDocx(deck, name, loadPptxImage), `${name}.docx`, MIME.docx!)

        return done()
      }

      if (format === 'markdown') {
        save(full.markdown ?? '', `${name}.md`, MIME.markdown!)

        return done()
      }

      const slides = await renderSlides(full.markdown ?? '')
      const pictures = slides.map((data, index) => ({ data, name: `slides/${String(index + 1).padStart(2, '0')}.png` }))

      if (format === 'images') {
        save(
          buildZip(pictures.map(entry => ({ ...entry, name: entry.name.replace('slides/', '') }))),
          `${name} slides.zip`,
          MIME.zip!
        )
      } else {
        const pptx = await buildPptx(deck, name, loadPptxImage)

        save(
          buildZip([
            { data: pptx, name: `${name}.pptx` },
            { data: full.markdown ?? '', name: `${name}.md` },
            ...pictures
          ]),
          `${name}.zip`,
          MIME.zip!
        )
      }

      return done()
    }

    if (type === 'folder') {
      notify({ durationMs: 2500, kind: 'info', message: translateNow('library.export.preparing') })
      save(buildZip(await folderEntries(full.id, `${name}/`, { bytes: 0, count: 0 })), `${name}.zip`, MIME.zip!)

      return done()
    }

    const blob = await readLibraryBlob(full.id)
    const original = full.file_name || `${name}.${extensionOf(full.file_name)}`

    if (format === 'original') {
      save(blob, original, blob.type || 'application/octet-stream')
    } else if (format === 'zip') {
      save(buildZip([{ data: await bytesOf(blob), name: original }]), `${name}.zip`, MIME.zip!)
    } else if (type === 'image') {
      const target = `image/${format === 'jpeg' ? 'jpeg' : format}` as 'image/jpeg' | 'image/png' | 'image/webp'

      save(await convertImage(blob, target), `${name}.${EXTENSION[format]}`, MIME[format]!)
    } else {
      // A table: read the rows once, write them in the chosen form.
      const table = readTable(await blob.text(), full.file_name)

      const text: Partial<Record<ExportFormat, () => Uint8Array | string>> = {
        csv: () => tableToCsv(table),
        json: () => tableToJson(table),
        markdown: () => tableToMarkdown(table),
        tsv: () => tableToTsv(table),
        xlsx: () => buildXlsx(table, name)
      }

      save(text[format]!(), `${name}.${EXTENSION[format]}`, MIME[format]!)
    }

    done()
  } catch (error) {
    notifyError(error, translateNow('library.actions.exportFailed'))
  }
}
