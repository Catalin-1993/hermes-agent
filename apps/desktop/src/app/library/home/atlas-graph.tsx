import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from 'd3-force'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

import { $atlasSelection, type AtlasLink, type AtlasMode, type AtlasNode, selectionKindFor } from './atlas-data'

interface GNode extends AtlasNode, SimulationNodeDatum {
  r: number
  /** 0 (few links / mentions) → 1 (many), for color. */
  heat: number
  x: number
  y: number
}

interface GLink extends SimulationLinkDatum<GNode> {
  source: GNode
  target: GNode
  type: string
  weight: number
}

interface Camera {
  k: number
  x: number
  y: number
}

type Rgb = readonly [number, number, number]

interface Palette {
  accent: Rgb
  cool: Rgb
  hot: Rgb
  links: Record<string, Rgb>
  mid: Rgb
  text: Rgb
  textMuted: Rgb
}

/** Link kinds shown in the legend, in order; anything else is drawn as `semantic`. */
export const LINK_KINDS = ['semantic', 'temporal', 'entity', 'causal', 'cooccurrence'] as const

const LINK_VAR: Record<string, string> = {
  causal: '--ui-purple',
  cooccurrence: '--ui-accent',
  entity: '--ui-orange',
  semantic: '--ui-blue',
  temporal: '--ui-cyan'
}

const MIN_K = 0.25
const MAX_K = 4
const HIT_SLOP = 5
// With this many nodes or fewer every label is drawn; past it, only the strongest and the hovered.
const ALL_LABELS_MAX = 24
// Fact labels are sentences: only the few strongest carry one until a node is hovered.
const TOP_LABELS = 5
const INTRO_MS = 700
const FIT_EVENT = 'atlas-fit'

let probe: CanvasRenderingContext2D | null = null

/** Any CSS color the theme uses (hex, rgb, oklch…) as sRGB bytes, read back off a 1×1 canvas. */
function toRgb(color: string, fallback: Rgb): Rgb {
  probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })

  if (!probe || !color) {
    return fallback
  }

  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data

  return a ? [r, g, b] : fallback
}

function readPalette(el: Element): Palette {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: Rgb) => toRgb(css.getPropertyValue(name).trim(), fallback)
  const blue: Rgb = [59, 130, 246]

  return {
    accent: v('--ui-accent', blue),
    cool: v('--ui-blue', blue),
    hot: v('--ui-orange', [249, 115, 22]),
    links: Object.fromEntries(Object.entries(LINK_VAR).map(([kind, name]) => [kind, v(name, blue)])),
    mid: v('--ui-purple', [139, 92, 246]),
    text: v('--ui-text-primary', [17, 24, 39]),
    textMuted: v('--ui-text-tertiary', [107, 114, 128])
  }
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t) as unknown as Rgb

const heatColor = (p: Palette, heat: number) =>
  heat < 0.5 ? mix(p.cool, p.mid, heat * 2) : mix(p.mid, p.hot, (heat - 0.5) * 2)

const rgba = ([r, g, b]: Rgb, alpha = 1) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`

const shortLabel = (node: AtlasNode) => {
  const text = (node.label || node.text).replace(/\.{3}$/, '…')

  return text.length > 34 ? `${text.slice(0, 33)}…` : text
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

function build(nodes: readonly AtlasNode[], links: readonly AtlasLink[], mode: AtlasMode) {
  // Heat is a node's rank among its peers, so a dense graph still spreads from cool to hot.
  const ranked = [...nodes].map(n => n.weight).sort((a, b) => a - b)
  const rank = (weight: number) => (ranked.length > 1 ? ranked.indexOf(weight) / (ranked.length - 1) : 0.5)
  const base = mode === 'entities' ? 6 : 4

  const gnodes: GNode[] = nodes.map((n, i) => {
    const heat = rank(n.weight)
    // Seed on a small spiral so the first frame is already a cluster, not a pile at the origin.
    const angle = i * 2.399
    const radius = 12 * Math.sqrt(i + 1)

    return { ...n, heat, r: base + heat * (mode === 'entities' ? 12 : 4), x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
  })

  const byId = new Map(gnodes.map(n => [n.id, n]))

  const glinks: GLink[] = links.flatMap(l => {
    const source = byId.get(l.source)
    const target = byId.get(l.target)

    return source && target ? [{ source, target, type: l.type, weight: l.weight }] : []
  })

  const neighbours = new Map<string, Set<string>>()

  for (const l of glinks) {
    neighbours.set(l.source.id, (neighbours.get(l.source.id) ?? new Set()).add(l.target.id))
    neighbours.set(l.target.id, (neighbours.get(l.target.id) ?? new Set()).add(l.source.id))
  }

  const maxLinkWeight = Math.max(1, ...glinks.map(l => l.weight))

  const sim: Simulation<GNode, GLink> = forceSimulation(gnodes)
    .force(
      'link',
      forceLink<GNode, GLink>(glinks)
        .distance(mode === 'entities' ? 90 : 70)
        .strength(l => 0.04 + 0.12 * (l.weight / maxLinkWeight))
    )
    .force('charge', forceManyBody<GNode>().strength(mode === 'entities' ? -260 : -170))
    .force('x', forceX<GNode>(0).strength(0.05))
    .force('y', forceY<GNode>(0).strength(0.05))
    .force('collide', forceCollide<GNode>(n => n.r + 6))
    .stop()

  const strongest = new Set([...gnodes].sort((a, b) => b.weight - a.weight).slice(0, TOP_LABELS).map(n => n.id))

  return { byId, links: glinks, neighbours, nodes: gnodes, sim, strongest }
}

function fit(nodes: readonly GNode[], width: number, height: number, maxK: number): Camera {
  if (!nodes.length || !width || !height) {
    return { k: 1, x: width / 2, y: height / 2 }
  }

  const xs = nodes.map(n => n.x)
  const ys = nodes.map(n => n.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const pad = 72
  const raw = Math.min((width - pad * 2) / (x1 - x0 || 1), (height - pad * 2) / (y1 - y0 || 1))
  // A sparse graph fills the frame, but is not blown up past a comfortable size.
  const k = Math.min(maxK, Math.max(MIN_K, raw))

  return { k, x: width / 2 - ((x0 + x1) / 2) * k, y: height / 2 - ((y0 + y1) / 2) * k }
}

interface AtlasGraphProps {
  links: readonly AtlasLink[]
  mode: AtlasMode
  nodes: readonly AtlasNode[]
  onSelect: (node: AtlasNode | null) => void
}

/** The memory as a constellation: one node per memory (or entity), drawn on a canvas. Scroll zooms,
 *  dragging pans, hovering lights a node's neighbours, clicking opens it beside the graph. */
export function AtlasGraph({ links, mode, nodes, onSelect }: AtlasGraphProps) {
  const { t } = useI18n()
  const copy = t.library.home
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hover, setHover] = useState<{ node: AtlasNode; x: number; y: number } | null>(null)
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!wrap || !canvas || !ctx) {
      return
    }

    const graph = build(nodes, links, mode)
    const still = reducedMotion()
    // Entities are few and named: they may come closer than a cloud of facts.
    const maxFit = mode === 'entities' ? 2.4 : 2.2
    const fontFamily = getComputedStyle(wrap).fontFamily || 'system-ui, sans-serif'
    let palette = readPalette(wrap)
    let size = { h: wrap.clientHeight, w: wrap.clientWidth }
    let camera: Camera = { k: 1, x: size.w / 2, y: size.h / 2 }
    let touched = false
    let hovered: GNode | null = null
    let frame = 0
    let born = performance.now()

    const resize = () => {
      const dpr = window.devicePixelRatio || 1

      size = { h: wrap.clientHeight, w: wrap.clientWidth }
      canvas.width = Math.round(size.w * dpr)
      canvas.height = Math.round(size.h * dpr)
      canvas.style.width = `${size.w}px`
      canvas.style.height = `${size.h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (!touched) {
        camera = fit(graph.nodes, size.w, size.h, maxFit)
      }
    }

    const draw = () => {
      const now = performance.now()
      const intro = still ? 1 : Math.min(1, (now - born) / INTRO_MS)
      const ease = 1 - (1 - intro) ** 3
      const picked = $atlasSelection.get()
      const selectedId = picked?.kind === selectionKindFor(mode) ? picked.id : null
      const selected = selectedId ? graph.byId.get(selectedId) : undefined
      const focus = hovered ?? selected ?? null
      const lit = focus ? (graph.neighbours.get(focus.id) ?? new Set<string>()) : null

      ctx.clearRect(0, 0, size.w, size.h)
      ctx.save()
      ctx.translate(camera.x, camera.y)
      ctx.scale(camera.k, camera.k)

      for (const l of graph.links) {
        const on = focus && (l.source.id === focus.id || l.target.id === focus.id)
        const color = palette.links[l.type] ?? palette.links.semantic

        ctx.strokeStyle = rgba(color, (on ? 0.75 : focus ? 0.05 : 0.16) * ease)
        ctx.lineWidth = (on ? 1.4 : 0.8) / camera.k
        ctx.beginPath()
        ctx.moveTo(l.source.x, l.source.y)
        ctx.lineTo(l.target.x, l.target.y)
        ctx.stroke()
      }

      for (const n of graph.nodes) {
        const dim = focus && n.id !== focus.id && !lit?.has(n.id)
        const color = heatColor(palette, n.heat)
        const r = n.r * (0.6 + 0.4 * ease)

        ctx.globalAlpha = (dim ? 0.25 : 1) * ease
        ctx.fillStyle = rgba(color, 0.16)
        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 1.8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = rgba(color)
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fill()

        if (n.id === selectedId) {
          ctx.strokeStyle = rgba(palette.accent)
          ctx.lineWidth = 2 / camera.k
          ctx.beginPath()
          ctx.arc(n.x, n.y, r + 4 / camera.k, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      ctx.globalAlpha = ease
      ctx.font = `${12.5 / camera.k}px ${fontFamily}`
      ctx.textBaseline = 'middle'

      for (const n of graph.nodes) {
        const show =
          n.id === focus?.id ||
          (lit?.has(n.id) && mode === 'entities') ||
          (!focus && (graph.nodes.length <= ALL_LABELS_MAX || graph.strongest.has(n.id)))

        if (!show) {
          continue
        }

        ctx.fillStyle = rgba(n.id === focus?.id ? palette.text : palette.textMuted)
        ctx.fillText(shortLabel(n), n.x + n.r + 6 / camera.k, n.y)
      }

      ctx.restore()
      ctx.globalAlpha = 1
    }

    const loop = () => {
      frame = 0

      if (!still && graph.sim.alpha() > graph.sim.alphaMin()) {
        graph.sim.tick()

        // Until the owner pans or zooms, the camera follows the layout as it settles.
        if (!touched) {
          camera = fit(graph.nodes, size.w, size.h, maxFit)
        }
      }

      draw()

      if (!still && (graph.sim.alpha() > graph.sim.alphaMin() || performance.now() - born < INTRO_MS)) {
        frame = requestAnimationFrame(loop)
      }
    }

    const redraw = () => {
      if (!frame) {
        frame = requestAnimationFrame(loop)
      }
    }

    const stopWatchingSelection = $atlasSelection.listen(redraw)

    // "Fit to view" sits outside the canvas: it asks through an event on the wrapper.
    const onFit = () => {
      touched = false
      camera = fit(graph.nodes, size.w, size.h, maxFit)
      redraw()
    }

    if (still) {
      graph.sim.tick(300)
    }

    resize()
    born = performance.now()
    redraw()

    const toWorld = (sx: number, sy: number) => ({ x: (sx - camera.x) / camera.k, y: (sy - camera.y) / camera.k })

    const hit = (sx: number, sy: number) => {
      const p = toWorld(sx, sy)
      let best: GNode | null = null
      let bestD = Infinity

      for (const n of graph.nodes) {
        const d = Math.hypot(n.x - p.x, n.y - p.y)

        if (d < n.r + HIT_SLOP / camera.k && d < bestD) {
          best = n
          bestD = d
        }
      }

      return best
    }

    let drag: { moved: boolean; sx: number; sy: number; x: number; y: number } | null = null

    const local = (event: PointerEvent | WheelEvent) => {
      const box = canvas.getBoundingClientRect()

      return { sx: event.clientX - box.left, sy: event.clientY - box.top }
    }

    const onDown = (event: PointerEvent) => {
      const { sx, sy } = local(event)

      drag = { moved: false, sx, sy, x: camera.x, y: camera.y }
      canvas.setPointerCapture(event.pointerId)
    }

    const onMove = (event: PointerEvent) => {
      const { sx, sy } = local(event)

      if (drag) {
        if (Math.hypot(sx - drag.sx, sy - drag.sy) > 3) {
          drag.moved = true
          touched = true
        }

        if (drag.moved) {
          camera = { ...camera, x: drag.x + sx - drag.sx, y: drag.y + sy - drag.sy }
          canvas.style.cursor = 'grabbing'
          redraw()

          return
        }
      }

      const next = hit(sx, sy)

      if (next !== hovered) {
        hovered = next
        canvas.style.cursor = next ? 'pointer' : 'grab'
        setHover(next ? { node: next, x: sx, y: sy } : null)
        redraw()
      } else if (next) {
        setHover({ node: next, x: sx, y: sy })
      }
    }

    const onUp = (event: PointerEvent) => {
      const { sx, sy } = local(event)

      if (drag && !drag.moved) {
        const node = hit(sx, sy)

        onSelect(node)
      }

      drag = null
      canvas.style.cursor = hovered ? 'pointer' : 'grab'
    }

    const onLeave = () => {
      hovered = null
      setHover(null)
      redraw()
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { sx, sy } = local(event)
      const k = Math.min(MAX_K, Math.max(MIN_K, camera.k * Math.exp(-event.deltaY * 0.0015)))
      const p = toWorld(sx, sy)

      touched = true
      camera = { k, x: sx - p.x * k, y: sy - p.y * k }
      redraw()
    }

    const observer = new ResizeObserver(() => {
      resize()
      redraw()
    })

    // The theme can change while the page is open: colors are read again from the tokens.
    const themeWatch = new MutationObserver(() => {
      palette = readPalette(wrap)
      redraw()
    })

    observer.observe(wrap)
    themeWatch.observe(document.documentElement, { attributeFilter: ['class', 'data-theme', 'style'], attributes: true })
    wrap.addEventListener(FIT_EVENT, onFit)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.style.cursor = 'grab'

    return () => {
      cancelAnimationFrame(frame)
      stopWatchingSelection()
      graph.sim.stop()
      observer.disconnect()
      themeWatch.disconnect()
      wrap.removeEventListener(FIT_EVENT, onFit)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
      setHover(null)
    }
  }, [links, mode, nodes, onSelect])

  return (
    <div className="relative size-full min-h-0 overflow-hidden" ref={wrapRef}>
      <canvas aria-label={copy.graphLabel} className="absolute inset-0 block touch-none" ref={canvasRef} role="img" />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-72 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-elevated) px-3 py-2 text-xs leading-relaxed text-(--ui-text-primary) shadow-lg"
          style={{ left: Math.min(hover.x + 14, (wrapRef.current?.clientWidth ?? 0) - 300), top: hover.y + 14 }}
        >
          <div className="line-clamp-4">{hover.node.text || hover.node.label}</div>
          <div className="mt-1 text-[0.6875rem] text-(--ui-text-tertiary)">
            {mode === 'entities' ? copy.mentions(hover.node.weight) : copy.links(hover.node.weight)}
          </div>
        </div>
      )}
      <div className="absolute right-3 bottom-3">
        <Tip label={copy.fit}>
          <Button aria-label={copy.fit} onClick={() => wrapRef.current?.dispatchEvent(new Event(FIT_EVENT))} size="icon-sm" variant="ghost">
            <Codicon name="screen-full" size="0.875rem" />
          </Button>
        </Tip>
      </div>
    </div>
  )
}
