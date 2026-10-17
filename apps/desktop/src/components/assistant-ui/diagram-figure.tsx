import { useMemo, useState } from 'react'

import { ZoomPanViewer } from '@/components/ui/zoomable'
import { copySvgAsPng, svgSize } from '@/lib/svg-image'

import { FIGURE_CARD_CLASS, FigureArea } from './figure-card'
import { WidgetToolbar } from './widget-toolbar'

/** Below this share of its own size a diagram's text stops being readable; past it the diagram scrolls
 *  sideways in its card instead of shrinking further. */
const MIN_READABLE_SCALE = 0.64

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, char => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char)

/** The drawing as a page of its own, for the Library. */
export function diagramDocument(svg: string, title: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    '<style>body{margin:0;padding:8px;display:flex;justify-content:center}svg{max-width:100%;height:auto}</style>' +
    `</head><body>${svg}</body></html>`
  )
}

interface DiagramFigureProps {
  /** Short text for screen readers and the Library page title. */
  alt: string
  /** What drew it, for styling hooks and tests: `mermaid`, `svg`. */
  kind: string
  /** Well-formed, self-contained SVG markup (it is shown as an image, so nothing in it runs). */
  svg: string
}

/**
 * A diagram or graphic in the figure card: centred at its own size (never blown up), scaled down to fit
 * the card while its text stays readable, scrolled sideways past that. Click it, or the full-screen tool
 * on hover, to pan and zoom it; the viewer copies it as a PNG and the bookmark keeps it in the Library.
 */
export function DiagramFigure({ alt, kind, svg }: DiagramFigureProps) {
  const [open, setOpen] = useState(false)
  const size = useMemo(() => svgSize(svg), [svg])
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg])
  const html = useMemo(() => diagramDocument(svg, alt), [alt, svg])
  const width = Math.round(size.width)
  const readable = Math.round(size.width * MIN_READABLE_SCALE)

  return (
    <FigureArea>
      <div className={FIGURE_CARD_CLASS} data-diagram={kind}>
        <div className="-mx-2 overflow-x-auto px-2 [scrollbar-width:thin]">
          <button
            aria-label={alt}
            className="mx-auto block cursor-zoom-in rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--ui-accent)"
            onClick={() => setOpen(true)}
            style={{ width: `max(min(100%, ${width}px), ${readable}px)` }}
            type="button"
          >
            <img alt={alt} className="block h-auto max-h-[70dvh] w-full object-contain" draggable={false} src={src} />
          </button>
        </div>
        <WidgetToolbar globe={null} html={html} onExpandedChange={setOpen} />
      </div>
      {open && (
        <ZoomPanViewer onCopy={() => copySvgAsPng(svg)} onOpenChange={setOpen} open={open}>
          <img alt={alt} className="h-auto max-h-[80vh] max-w-[85vw]" draggable={false} src={src} />
        </ZoomPanViewer>
      )}
    </FigureArea>
  )
}
