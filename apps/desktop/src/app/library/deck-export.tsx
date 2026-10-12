import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { translateNow } from '@/i18n'
import { notify, notifyError } from '@/store/notifications'

import { readLibraryBlob } from './data'
import type { Deck } from './deck'
import { buildPptx, type PptxImage } from './deck-pptx'
import { Slide } from './deck-slide'
import { printHtml } from './page-export-actions'

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, char => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!)

const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** The deck as a printed page per slide, through the system's print sheet (Save as PDF). The slides'
 *  Library images are read first and handed over inline, since the print frame has no Library. */
export async function exportDeckPdf(deck: Deck, title: string): Promise<void> {
  try {
    const ids = new Set(
      deck.slides.flatMap(slide => [...slide.matchAll(/library:\/\/([\w-]+)/g)].map(match => match[1]))
    )

    const images: Record<string, string> = {}

    await Promise.all(
      [...ids].map(async id => {
        images[id] = await readLibraryBlob(id).then(dataUrl)
      })
    ).catch(() => undefined)

    const pages = deck.slides
      .map(
        slide =>
          `<section>${renderToStaticMarkup(createElement(Slide, { images, slide, theme: deck.theme }))}</section>`
      )
      .join('')

    printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page { size: 960px 540px; margin: 0 }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact }
html, body { margin: 0; padding: 0 }
section { width: 960px; height: 540px; overflow: hidden; break-after: page; page-break-after: always }
section:last-child { break-after: auto; page-break-after: auto }
</style></head><body>${pages}</body></html>`)
  } catch (error) {
    notifyError(error, translateNow('library.actions.exportFailed'))
  }
}

/** A slide picture as PowerPoint wants it: PNG or JPEG bytes and the pixel size. Library images and
 *  links are read; a format PowerPoint lacks (WebP, GIF) goes through a canvas to PNG. */
export async function loadPptxImage(src: string): Promise<null | PptxImage> {
  const id = /^library:\/\/([\w-]+)/.exec(src)?.[1]

  const blob = id
    ? await readLibraryBlob(id)
    : await fetch(src).then(response => (response.ok ? response.blob() : null))

  if (!blob) {
    return null
  }

  const bitmap = await createImageBitmap(blob)
  const { height: h, width: w } = bitmap

  if (blob.type === 'image/png' || blob.type === 'image/jpeg') {
    bitmap.close()

    return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: blob.type === 'image/png' ? 'png' : 'jpeg', h, w }
  }

  const canvas = document.createElement('canvas')

  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()

  const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))

  return png ? { bytes: new Uint8Array(await png.arrayBuffer()), ext: 'png', h, w } : null
}

const fileNameOf = (title: string) =>
  `${
    [...title]
      .filter(char => char.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(char))
      .join('')
      .trim()
      .slice(0, 80) || 'Presentation'
  }.pptx`

/** The deck as a PowerPoint file (also opens in Keynote and Google Slides): real text boxes you can edit. */
export async function exportDeckPptx(deck: Deck, title: string): Promise<void> {
  try {
    const bytes = await buildPptx(deck, title, loadPptxImage)

    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      })
    )

    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = fileNameOf(title)
    anchor.click()
    URL.revokeObjectURL(url)
    notify({ durationMs: 2500, kind: 'success', message: translateNow('library.actions.exported') })
  } catch (error) {
    notifyError(error, translateNow('library.actions.exportFailed'))
  }
}
