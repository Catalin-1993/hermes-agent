import { useMemo } from 'react'

import { AgentCard, AgentCardSkeleton } from '../cards/agent-card'
import { parseCardSpec } from '../cards/card-spec'

import type { RichFenceProps } from './types'

// Lazy chunk. A ```card fence is one of the fixed moments — a place, a map, an itinerary, an event, a
// product, a link — as data; the app draws it. While the JSON is still arriving it holds its place; a
// spec that cannot be drawn throws, and the rich boundary shows the fence as code.
export default function CardRenderer({ code, streaming }: RichFenceProps) {
  const parsed = useMemo(() => parseCardSpec(code), [code])

  if ('error' in parsed) {
    if (streaming) {
      return <AgentCardSkeleton />
    }

    throw new Error(`card: ${parsed.error}`)
  }

  return <AgentCard spec={parsed.spec} />
}
