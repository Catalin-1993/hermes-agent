/** Three-way merge of two edits of the same text, by lines: what the owner wrote since the page was
 *  last in sync (`mine`) and what Hermes wrote meanwhile (`theirs`), both measured from `base`.
 *  A region only one side touched takes that side's version; both touching the same region keeps the
 *  owner's — their work in progress is never overwritten — and counts a conflict so it can be said. */

const MAX_LINES = 3000

/** For every line of `a`, the index of the line of `b` it is matched with (longest common subsequence), or -1. */
function matches(a: readonly string[], b: readonly string[]): number[] {
  const rows = a.length + 1
  const cols = b.length + 1
  const table = new Uint16Array(rows * cols)

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] =
        a[i] === b[j] ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1])
    }
  }

  const out = a.map(() => -1)
  let i = 0
  let j = 0

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out[i] = j
      i += 1
      j += 1
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      i += 1
    } else {
      j += 1
    }
  }

  return out
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i])

export interface Merged {
  conflicts: number
  text: string
}

export function merge3(base: string, mine: string, theirs: string): Merged {
  if (mine === theirs || theirs === base) {
    return { conflicts: 0, text: mine }
  }

  if (mine === base) {
    return { conflicts: 0, text: theirs }
  }

  const a = base.split('\n')
  const b = mine.split('\n')
  const c = theirs.split('\n')

  if (a.length > MAX_LINES || b.length > MAX_LINES || c.length > MAX_LINES) {
    return { conflicts: 1, text: mine }
  }

  const toMine = matches(a, b)
  const toTheirs = matches(a, c)
  const out: string[] = []
  let conflicts = 0
  let prev = { a: -1, b: -1, c: -1 }

  // A base line both sides kept is an anchor; what lies between two anchors is decided as one region.
  const region = (next: { a: number; b: number; c: number }) => {
    const baseLines = a.slice(prev.a + 1, next.a)
    const mineLines = b.slice(prev.b + 1, next.b)
    const theirLines = c.slice(prev.c + 1, next.c)

    if (same(mineLines, baseLines)) {
      out.push(...theirLines)
    } else if (same(theirLines, baseLines) || same(mineLines, theirLines)) {
      out.push(...mineLines)
    } else {
      conflicts += 1
      out.push(...mineLines)
    }
  }

  for (let i = 0; i < a.length; i += 1) {
    if (toMine[i] !== -1 && toTheirs[i] !== -1) {
      const anchor = { a: i, b: toMine[i], c: toTheirs[i] }

      region(anchor)
      out.push(a[i])
      prev = anchor
    }
  }

  region({ a: a.length, b: b.length, c: c.length })

  return { conflicts, text: out.join('\n') }
}
