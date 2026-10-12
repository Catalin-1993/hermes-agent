'use client'

import { type ComponentType, lazy, type LazyExoticComponent, type ReactNode, Suspense } from 'react'

import { RichBoundary } from './rich-boundary'
import type { RichFenceProps } from './types'

// Root renderer for fenced code blocks: a language → lazy-renderer table. Each
// renderer is its own split chunk (chart pulls in ECharts, card MapLibre when it
// draws a map, svg DOMPurify; widget draws agent-written HTML in a sealed frame),
// loaded only when a block of that language appears. The Mermaid renderer defers
// its heavier runtime import until after its source fallback has had a chance to paint.
const LAZY_FENCE: Record<string, LazyExoticComponent<ComponentType<RichFenceProps>>> = {
  card: lazy(() => import('./card-embed')),
  chart: lazy(() => import('./chart-embed')),
  listing: lazy(() => import('./listing-embed')),
  mermaid: lazy(() => import('./mermaid-embed')),
  svg: lazy(() => import('./svg-embed')),
  widget: lazy(() => import('./widget-embed'))
}

/** Fences that run code or speak for the user. Where the text is only being looked at (an imported
 *  conversation) they stay code. */
const RUNS_CODE: ReadonlySet<string> = new Set(['card', 'widget'])

export const RICH_FENCE_LANGUAGES: ReadonlySet<string> = new Set(Object.keys(LAZY_FENCE))

interface RichCodeBlockProps extends RichFenceProps {
  /** Rendered for unhandled languages, while the chunk loads, and on failure
   *  (typically the normal syntax-highlighted code block). */
  fallback: ReactNode
  /** Show fences that run code (widgets) as plain code. */
  inert?: boolean
  language?: string
}

export function RichCodeBlock({ code, fallback, inert, language, streaming }: RichCodeBlockProps) {
  const name = language?.toLowerCase()
  const Renderer = name && !(inert && RUNS_CODE.has(name)) ? LAZY_FENCE[name] : undefined

  if (!Renderer) {
    return <>{fallback}</>
  }

  return (
    <RichBoundary fallback={fallback} resetKey={code}>
      <Suspense fallback={fallback}>
        <Renderer code={code} streaming={streaming} />
      </Suspense>
    </RichBoundary>
  )
}
