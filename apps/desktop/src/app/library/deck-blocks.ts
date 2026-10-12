/** A slide's Markdown as blocks and styled runs — read once, drawn three ways (the canvas, the PDF page
 *  and the PowerPoint file), so they can never disagree about what a slide says. */

export type Align = 'center' | 'left' | 'right'

export interface Span {
  /** How the block is aligned, when it says so (`<!-- align=center -->` on the line above it). */
  align?: Align
  /** The line of that comment, when there is one: it travels with the block. */
  attr?: number
  /** The last source line of the block (inclusive). */
  end: number
  /** The first source line of the block. */
  line: number
}

export interface ListItem {
  depth: number
  line: number
  ordered: boolean
  /** The source line's own start (`  - `, `1. `): kept as it is when only the words change. */
  prefix: string
  text: string
}

export type Block =
  | (Span & { kind: 'code'; text: string })
  | (Span & { kind: 'heading'; level: 1 | 2 | 3; text: string })
  | (Span & { kind: 'image'; alt: string; src: string })
  | (Span & { kind: 'list'; items: ListItem[] })
  | (Span & { kind: 'paragraph'; text: string })
  | (Span & { kind: 'quote'; text: string })

const LIST_ITEM = /^(\s*)([-*+]|\d+\.)\s+(.*)$/

const ALIGN = /^\s*<!--\s*align=(left|center|right)\s*-->\s*$/

export function parseBlocks(slide: string): Block[] {
  const found: Block[] = []
  const lines = slide.split('\n')
  let pending: null | { align: Align; attr: number } = null

  // Every block takes the alignment comment that stood right above it.
  const out = {
    push(block: Block) {
      found.push(pending ? { ...block, align: pending.align, attr: pending.attr } : block)
      pending = null
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()
    const start = i

    if (!trimmed) {
      continue
    }

    const aligned = ALIGN.exec(line)

    if (aligned) {
      pending = { align: aligned[1] as Align, attr: i }

      continue
    }

    if (/^(```|~~~)/.test(trimmed)) {
      const code: string[] = []

      i += 1

      while (i < lines.length && !/^\s*(```|~~~)/.test(lines[i])) {
        code.push(lines[i])
        i += 1
      }

      out.push({ end: i, kind: 'code', line: start, text: code.join('\n') })

      continue
    }

    const heading = /^(#{1,3})(?:\s+(.*))?$/.exec(trimmed)

    if (heading) {
      out.push({ end: i, kind: 'heading', level: heading[1].length as 1 | 2 | 3, line: start, text: heading[2] ?? '' })

      continue
    }

    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed)

    if (image) {
      out.push({ alt: image[1], end: i, kind: 'image', line: start, src: image[2] })

      continue
    }

    if (trimmed.startsWith('>')) {
      const quote: string[] = [trimmed.replace(/^>\s?/, '')]

      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
        i += 1
        quote.push(lines[i].trim().replace(/^>\s?/, ''))
      }

      out.push({ end: i, kind: 'quote', line: start, text: quote.join(' ') })

      continue
    }

    if (LIST_ITEM.test(line)) {
      const items: ListItem[] = []

      while (i < lines.length && LIST_ITEM.test(lines[i])) {
        const [, indent, marker, text] = LIST_ITEM.exec(lines[i])!

        items.push({
          depth: Math.min(2, Math.floor(indent.replace(/\t/g, '  ').length / 2)),
          line: i,
          ordered: /\d/.test(marker),
          prefix: `${indent}${marker} `,
          text
        })
        i += 1
      }

      i -= 1
      out.push({ end: i, items, kind: 'list', line: start })

      continue
    }

    const paragraph = [trimmed]

    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !/^(#{1,3}\s|>|!\[|```|~~~|<!--)/.test(lines[i + 1].trim()) &&
      !LIST_ITEM.test(lines[i + 1])
    ) {
      i += 1
      paragraph.push(lines[i].trim())
    }

    out.push({ end: i, kind: 'paragraph', line: start, text: paragraph.join(' ') })
  }

  return found
}

export type RunStyle = 'bold' | 'code' | 'italic' | 'link' | 'plain'

export interface Run {
  style: RunStyle
  text: string
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)]+\))/g

/** `**bold**`, `*italic*`, `` `code` `` and `[links](…)` as runs of text; anything else is plain. */
export function inlineRuns(text: string): Run[] {
  const runs: Run[] = []

  for (const part of text.split(INLINE)) {
    if (!part) {
      continue
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      runs.push({ style: 'bold', text: part.slice(2, -2) })
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      runs.push({ style: 'code', text: part.slice(1, -1) })
    } else if (
      ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) &&
      part.length > 2
    ) {
      runs.push({ style: 'italic', text: part.slice(1, -1) })
    } else {
      const link = /^\[([^\]]+)\]\([^)]+\)$/.exec(part)

      runs.push(link ? { style: 'link', text: link[1] } : { style: 'plain', text: part })
    }
  }

  return runs
}

/** The number of an ordered item: how many ordered items at its depth came since the list (or its parent) began. */
export function orderedNumber(list: { depth: number; ordered: boolean }[], at: number): number {
  let count = 0

  for (let i = at; i >= 0 && list[i].depth >= list[at].depth; i -= 1) {
    if (list[i].depth === list[at].depth && list[i].ordered) {
      count += 1
    }
  }

  return count
}

export type NewBlock = 'bullets' | 'code' | 'heading' | 'image' | 'numbered' | 'paragraph' | 'quote'

/** A paragraph has no marker, so an empty one is held open by a character that is not whitespace and is invisible. */
export const EMPTY_PARAGRAPH = '\u200b'

const START: Record<Exclude<NewBlock, 'image'>, string[]> = {
  bullets: ['- '],
  code: ['```', '', '```'],
  heading: ['## '],
  numbered: ['1. '],
  paragraph: [EMPTY_PARAGRAPH],
  quote: ['> ']
}

export interface BlockImage {
  alt: string
  src: string
}

const startLines = (kind: NewBlock, image?: BlockImage): string[] =>
  kind === 'image' ? [`![${(image?.alt ?? '').replace(/[[\]]/g, '')}](${image?.src ?? ''})`] : START[kind]

const chunksOf = (slide: string): string[][] => {
  const lines = slide.split('\n')

  return parseBlocks(slide).map(block => lines.slice(block.attr ?? block.line, block.end + 1))
}

const joinChunks = (chunks: string[][]): string => chunks.map(chunk => chunk.join('\n')).join('\n\n')

/** The line a chunk starts on once the chunks are joined with one blank line between them. */
const lineOfChunk = (chunks: string[][], at: number): number =>
  chunks.slice(0, at).reduce((line, chunk) => line + chunk.length + 1, 0)

export interface Inserted {
  /** The first source line of the new block — where editing it begins. */
  line: number
  slide: string
}

/** A new, empty block after block `after` (-1: first on the slide). `replace` puts it in that block's place instead. */
export function insertBlock(
  slide: string,
  after: number,
  kind: NewBlock,
  image?: BlockImage,
  replace = false
): Inserted {
  const chunks = chunksOf(slide)
  const at = replace ? Math.max(0, after) : after + 1

  chunks.splice(at, replace ? 1 : 0, startLines(kind, image))

  return { line: lineOfChunk(chunks, at), slide: joinChunks(chunks) }
}

/** Block `index` one place up (-1) or down (+1); the slide is returned as it was when it cannot move. */
export function moveBlock(slide: string, index: number, direction: -1 | 1): string {
  const chunks = chunksOf(slide)
  const to = index + direction

  if (index < 0 || index >= chunks.length || to < 0 || to >= chunks.length) {
    return slide
  }

  const [moved] = chunks.splice(index, 1)

  chunks.splice(to, 0, moved)

  return joinChunks(chunks)
}

export function removeBlock(slide: string, index: number): string {
  const chunks = chunksOf(slide)

  chunks.splice(index, 1)

  return joinChunks(chunks)
}

/** The block's alignment set (or cleared: left is the default and writes nothing). */
export function setBlockAlign(slide: string, index: number, align: Align): string {
  const block = parseBlocks(slide)[index]

  if (!block) {
    return slide
  }

  const lines = slide.split('\n')
  const comment = align === 'left' ? [] : [`<!-- align=${align} -->`]

  lines.splice(block.attr ?? block.line, block.attr === undefined ? 0 : 1, ...comment)

  return lines.join('\n')
}

/** What a block is, for the "paragraph style" choice. */
export type BlockStyle = 'bullets' | 'h1' | 'h2' | 'h3' | 'numbered' | 'paragraph' | 'quote'

export function blockStyleOf(block: Block | undefined): BlockStyle | null {
  if (!block) {
    return null
  }

  switch (block.kind) {
    case 'heading':
      return `h${block.level}` as BlockStyle

    case 'paragraph':
      return 'paragraph'

    case 'quote':
      return 'quote'

    case 'list':
      return block.items[0]?.ordered ? 'numbered' : 'bullets'

    default:
      return null
  }
}

const PREFIX: Record<Exclude<BlockStyle, 'bullets' | 'numbered'>, string> = {
  h1: '# ',
  h2: '## ',
  h3: '### ',
  paragraph: '',
  quote: '> '
}

/** The block turned into another kind of text block, keeping its words and its alignment. A list becomes one
 *  block per item when it turns into plain text; code and pictures are left as they are. */
export function setBlockStyle(slide: string, index: number, style: BlockStyle): string {
  const block = parseBlocks(slide)[index]
  const current = blockStyleOf(block)

  if (!block || !current || current === style) {
    return slide
  }

  const items: string[] =
    block.kind === 'list'
      ? block.items.map(item => item.text)
      : [block.kind === 'code' || block.kind === 'image' ? '' : block.text]

  const depth = block.kind === 'list' ? block.items.map(item => item.depth) : [0]
  const comment = block.attr === undefined ? [] : [slide.split('\n')[block.attr]]
  let made: string[][]

  if (style === 'bullets' || style === 'numbered') {
    made = [items.map((text, i) => `${'  '.repeat(depth[i] ?? 0)}${style === 'bullets' ? '-' : `${i + 1}.`} ${text}`)]
  } else {
    made = items.map(text => [`${PREFIX[style]}${text}`])
  }

  // The alignment comment goes with the first of the new blocks.
  made[0] = [...comment, ...made[0]]

  const chunks = slide.split('\n')
  const all = parseBlocks(slide).map(b => chunks.slice(b.attr ?? b.line, b.end + 1))

  all.splice(index, 1, ...made)

  return all.map(chunk => chunk.join('\n')).join('\n\n')
}
