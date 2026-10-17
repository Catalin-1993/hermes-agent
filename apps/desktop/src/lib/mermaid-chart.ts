/**
 * Mermaid's data charts (`pie`, `xychart-beta`) as the app's own ```chart JSON, so they draw with the same
 * native renderer, colours and interaction as every other chart in the chat. Mermaid paints them from one
 * base colour, so on the app theme every slice came out the same grey. Anything this cannot read
 * returns null and stays a mermaid diagram.
 */
import { mermaidKind } from './mermaid-source'

const QUOTED = /^"([^"]*)"|^'([^']*)'/
const PIE_SLICE = /^\s*(?:"([^"]+)"|'([^']+)')\s*:\s*(-?[\d.]+)\s*$/
const LIST = /\[([^\]]*)\]/

const lines = (code: string) =>
  code
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('%%'))

const unquote = (value: string) => {
  const match = QUOTED.exec(value.trim())

  return match ? (match[1] ?? match[2] ?? '') : value.trim()
}

function pieChart(code: string): null | string {
  let title = ''
  const slices: { name: string; value: number }[] = []

  for (const line of lines(code).slice(1)) {
    const slice = PIE_SLICE.exec(line)

    if (slice) {
      slices.push({ name: slice[1] ?? slice[2], value: Number(slice[3]) })
    } else if (/^title\s/i.test(line)) {
      title = line.replace(/^title\s+/i, '')
    } else if (!/^(?:showData|accTitle|accDescr)/i.test(line)) {
      return null
    }
  }

  const headTitle = /^pie\b.*?\btitle\s+(.+)$/i.exec(lines(code)[0] ?? '')

  if (slices.length === 0 || slices.some(slice => !Number.isFinite(slice.value) || slice.value < 0)) {
    return null
  }

  return JSON.stringify({ slices, title: title || headTitle?.[1] || '', type: 'pie' })
}

const numbers = (list: string) => list.split(',').map(value => Number(value.trim()))

function xyChart(code: string): null | string {
  const [head, ...body] = lines(code)
  let title = ''
  let yTitle = ''
  let categories: string[] = []
  const series: { data: number[]; kind: 'bar' | 'line' }[] = []

  for (const line of body) {
    const keyword = line.split(/\s+/)[0].toLowerCase()
    const list = LIST.exec(line)?.[1]

    if (keyword === 'title') {
      title = unquote(line.slice(5))
    } else if (keyword === 'x-axis') {
      if (!list) {
        return null
      }

      categories = list.split(',').map(unquote)
    } else if (keyword === 'y-axis') {
      yTitle = QUOTED.test(line.slice(6).trim()) ? unquote(line.slice(6)) : ''
    } else if ((keyword === 'bar' || keyword === 'line') && list) {
      series.push({ data: numbers(list), kind: keyword })
    } else {
      return null
    }
  }

  const valid =
    series.length > 0 &&
    categories.length > 0 &&
    series.every(entry => entry.data.length === categories.length && entry.data.every(Number.isFinite))

  if (!valid) {
    return null
  }

  const bars = series.some(entry => entry.kind === 'bar')

  const name = (index: number) =>
    series.length === 1 ? yTitle || title || 'Value' : `${yTitle || 'Series'} ${index + 1}`

  return JSON.stringify({
    categories,
    horizontal: /\bhorizontal\b/i.test(head),
    series: series.map((entry, index) => ({ data: entry.data, name: name(index) })),
    title,
    type: bars ? 'bar' : 'line'
  })
}

export function mermaidAsChart(code: string): null | string {
  const kind = mermaidKind(code)

  if (kind === 'pie') {
    return pieChart(code)
  }

  return kind === 'xychart-beta' || kind === 'xychart' ? xyChart(code) : null
}
