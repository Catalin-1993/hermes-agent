import type { CSSProperties } from 'react'

import type { Span } from './deck-inline'

/** The choices of look a slide's words can take — fonts, sizes, colours — and how a span of words is drawn.
 *  The canvas, the editor and the exports all read from here. */

/** A slide is 960 points wide, as in PowerPoint, and is drawn in `cqw` (a hundredth of its width). */
export const PT_PER_CQ = 9.6

export const DECK_FONTS = [
  'Georgia',
  'Times New Roman',
  'Palatino',
  'Arial',
  'Helvetica',
  'Verdana',
  'Trebuchet MS',
  'Courier New'
] as const

const STACKS: Record<string, string> = {
  Arial: 'Arial, Helvetica, sans-serif',
  'Courier New': "'Courier New', Courier, monospace",
  Georgia: 'Georgia, serif',
  Helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  Palatino: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif",
  'Times New Roman': "'Times New Roman', Times, serif",
  'Trebuchet MS': "'Trebuchet MS', sans-serif",
  Verdana: 'Verdana, Geneva, sans-serif'
}

export const fontStack = (name: string) => STACKS[name] ?? `'${name}', sans-serif`

export const DECK_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 66, 80, 96] as const
export const MIN_SIZE = 6
export const MAX_SIZE = 200

/** Text colours on offer: ink and greys, then a quiet range of hues that read on light and dark themes alike. */
export const DECK_COLORS = [
  '#111111',
  '#4b5563',
  '#9ca3af',
  '#ffffff',
  '#dc2626',
  '#ea580c',
  '#d97706',
  '#16a34a',
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#db2777'
] as const

/** How one span of words is drawn on a slide, inline, so a PDF export needs no stylesheet. */
export function spanStyle(span: Omit<Span, 'text'>, accent: string, codeBackground: string): CSSProperties {
  const style: CSSProperties = {}
  const lines: string[] = []

  if (span.font) {
    style.fontFamily = fontStack(span.font)
  }

  if (span.size) {
    style.fontSize = `${span.size / PT_PER_CQ}cqw`
  }

  if (span.color) {
    style.color = span.color
  }

  if (span.bold) {
    style.fontWeight = 700
  }

  if (span.italic) {
    style.fontStyle = 'italic'
  }

  if (span.underline) {
    lines.push('underline')
  }

  if (span.strike) {
    lines.push('line-through')
  }

  if (span.link) {
    style.color = span.color ?? accent
    lines.push('underline')
    style.textUnderlineOffset = '0.3em'
  }

  if (span.code) {
    style.background = codeBackground
    style.borderRadius = '0.4cqw'
    style.fontFamily = "ui-monospace, 'Courier New', monospace"
    style.fontSize = span.size ? style.fontSize : '0.88em'
    style.padding = '0.1em 0.35em'
  }

  if (lines.length) {
    style.textDecoration = [...new Set(lines)].join(' ')
  }

  return style
}
