export type Delimiter = ',' | ';' | '\t' | '|'

export interface Delimited {
  delimiter: Delimiter
  rows: string[][]
}

const CANDIDATES: readonly Delimiter[] = [',', ';', '\t', '|']

/** The separator a file uses: the one that splits its first lines into the most, and the same number of,
 *  fields. A tab file named .tsv is a tab file whatever it looks like. */
export function sniffDelimiter(text: string, hint?: Delimiter): Delimiter {
  if (hint) {
    return hint
  }

  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 20)
  let best: Delimiter = ','
  let bestScore = 0

  for (const delimiter of CANDIDATES) {
    const counts = lines.map(line => line.split(delimiter).length - 1)
    const steady = counts.length > 0 && counts.every(count => count === counts[0])
    const score = (counts[0] ?? 0) * (steady ? 2 : 1)

    if (score > bestScore) {
      best = delimiter
      bestScore = score
    }
  }

  return best
}

/** RFC 4180 reading: quoted fields may hold the separator, quotes ("") and line breaks. */
export function parseDelimited(text: string, hint?: Delimiter): Delimited {
  const delimiter = sniffDelimiter(text, hint)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]

    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"' && field === '') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') {
        i += 1
      }

      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return { delimiter, rows }
}

const needsQuotes = (value: string, delimiter: Delimiter) =>
  value.includes(delimiter) ||
  value.includes('"') ||
  value.includes('\n') ||
  value.includes('\r') ||
  /^\s|\s$/.test(value)

/** Back to text the way it came: the same separator, quotes only where a field needs them. */
export function serializeDelimited({ delimiter, rows }: Delimited): string {
  return (
    rows
      .map(row =>
        row.map(value => (needsQuotes(value, delimiter) ? `"${value.replace(/"/g, '""')}"` : value)).join(delimiter)
      )
      .join('\n') + '\n'
  )
}
