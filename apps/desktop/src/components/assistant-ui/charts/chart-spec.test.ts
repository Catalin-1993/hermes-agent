import { describe, expect, it } from 'vitest'

import { CHART_LIMITS, formatTick, formatValue, parseChartSpec } from './chart-spec'

const parse = (value: unknown) => parseChartSpec(JSON.stringify(value))

const spec = (value: unknown) => {
  const result = parse(value)

  if ('error' in result) {
    throw new Error(result.error)
  }

  return result.spec
}

describe('reading a ```chart fence', () => {
  it('takes the shapes models actually write: x or labels for categories, one data array for one series', () => {
    const viaX = spec({ data: [1, 2, 3], name: 'Sales', type: 'bar', x: ['a', 'b', 'c'] })
    const viaLabels = spec({ labels: ['a', 'b', 'c'], series: [{ data: [1, 2, 3] }], type: 'LINE' })

    expect(viaX.categories).toEqual(['a', 'b', 'c'])
    expect(viaX.series).toEqual([{ data: [1, 2, 3], name: 'Sales' }])
    expect(viaLabels.kind).toBe('line')
    expect(viaLabels.series[0]?.name).toBeTruthy()
  })

  it('reads slices from slices, items, or labels with data', () => {
    const fromLabels = spec({ data: [3, 1], labels: ['Yes', 'No'], type: 'donut' })
    const fromItems = spec({ items: [{ label: 'Yes', value: 3 }], type: 'pie' })

    expect(fromLabels.slices).toEqual([
      { name: 'Yes', value: 3 },
      { name: 'No', value: 1 }
    ])
    expect(fromItems.slices).toEqual([{ name: 'Yes', value: 3 }])
  })

  it('refuses what cannot be drawn, with a reason, instead of guessing', () => {
    const refusals = [
      'not json',
      JSON.stringify([1, 2]),
      JSON.stringify({ type: 'radar' }),
      JSON.stringify({ categories: ['a', 'b'], data: [1, 2, 3], type: 'bar' }),
      JSON.stringify({ categories: ['a'], data: ['x'], type: 'bar' }),
      JSON.stringify({ slices: [{ name: 'A', value: -1 }], type: 'pie' }),
      JSON.stringify({ columns: ['A', 'B'], rows: [[1]], type: 'table' }),
      JSON.stringify({ data: [[1, 2], [3]], type: 'scatter' }),
      JSON.stringify({ kpis: [{ value: 3 }], type: 'kpi' })
    ]

    for (const source of refusals) {
      const result = parseChartSpec(source)

      expect('error' in result && result.error.length > 0).toBe(true)
    }
  })

  it('keeps every payload within its limits', () => {
    const series = Array.from({ length: CHART_LIMITS.series + 1 }, () => ({ data: [1] }))

    expect('error' in parse({ categories: ['a'], series, type: 'bar' })).toBe(true)
    expect('error' in parse({ data: Array.from({ length: CHART_LIMITS.points + 1 }, () => 1), type: 'scatter' })).toBe(
      true
    )
  })

  it('keeps gaps in a series as gaps', () => {
    expect(spec({ categories: ['a', 'b', 'c'], data: [1, null, 3], type: 'line' }).series[0]?.data).toEqual([
      1,
      null,
      3
    ])
  })
})

describe('numbers on a chart', () => {
  const base = { currency: 'USD', unit: '' }

  it('reads a percentage the way people write it', () => {
    expect(formatValue({ ...base, format: 'percent' }, 12.5, 'en-US')).toBe('12.5%')
  })

  it('keeps ticks short and values exact', () => {
    expect(formatTick({ ...base, format: 'number' }, 125_000, 'en-US')).toBe('125K')
    expect(formatValue({ ...base, format: 'currency' }, 125_000, 'en-US')).toBe('$125,000')
    expect(formatValue({ currency: 'USD', format: 'number', unit: ' ms' }, 42, 'en-US')).toBe('42 ms')
  })
})
