import { translateNow } from '@/i18n'
import { notify, notifyError } from '@/store/notifications'

import { getLibraryItem } from './data'

const fileNameOf = (title: string) =>
  `${
    [...title]
      .filter(char => char.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(char))
      .join('')
      .trim()
      .slice(0, 80) || 'Page'
  }.html`

/** A page, as its own HTML file (a download) or through the system's print sheet (Save as PDF). The
 *  blocks stay alive in the file; printing takes them as they are drawn now. */
export async function exportPage(itemId: string, kind: 'html' | 'pdf'): Promise<void> {
  try {
    const { item } = await getLibraryItem(itemId)
    const { pageHtml } = await import('./page-export')
    const title = item.title || translateNow('library.untitled')

    const html = await pageHtml({
      content: item.content ?? null,
      fit: kind === 'html',
      markdown: item.markdown ?? '',
      title
    })

    if (kind === 'html') {
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download = fileNameOf(title)
      anchor.click()
      URL.revokeObjectURL(url)
      notify({ durationMs: 2000, kind: 'success', message: translateNow('library.actions.exported') })

      return
    }

    printHtml(html)
  } catch (error) {
    notifyError(error, translateNow('library.actions.exportFailed'))
  }
}

/** Print a document from a frame nobody sees; the frame goes when the sheet closes. */
export function printHtml(html: string) {
  const frame = document.createElement('iframe')

  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'

  const remove = () => frame.remove()

  frame.onload = () => {
    const win = frame.contentWindow

    win?.addEventListener('afterprint', remove)
    // Frames inside the page draw after it loads; the sheet should find them drawn.
    window.setTimeout(() => win?.print(), 700)
    window.setTimeout(remove, 120_000)
  }

  frame.srcdoc = html
  document.body.append(frame)
}
