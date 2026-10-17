import { describe, expect, it } from 'vitest'

import { mermaidAsChart } from './mermaid-chart'

describe('mermaidAsChart', () => {
  // The bug: a mermaid pie on the app theme drew every slice in the same grey.
  it('turns a mermaid pie into a native pie chart', () => {
    const pie = 'pie showData\n    title Tehnologii\n    "TypeScript/React" : 35\n    "Python" : 25'

    expect(JSON.parse(mermaidAsChart(pie)!)).toEqual({
      slices: [
        { name: 'TypeScript/React', value: 35 },
        { name: 'Python', value: 25 }
      ],
      title: 'Tehnologii',
      type: 'pie'
    })
  })

  it('turns an xychart into native bars', () => {
    const xy = [
      'xychart-beta',
      '  title "Venituri lunare"',
      '  x-axis [Ian, Feb, Mar]',
      '  y-axis "Venit (mii €)" 0 --> 100',
      '  bar [32, 45, 51]'
    ].join('\n')

    expect(JSON.parse(mermaidAsChart(xy)!)).toEqual({
      categories: ['Ian', 'Feb', 'Mar'],
      horizontal: false,
      series: [{ data: [32, 45, 51], name: 'Venit (mii €)' }],
      title: 'Venituri lunare',
      type: 'bar'
    })
  })

  it('leaves other diagrams, and charts it cannot read, to mermaid', () => {
    expect(mermaidAsChart('flowchart TD\n A --> B')).toBeNull()
    expect(mermaidAsChart('pie\n "a" : lots')).toBeNull()
    expect(mermaidAsChart('xychart-beta\n x-axis [a, b]\n bar [1]')).toBeNull()
  })
})
