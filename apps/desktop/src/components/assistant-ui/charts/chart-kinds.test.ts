import { describe, expect, it } from 'vitest'

import { chartHeight, chartOption, type ChartPalette } from './chart-option'
import { type ChartSpec, parseChartSpec } from './chart-spec'

const palette: ChartPalette = {
  accent: 'rgba(37, 99, 235, 1)',
  font: 'Inter',
  grid: 'rgba(0, 0, 0, 0.08)',
  muted: 'rgba(107, 114, 128, 1)',
  series: ['rgba(37, 99, 235, 1)', 'rgba(147, 51, 234, 1)', 'rgba(8, 145, 178, 1)'],
  shades: ['s1', 's2', 's3', 's4'],
  stroke: 'rgba(0, 0, 0, 0.14)',
  surface: 'rgba(255, 255, 255, 1)',
  text: 'rgba(29, 29, 31, 1)'
}

const spec = (value: unknown): ChartSpec => {
  const result = parseChartSpec(JSON.stringify(value))

  if ('error' in result) {
    throw new Error(result.error)
  }

  return result.spec
}

const firstSeries = (option: ReturnType<typeof chartOption>) => (option.series as { type: string }[])[0]

describe('dashboard tiles', () => {
  // The bug: a dashboard showed "Venit 52,400" and "Retur 2.8" — no tile could carry its own unit.
  it('gives each KPI its own format, unit, caption and good direction', () => {
    const [revenue, returns] = spec({
      kpis: [
        { currency: 'EUR', format: 'currency', hint: 'față de luna trecută', label: 'Venit', value: 52400 },
        { better: 'down', delta: 0.4, label: 'Retur', unit: '%', value: 2.8 }
      ],
      type: 'kpi'
    }).kpis

    expect(revenue).toMatchObject({ currency: 'EUR', format: 'currency', hint: 'față de luna trecută' })
    expect(returns).toMatchObject({ better: 'down', unit: '%' })
  })
})

describe('more ways to show data', () => {
  it('draws a funnel of stages, largest first', () => {
    const option = chartOption(
      spec({
        slices: [
          { name: 'Vizitatori', value: 1000 },
          { name: 'Clienți', value: 40 }
        ],
        type: 'funnel'
      }),
      palette,
      800
    )

    expect(firstSeries(option)).toMatchObject({ sort: 'descending', type: 'funnel' })
  })

  it('draws a gauge, capped at its max', () => {
    const gauge = spec({ max: 100, title: 'Obiectiv', type: 'gauge', value: 140 })

    expect(gauge.gauge).toEqual({ max: 100, value: 100 })
    expect(firstSeries(chartOption(gauge, palette, 800)).type).toBe('gauge')
    expect(chartHeight(gauge, 800)).toBeLessThanOrEqual(260)
    expect('error' in parseChartSpec('{"type": "gauge"}')).toBe(true)
  })

  it('draws a radar over its categories', () => {
    const option = chartOption(
      spec({
        categories: ['Forță', 'Cardio', 'Mobilitate'],
        series: [{ data: [7, 5, 4], name: 'Acum' }],
        type: 'radar'
      }),
      palette,
      800
    )

    expect((option.radar as { indicator: { name: string }[] }).indicator.map(axis => axis.name)).toEqual([
      'Forță',
      'Cardio',
      'Mobilitate'
    ])
  })

  it('draws a combo: bars with one series as a line over them', () => {
    const option = chartOption(
      spec({
        categories: ['Ian', 'Feb'],
        series: [
          { data: [10, 12], name: 'Venit' },
          { data: [8, 9], name: 'Medie', type: 'line' }
        ],
        type: 'bar'
      }),
      palette,
      800
    )

    expect((option.series as { type: string }[]).map(entry => entry.type)).toEqual(['bar', 'line'])
  })
})
