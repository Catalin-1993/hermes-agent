'use client'

import type { Mermaid as MermaidApi } from 'mermaid'
import { useEffect, useState } from 'react'

import { chatMermaidSource, mermaidKind } from '@/lib/mermaid-source'
import { normalizeSvgSize, xmlWellFormedSvg } from '@/lib/svg-image'

import { SERIES_TOKENS } from '../charts/chart-option'
import { DiagramFigure } from '../diagram-figure'
import { FigureSkeleton, FigureSource } from '../figure-card'
import { collectThemeBridge } from '../widget-frame-doc'

import { createMermaidRenderCache, createRetryableLoader, nextPaint } from './mermaid-render-cache'
import type { RichFenceProps } from './types'
import { useIsDark } from './use-is-dark'

let lastTheme: null | string = null
const loadMermaid = createRetryableLoader<MermaidApi>(() => import('mermaid').then(module => module.default))

type Rgba = [number, number, number, number]

const FALLBACK_HUES = ['#d97706', '#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#dc2626', '#ca8a04']

/** A computed colour (`rgb()`, `rgba()` or `color(srgb …)`) as 0–255 channels and alpha. */
function parseComputed(color: string): null | Rgba {
  const srgb = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+))?\)$/.exec(color)

  if (srgb) {
    return [
      Number(srgb[1]) * 255,
      Number(srgb[2]) * 255,
      Number(srgb[3]) * 255,
      srgb[4] === undefined ? 1 : Number(srgb[4])
    ]
  }

  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/.exec(color)

  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])] : null
}

const parseHex = (value: string): null | Rgba => {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)

  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16), 1] : null
}

const hex = (channels: readonly number[]) =>
  `#${channels
    .map(value =>
      Math.round(Math.min(255, Math.max(0, value)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`

/**
 * A theme colour as mermaid can read it: opaque hex. Mermaid derives shades with a parser that knows neither
 * CSS Color 4 nor part-transparent tints, so a tint is laid over the page colour first — the hex is exactly
 * what the reader sees.
 */
function concrete(css: string, page: Rgba, fallback: string): string {
  if (typeof document === 'undefined' || !css) {
    return fallback
  }

  const probe = document.createElement('span')

  probe.style.color = css
  document.body.append(probe)
  const parsed = parseComputed(getComputedStyle(probe).color)
  probe.remove()

  if (!parsed) {
    return fallback
  }

  const [r, g, b, alpha] = parsed

  return hex([r, g, b].map((value, index) => value * alpha + page[index] * (1 - alpha)))
}

/**
 * The diagram in the app's own look: its ink, hairlines, surfaces, accent and font (the bridge widgets use),
 * with rounded nodes and thin lines — not mermaid's stock lavender and serif. The key names the palette, so a
 * theme or accent change draws the diagram again.
 */
function appMermaidTheme(dark: boolean): { key: string; config: Parameters<MermaidApi['initialize']>[0] } {
  const { font, vars } = collectThemeBridge()
  // Diagrams sit on the figure card, so its surface is the colour every tint is laid over.
  const fallbackPage: Rgba = dark ? [17, 17, 19, 1] : [250, 250, 249, 1]
  const card = parseHex(concrete(vars['--surface'] ?? '', fallbackPage, hex(fallbackPage.slice(0, 3))))
  const page: Rgba = card ?? fallbackPage
  const ink = concrete(vars['--foreground'] ?? '', page, dark ? '#f5f5f4' : '#1c1917')
  const muted = concrete(vars['--muted-foreground'] ?? '', page, dark ? '#a8a29e' : '#78716c')
  const accent = concrete(vars['--accent'] ?? '', page, dark ? '#fbbf24' : '#92400e')

  const surface = concrete(
    `color-mix(in srgb, ${ink} ${dark ? 7 : 4}%, transparent)`,
    page,
    dark ? '#1f1f22' : '#f2f2f0'
  )

  const line = concrete(
    `color-mix(in srgb, ${ink} ${dark ? 26 : 22}%, transparent)`,
    page,
    dark ? '#4a4a4f' : '#d6d3d1'
  )

  const background = hex(page.slice(0, 3))

  // Distinct hues for diagrams that colour by branch, section or period (gitGraph, mindmap, timeline,
  // journey): the chart palette's tokens, so a diagram and a chart beside it agree.
  const rootStyle = getComputedStyle(document.documentElement)

  const hues = SERIES_TOKENS.map((name, index) =>
    concrete(rootStyle.getPropertyValue(name).trim(), page, FALLBACK_HUES[index])
  )

  const scale = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => {
      const hue = hues[index % hues.length]
      const soft = concrete(`color-mix(in srgb, ${hue} ${dark ? 30 : 18}%, ${background})`, page, surface)

      return [
        [`cScale${index}`, soft],
        [`cScaleLabel${index}`, ink],
        [`cScalePeer${index}`, hue],
        [`git${index}`, hue],
        [`gitBranchLabel${index}`, background],
        [`gitInv${index}`, background],
        [`pie${index + 1}`, hue]
      ]
    }).flat()
  )

  const themeVariables = {
    background,
    clusterBkg: surface,
    clusterBorder: line,
    darkMode: dark,
    edgeLabelBackground: background,
    fontFamily: font || 'inherit',
    fontSize: '14px',
    lineColor: muted,
    mainBkg: surface,
    nodeBorder: line,
    noteBkgColor: surface,
    noteBorderColor: line,
    noteTextColor: ink,
    primaryBorderColor: line,
    primaryColor: surface,
    primaryTextColor: ink,
    secondaryColor: surface,
    tertiaryColor: surface,
    textColor: ink,
    titleColor: ink,
    ...scale,
    commitLabelBackground: surface,
    commitLabelColor: muted,
    commitLabelFontSize: '11px',
    pieSectionTextColor: background,
    pieStrokeColor: background,
    pieTitleTextColor: ink,
    rowEven: background,
    rowOdd: surface,
    attributeBackgroundColorEven: background,
    attributeBackgroundColorOdd: surface,
    pieLegendTextColor: ink,
    tagLabelBackground: surface,
    tagLabelBorder: line,
    tagLabelColor: ink
  }

  return {
    config: {
      flowchart: { curve: 'basis', nodeSpacing: 36, padding: 12, rankSpacing: 44 },
      fontFamily: font || 'inherit',
      securityLevel: 'strict',
      startOnLoad: false,
      theme: 'base',
      themeCSS: `.node rect, .node polygon, .cluster rect { rx: 8px; ry: 8px; stroke-width: 1px; }
        rect.actor, rect.note, rect.labelBox, .classGroup rect, g.classGroup > rect { rx: 6px; ry: 6px; }
        .edgePath path, .flowchart-link { stroke-width: 1.25px; }
        .node.accent rect, .node.accent polygon { stroke: ${accent}; }`,
      themeVariables
    },
    key: `${dark ? 'dark' : 'light'}|${ink}|${muted}|${accent}|${hues.join(',')}|${font}`
  }
}

// Re-initialise only on first use / theme change. `securityLevel: 'strict'` makes
// mermaid sanitise label HTML and drop click handlers, so the rendered SVG is
// safe to inject.
function ensureInit(mermaid: MermaidApi, dark: boolean): string {
  const theme = appMermaidTheme(dark)

  if (theme.key !== lastTheme) {
    mermaid.initialize(theme.config)
    lastTheme = theme.key
  }

  return theme.key
}

const renderCache = createMermaidRenderCache({
  maxEntries: 32,
  render: async (code, theme) => {
    const mermaid = await loadMermaid()
    ensureInit(mermaid, theme.startsWith('dark'))
    const id = `mmd-${Math.random().toString(36).slice(2)}`
    const result = await mermaid.render(id, code)

    // Mermaid's markup targets inline HTML, so a label's `<br/>` reaches us as
    // an open `<br>` and a non-breaking space as `&nbsp;`; make it XML before
    // the size pass and the data: URI below, or the diagram decodes to a
    // broken image (#133089).
    return normalizeSvgSize(xmlWellFormedSvg(result.svg))
  },
  // Defer until the source fallback has had a frame to paint, so the mermaid
  // runtime import and parse/layout cannot contend with first paint of the
  // message body (#98967's seam; requestIdleCallback is inert in jsdom).
  defer: nextPaint
})

function svgAccessibleText(svg: string, code: string): string {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')

  const text = [document.querySelector('title')?.textContent, document.querySelector('desc')?.textContent]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value))

  return text.join(' — ') || `Diagram (${mermaidKind(chatMermaidSource(code)) || 'mermaid'})`
}

// Lazy chunk (pulls in mermaid). Renders ```mermaid fences as diagrams; shows
// the source while the message streams (partial syntax throws) and falls back
// to source on parse failure.
export default function MermaidRenderer({ code, streaming }: RichFenceProps) {
  const isDark = useIsDark()
  const [svg, setSvg] = useState('')
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
        const rendered = await renderCache.render(
          chatMermaidSource(code),
          appMermaidTheme(isDark).key,
          controller.signal
        )

        if (!cancelled) {
          setSvg(rendered)
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
  }, [code, isDark, streaming])

  if (failed) {
    return <FigureSource code={code} />
  }

  if (streaming || !svg) {
    return <FigureSkeleton height="12rem" />
  }

  return <DiagramFigure alt={svgAccessibleText(svg, code)} kind="mermaid" svg={svg} />
}
