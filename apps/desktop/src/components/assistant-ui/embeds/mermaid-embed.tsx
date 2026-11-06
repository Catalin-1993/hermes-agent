'use client'

import { useStore } from '@nanostores/react'
import katex from 'katex'
import { atom, onMount } from 'nanostores'
import type { MathResolver } from 'pele'
import { useEffect, useState } from 'react'

import { onThemeRepaint } from '@/hooks/use-theme-epoch'
import { useI18n } from '@/i18n'
import { chatMermaidSource, mermaidKind, topDownFlowchart, withoutErrorLine } from '@/lib/mermaid-source'
import { normalizeSvgSize, svgSize } from '@/lib/svg-image'

import { DiagramFigure } from '../diagram-figure'
import { FigureSkeleton, FigureSource } from '../figure-card'

import { createMermaidRenderCache, createRetryableLoader, nextPaint } from './mermaid-render-cache'
import type { RichFenceProps } from './types'

// Pele (obsidianmd/pele) draws Mermaid syntax as plain SVG. Its lazy entry
// puts each diagram type in its own chunk, so a flowchart pulls in only the
// flowchart parser and layout.
const loadPele = createRetryableLoader(() => import('pele/lazy'))

// Pele colors a diagram through `--pele-*` custom properties. The SVG is shown
// as an <img>: its own document, with no scripts and no access to the app's
// CSS. So the app's tokens are resolved to concrete colors here and written
// onto the SVG root. These are the `--dt-*` tokens: Tailwind's `--color-*`
// names are `@theme inline`, so they never exist as runtime properties.
const PALETTE: ReadonlyArray<readonly [pele: string, token: string]> = [
  ['--pele-bg', '--dt-background'],
  ['--pele-fg', '--dt-foreground'],
  ['--pele-muted', '--dt-muted-foreground'],
  ['--pele-line', '--dt-muted-foreground'],
  ['--pele-surface', '--dt-muted'],
  ['--pele-surface-alt', '--dt-card'],
  ['--pele-border', '--dt-muted-foreground'],
  ['--pele-accent', '--dt-primary'],
  ['--pele-critical', '--dt-destructive']
]

interface DiagramTheme {
  font: string
  fontMono: string
  vars: string
}

// Resolved through probes, so color-mix() and oklch() tokens arrive as values
// the isolated SVG document can use. Each token is probed once and all probes
// are styled before any is read, so the pass costs one style recalc. A token
// that does not resolve (unset, or a broken var() chain in a skin) is left
// out, so Pele's own default applies instead of the probe's inherited color.
const UNRESOLVED = 'rgb(1, 2, 3)'
const TOKENS = [...new Set(PALETTE.map(([, token]) => token))]

function resolveTheme(): DiagramTheme {
  const root = getComputedStyle(document.documentElement)
  const host = document.createElement('div')
  host.style.display = 'none'

  const probes = TOKENS.map(token => {
    const probe = document.createElement('span')
    probe.style.color = `var(${token}, ${UNRESOLVED})`

    return probe
  })

  host.append(...probes)
  document.body.append(host)

  const colors = new Map(TOKENS.map((token, i) => [token, getComputedStyle(probes[i]).color]))

  host.remove()

  const vars = PALETTE.flatMap(([pele, token]) => {
    const color = colors.get(token)

    return !color || color === UNRESOLVED ? [] : [`${pele}:${color}`]
  }).join(';')

  return {
    font: root.getPropertyValue('--dt-font-sans').trim() || 'sans-serif',
    fontMono: root.getPropertyValue('--dt-font-mono').trim() || 'monospace',
    vars
  }
}

// One resolved theme shared by every mounted diagram, re-resolved once per
// theme repaint (mode flip or skin change) rather than once per diagram. The
// first read mounts the store (nanostores' get() runs onMount), so a diagram
// renders with the resolved palette, and a later mount re-resolves rather
// than reusing one from before. The initial value is Pele's own defaults.
const $diagramTheme = atom<DiagramTheme>({ font: 'sans-serif', fontMono: 'monospace', vars: '' })

onMount($diagramTheme, () => {
  $diagramTheme.set(resolveTheme())

  return onThemeRepaint(() => $diagramTheme.set(resolveTheme()))
})

// Pele's root always carries a style attribute; the palette goes in front of
// it, so Pele's own `var(--pele-*, default)` references pick it up. Colors are
// computed values (rgb()/color()/oklch()) and carry no quote or ampersand.
function withPalette(svg: string, vars: string): string {
  return vars ? svg.replace(/^<svg\b[^>]*?\sstyle="/, root => `${root}${vars};`) : svg
}

// Pele leaves typesetting $$TeX$$ labels to the host. KaTeX's MathML output
// needs no stylesheet or webfonts, so it draws inside the isolated <img> SVG
// and in the PNG copy alike (Chromium renders MathML natively), as mermaid's
// did. Pele sizes each label from the measurement below. It is taken in a
// shadow root, which the app stylesheet can't reach (it enlarges KaTeX's
// `.katex` wrapper and restyles bare elements), so the size matches what the
// stylesheet-free SVG draws. Display mode, as mermaid used: inline mode
// rejects display-only TeX such as \tag. TeX KaTeX can't parse returns null,
// and Pele shows the source.
const typesetMath: MathResolver = (tex, size) => {
  let html: string

  try {
    html = katex
      .renderToString(tex, { displayMode: true, output: 'mathml', strict: 'ignore', throwOnError: true })
      .replace(/^<span class="katex">([\s\S]*)<\/span>$/, '$1')
  } catch {
    return null
  }

  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;visibility:hidden'
  const probe = document.createElement('span')
  probe.style.cssText = `display:inline-block;white-space:nowrap;line-height:normal;font-size:${size}px`
  probe.innerHTML = html
  host.attachShadow({ mode: 'open' }).append(probe)
  document.body.append(host)
  const { height, width } = probe.getBoundingClientRect()
  // The browser-hosted app's UI scale is CSS zoom on <html>; the rect is in
  // zoomed pixels, the SVG draws at the unzoomed font size.
  const zoom = probe.currentCSSZoom || 1
  host.remove()

  return { height: Math.ceil(height / zoom), html, width: Math.ceil(width / zoom) }
}

const renderCache = createMermaidRenderCache<DiagramTheme>({
  maxEntries: 32,
  render: async (code, theme) => {
    const pele = await loadPele()

    // Links and images off: the diagram is display-only, as under mermaid's
    // strict mode (no click handlers, no remote fetches).
    const { svg } = await pele.renderAsync(code, {
      fontFamily: theme.font,
      fontFamilyMono: theme.fontMono,
      images: false,
      links: false,
      math: typesetMath
    })

    return normalizeSvgSize(withPalette(svg, theme.vars))
  },
  // Defer until the source fallback has had a frame to paint, so the chunk
  // import cannot contend with first paint of the message body (#98967's seam;
  // requestIdleCallback is inert in jsdom).
  defer: nextPaint
})

/** Lines a model garbled that a diagram may lose before it is shown as source instead. */
const MAX_SKIPPED_LINES = 3
/** A left-to-right flowchart wider than this (and much wider than tall) is drawn top-down to stay readable. */
const SIDEWAYS_MAX_WIDTH = 900
const SIDEWAYS_MAX_RATIO = 2.6

/**
 * The diagram as the chat shows it: lines that cannot be parsed are left out (and counted), and a flowchart
 * running far wider than the column is drawn top-down instead.
 */
async function drawDiagram(
  code: string,
  theme: DiagramTheme,
  signal: AbortSignal
): Promise<{ skipped: number; svg: string }> {
  let source = chatMermaidSource(code)

  for (let skipped = 0; ; skipped++) {
    try {
      const svg = await renderCache.render(source, theme, signal)
      const turned = topDownFlowchart(source)
      const { height, width } = svgSize(svg)

      if (turned && width > SIDEWAYS_MAX_WIDTH && width > height * SIDEWAYS_MAX_RATIO) {
        try {
          return { skipped, svg: await renderCache.render(turned, theme, signal) }
        } catch {
          return { skipped, svg }
        }
      }

      return { skipped, svg }
    } catch (error) {
      const next =
        skipped < MAX_SKIPPED_LINES && !signal.aborted
          ? withoutErrorLine(source, error instanceof Error ? error.message : String(error))
          : null

      if (next === null) {
        throw error
      }

      source = next
    }
  }
}

function svgAccessibleText(svg: string, code: string): string {
  const fallback = `Diagram (${mermaidKind(chatMermaidSource(code)) || 'mermaid'})`

  // Pele writes accTitle/accDescr (or a diagram title) as the root's own
  // <title>/<desc>; nested ones are tooltips and labels, not a name for the
  // whole diagram. Skip the parse when there are none.
  if (!svg.includes('<title') && !svg.includes('<desc')) {
    return fallback
  }

  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement

  const text = [root.querySelector(':scope > title')?.textContent, root.querySelector(':scope > desc')?.textContent]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value))

  return text.join(' — ') || fallback
}

// Lazy chunk (pulls in Pele). Renders ```mermaid fences as diagrams in the
// chat's figure card; a skeleton while the message streams (partial syntax
// throws) and the source on parse failure.
export default function MermaidRenderer({ code, streaming }: RichFenceProps) {
  const theme = useStore($diagramTheme)
  const { t } = useI18n()
  const [svg, setSvg] = useState('')
  const [skipped, setSkipped] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (streaming) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    setFailed(false)
    setSvg('')

    void (async () => {
      try {
        const drawn = await drawDiagram(code, theme, controller.signal)

        if (!cancelled) {
          setSkipped(drawn.skipped)
          setSvg(drawn.svg)
        }
      } catch {
        if (!cancelled) {
          setFailed(true)
          setSvg('')
        }
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [code, theme, streaming])

  if (failed) {
    return <FigureSource code={code} />
  }

  if (streaming || !svg) {
    return <FigureSkeleton height="12rem" />
  }

  return (
    <DiagramFigure
      alt={svgAccessibleText(svg, code)}
      kind="mermaid"
      note={skipped > 0 ? t.inlineWidget.diagramLinesSkipped(skipped) : undefined}
      svg={svg}
    />
  )
}
