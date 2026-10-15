/**
 * An ```html fence the model meant to be SEEN — a page, a dashboard, a styled or scripted fragment — is drawn
 * in the chat as a widget (same sealed, themed frame as ```widget). Weaker models write their dashboards this
 * way instead of a ```widget fence, and showing the user a wall of code in place of the chart is the failure.
 * Plain markup with no styling or behaviour (a form the user asked to see the code of) stays code.
 */
const HTML_LANGUAGES = new Set(['html', 'htm', 'xhtml'])

const DOCUMENT = /^\s*(?:<!doctype\s+html|<html[\s>])/i
const VISUAL_PARTS = /<(?:style|script|svg|canvas)[\s>]/i

export function isVisualHtmlFence(language: string | undefined, code: string | undefined): boolean {
  const trimmed = (code ?? '').trim()

  if (!trimmed || !HTML_LANGUAGES.has((language ?? '').trim().toLowerCase())) {
    return false
  }

  return DOCUMENT.test(trimmed) || VISUAL_PARTS.test(trimmed)
}
