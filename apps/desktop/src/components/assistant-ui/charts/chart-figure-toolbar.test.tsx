/** A page that shows a figure as part of itself can leave out the chat's full-screen and Add-to-page buttons. */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ChartFigure } from './chart-figure'
import { parseChartSpec } from './chart-spec'

const spec = (() => {
  const parsed = parseChartSpec(JSON.stringify({ kpis: [{ label: 'Total', value: 10 }], type: 'kpi' }))

  if (!('spec' in parsed)) {
    throw new Error('test spec did not parse')
  }

  return parsed.spec
})()

const toolbarButtons = () => screen.queryAllByRole('button')

describe('ChartFigure toolbar', () => {
  it('keeps the full-screen and Add-to-page buttons by default, as in chat', () => {
    render(
      <TooltipProvider>
        <ChartFigure spec={spec} />
      </TooltipProvider>
    )

    expect(toolbarButtons().length).toBeGreaterThan(0)
  })

  it('leaves them out when the page asks', () => {
    render(
      <TooltipProvider>
        <ChartFigure spec={spec} toolbar={false} />
      </TooltipProvider>
    )

    expect(toolbarButtons()).toHaveLength(0)
  })
})
