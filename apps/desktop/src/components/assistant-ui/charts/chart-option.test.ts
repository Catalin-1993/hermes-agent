import { describe, expect, it } from 'vitest'

import { LIBRARY_HOSTS } from '@/lib/frame-policy'

import { chartDocument, ECHARTS_CDN } from './chart-document'
import { chartHeight, chartOption, type ChartPalette, withAlpha } from './chart-option'
import { type ChartSpec, parseChartSpec } from './chart-spec'

const palette: ChartPalette = {
  accent: 'rgba(37, 99, 235, 1)',
  font: 'Inter',
  grid: 'rgba(0, 0, 0, 0.08)',
  muted: 'rgba(107, 114, 128, 1)',
  series: ['rgba(37, 99, 235, 1)', 'rgba(147, 51, 234, 1)', 'rgba(8, 145, 178, 1)'],
  shades: ['s1', 's2', 's3', 's4', 's5', 's6'],
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

describe('the chart option', () => {
  it('shows a legend only when there is more than one series to tell apart', () => {
    const one = chartOption(spec({ categories: ['a'], data: [1], type: 'bar' }), palette, 800)

    const two = chartOption(
      spec({ categories: ['a'], series: [{ data: [1] }, { data: [2] }], type: 'bar' }),
      palette,
      800
    )

    expect((one.legend as { show?: boolean }).show).toBe(false)
    expect((two.legend as { show?: boolean }).show).not.toBe(false)
  })

  it('zooms long series without ever taking the plain mouse wheel from the chat', () => {
    const categories = Array.from({ length: 60 }, (_, index) => `d${index}`)

    const long = chartOption(
      spec({ categories, data: categories.map((_, index) => index), type: 'line' }),
      palette,
      800
    )

    const short = chartOption(spec({ categories: ['a', 'b'], data: [1, 2], type: 'line' }), palette, 800)
    const zoom = (long.dataZoom as { zoomOnMouseWheel?: unknown }[])[0]

    expect(zoom?.zoomOnMouseWheel).not.toBe(true)
    expect(short.dataZoom).toBeUndefined()
  })

  it('draws parts of a whole in shades of one hue, and a horizontal bar with its categories down the side', () => {
    const donut = chartOption(
      spec({
        slices: [
          { name: 'A', value: 1 },
          { name: 'B', value: 2 }
        ],
        type: 'donut'
      }),
      palette,
      800
    )

    const horizontal = chartOption(spec({ categories: ['a'], data: [1], horizontal: true, type: 'bar' }), palette, 800)

    expect(donut.color).toEqual(palette.shades)
    expect((horizontal.yAxis as { type: string }).type).toBe('category')
    expect((horizontal.xAxis as { type: string }).type).toBe('value')
  })

  // The bug: traffic shares (46/28/16/10) drew "100" in the well — a sum that says nothing.
  it('names a donut total in its well, and leaves the well empty for shares of a hundred', () => {
    const slices = (values: number[]) => values.map((value, index) => ({ name: `s${index}`, value }))
    const title = (option: ReturnType<typeof chartOption>) =>
      option.title as undefined | { subtext: string; text: string }

    const counts = chartOption(spec({ slices: slices([540, 260, 140, 60]), type: 'donut' }), palette, 800)
    const shares = chartOption(spec({ slices: slices([46, 28, 16, 10]), type: 'donut' }), palette, 800)

    expect(title(counts)).toMatchObject({ subtext: 'total', text: '1,000' })
    expect(title(shares)).toBeUndefined()
  })

  it('fades a palette colour without changing its hue', () => {
    expect(withAlpha('rgba(37, 99, 235, 1)', 0.2)).toBe('rgba(37, 99, 235, 0.2)')
    expect(withAlpha('#2563eb', 0.5)).toBe('rgba(37, 99, 235, 0.5)')
  })

  it('grows with its width within a calm band', () => {
    const bar = spec({ categories: ['a'], data: [1], type: 'bar' })

    expect(chartHeight(bar, 300)).toBeGreaterThanOrEqual(220)
    expect(chartHeight(bar, 3000)).toBeLessThanOrEqual(420)
    expect(chartHeight(bar, 700)).toBeGreaterThan(chartHeight(bar, 400))
  })
})

describe('a chart saved to the Library', () => {
  it('loads its engine from a CDN the sealed frame admits, and cannot break out of its script', () => {
    const chart = spec({ categories: ['a'], data: [1], title: '</script><b>x', type: 'bar' })
    const html = chartDocument(chart, { series: [{ name: '</script>', type: 'bar' }] })

    expect(LIBRARY_HOSTS).toContain(new URL(ECHARTS_CDN).host)
    expect(html).toContain(ECHARTS_CDN)
    expect(html.match(/<\/script>/g)).toHaveLength(2)
    expect(html).toContain('&lt;/script&gt;&lt;b&gt;x')
  })

  it('turns KPI tiles and tables into plain pages that need no script', () => {
    const table = chartDocument(spec({ columns: ['A', 'B'], rows: [['x', 1]], type: 'table' }), null)
    const kpi = chartDocument(spec({ kpis: [{ label: 'Revenue', value: 5 }], type: 'kpi' }), null)

    expect(table).not.toContain('<script')
    expect(table).toContain('<table>')
    expect(kpi).not.toContain('<script')
    expect(kpi).toContain('Revenue')
  })
})
