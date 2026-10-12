import { useMemo } from 'react'

import { ChartFigure, ChartSkeleton } from '../charts/chart-figure'
import { parseChartSpec } from '../charts/chart-spec'

import type { RichFenceProps } from './types'

// Lazy chunk (pulls in ECharts). A ```chart fence is a chart as data; the app draws it. While the JSON
// is still arriving it holds its place; a spec that cannot be drawn throws, and the rich boundary shows
// the fence as code instead.
export default function ChartRenderer({ code, streaming }: RichFenceProps) {
  const parsed = useMemo(() => parseChartSpec(code), [code])

  if ('error' in parsed) {
    if (streaming) {
      return <ChartSkeleton />
    }

    throw new Error(`chart: ${parsed.error}`)
  }

  return <ChartFigure spec={parsed.spec} />
}
