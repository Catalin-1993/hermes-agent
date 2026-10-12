export interface DiffLine {
  kind: 'added' | 'removed' | 'same'
  text: string
}

// Past this many line pairs the table would cost more than the answer is worth: show it as rewritten.
const MAX_CELLS = 4_000_000

/** What changed between two versions of a page, line by line (longest common subsequence), with blank
 *  lines dropped — a page's paragraphs are its lines. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n').filter(line => line.trim())
  const b = after.split('\n').filter(line => line.trim())

  if (a.length * b.length > MAX_CELLS) {
    return [
      ...a.map(text => ({ kind: 'removed' as const, text })),
      ...b.map(text => ({ kind: 'added' as const, text }))
    ]
  }

  // lcs[i][j]: the longest common run of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1))

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0

  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] })
      i += 1
      j += 1
    } else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
      // What went comes before what replaced it.
      out.push({ kind: 'removed', text: a[i] })
      i += 1
    } else {
      out.push({ kind: 'added', text: b[j] })
      j += 1
    }
  }

  return out
}
