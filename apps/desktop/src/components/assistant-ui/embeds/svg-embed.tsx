'use client'

import DOMPurify from 'dompurify'
import { useMemo } from 'react'

import { useThemeEpoch } from '@/hooks/use-theme-epoch'
import { inkedSvg, normalizeSvgSize, xmlWellFormedSvg } from '@/lib/svg-image'

import { DiagramFigure } from '../diagram-figure'

import type { RichFenceProps } from './types'

/** The theme's text colour as plain rgb(), for an SVG shown as an image (it cannot read the page's CSS). */
function inkColor(): string {
  const context = document.createElement('canvas').getContext('2d')

  if (!context) {
    return '#888'
  }

  context.fillStyle = '#888'
  context.fillStyle = getComputedStyle(document.body).color
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data

  return `rgb(${r}, ${g}, ${b})`
}

// Lazy chunk (pulls in DOMPurify). Renders a ```svg fence in the figure card after hard-sanitising it:
// the svg profile strips scripts, event handlers and foreignObject, and the card shows it as an image,
// so untrusted model output can't execute.
export default function SvgRenderer({ code }: RichFenceProps) {
  const themeEpoch = useThemeEpoch()

  const clean = useMemo(() => {
    const sanitized = DOMPurify.sanitize(code, { USE_PROFILES: { svg: true, svgFilters: true } })

    return sanitized.trim() ? inkedSvg(normalizeSvgSize(xmlWellFormedSvg(sanitized)), inkColor()) : ''
    // The ink follows the theme: draw again when it repaints.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, themeEpoch])

  const title = useMemo(() => /<title[^>]*>([^<]{1,120})<\/title>/i.exec(clean)?.[1]?.trim() || 'Graphic', [clean])

  if (!clean) {
    return null
  }

  return <DiagramFigure alt={title} kind="svg" svg={clean} />
}
