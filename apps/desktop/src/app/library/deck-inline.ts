/** The words of a slide with their look. A slide stays Markdown — `**bold**`, `*italic*`, `` `code` ``,
 *  `[links](…)` — and carries what Markdown has no word for as the two bits of HTML every Markdown reader
 *  already ignores gracefully: `<u>underline</u>` and `<span style="font-family:Georgia;font-size:32pt;color:#c2410c">…</span>`
 *  (size in points of a 960-point-wide slide, the unit PowerPoint uses). Read and written here, once, so the
 *  canvas, the editor and the PowerPoint / Word / PDF exports can never disagree about what a word looks like. */

export interface Span {
  bold?: boolean
  code?: boolean
  /** `#rrggbb`. */
  color?: string
  /** A font family name; absent: the deck's own. */
  font?: string
  italic?: boolean
  /** The link's address. */
  link?: string
  /** Points on a 960-point-wide slide. */
  size?: number
  strike?: boolean
  text: string
  underline?: boolean
}

type Look = Omit<Span, 'text'>

const LOOK_KEYS: (keyof Look)[] = ['bold', 'code', 'color', 'font', 'italic', 'link', 'size', 'strike', 'underline']

const sameLook = (a: Look, b: Look) => LOOK_KEYS.every(key => a[key] === b[key])

const look = (span: Span): Look => {
  const { text: _text, ...rest } = span

  return rest
}

/** Neighbouring spans that look alike become one, and empty ones go. */
export function mergeSpans(spans: readonly Span[]): Span[] {
  const out: Span[] = []

  for (const span of spans) {
    if (!span.text) {
      continue
    }

    const last = out.at(-1)

    if (last && sameLook(look(last), look(span))) {
      last.text += span.text
    } else {
      out.push({ ...span })
    }
  }

  return out
}

const cssOf = (style: string): Pick<Look, 'color' | 'font' | 'size'> => {
  const out: Pick<Look, 'color' | 'font' | 'size'> = {}

  for (const part of style.split(';')) {
    const colon = part.indexOf(':')

    if (colon < 0) {
      continue
    }

    const key = part.slice(0, colon).trim().toLowerCase()
    const value = part.slice(colon + 1).trim()

    if (key === 'font-family') {
      out.font = value
        .replace(/^['"]|['"]$/g, '')
        .split(',')[0]
        .trim()
        .replace(/^['"]|['"]$/g, '')
    } else if (key === 'font-size') {
      const size = /^([\d.]+)\s*pt$/i.exec(value)

      if (size) {
        out.size = Number(size[1])
      }
    } else if (key === 'color' && /^#[0-9a-f]{6}$/i.test(value)) {
      out.color = value.toLowerCase()
    }
  }

  return out
}

interface Pattern {
  apply: (match: RegExpExecArray, base: Look) => { inner: null | string; look: Look; text?: string }
  re: RegExp
}

// Earliest match wins; at the same place the earlier (more specific) pattern does.
const PATTERNS: Pattern[] = [
  { apply: (m, base) => ({ inner: m[1], look: { ...base, bold: true, italic: true } }), re: /\*\*\*(.+?)\*\*\*/s },
  { apply: (m, base) => ({ inner: m[1], look: { ...base, bold: true } }), re: /\*\*(.+?)\*\*/s },
  { apply: (m, base) => ({ inner: m[1], look: { ...base, strike: true } }), re: /~~(.+?)~~/s },
  { apply: (m, base) => ({ inner: m[1], look: { ...base, underline: true } }), re: /<u>(.*?)<\/u>/s },
  {
    apply: (m, base) => ({ inner: m[2], look: { ...base, ...cssOf(m[1]) } }),
    re: /<span\s+style="([^"]*)">(.*?)<\/span>/s
  },
  {
    apply: (m, base) => ({ inner: m[1], look: { ...base, italic: true } }),
    re: /(?<![*\w])\*(?!\*)([^*\n]+?)\*(?!\*)/
  },
  { apply: (m, base) => ({ inner: m[1], look: { ...base, italic: true } }), re: /(?<![\w_])_([^_\n]+)_(?![\w_])/ },
  { apply: (m, base) => ({ inner: null, look: { ...base, code: true }, text: m[1] }), re: /`([^`\n]+)`/ },
  { apply: (m, base) => ({ inner: m[1], look: { ...base, link: m[2] } }), re: /\[([^\]\n]+)\]\(([^)\s]+)\)/ }
]

function parseInto(source: string, base: Look, out: Span[]) {
  let rest = source

  while (rest) {
    let best: null | { at: number; match: RegExpExecArray; pattern: Pattern } = null

    for (const pattern of PATTERNS) {
      const match = pattern.re.exec(rest)

      if (match && (!best || match.index < best.at)) {
        best = { at: match.index, match, pattern }
      }
    }

    if (!best) {
      out.push({ ...base, text: rest })

      return
    }

    if (best.at > 0) {
      out.push({ ...base, text: rest.slice(0, best.at) })
    }

    const made = best.pattern.apply(best.match, base)

    if (made.inner === null) {
      out.push({ ...made.look, text: made.text ?? '' })
    } else {
      parseInto(made.inner, made.look, out)
    }

    rest = rest.slice(best.at + best.match[0].length)
  }
}

export function parseInline(source: string): Span[] {
  const out: Span[] = []

  parseInto(source, {}, out)

  return mergeSpans(out)
}

const styleOf = ({ color, font, size }: Look): string =>
  [font && `font-family:${font}`, size && `font-size:${size}pt`, color && `color:${color}`].filter(Boolean).join(';')

/** The spans back as Markdown, the way `parseInline` reads them. */
export function serializeInline(spans: readonly Span[]): string {
  return mergeSpans(spans)
    .map(span => {
      if (span.code) {
        return `\`${span.text}\``
      }

      let out = span.text

      if (span.link) {
        out = `[${out}](${span.link})`
      }

      if (span.italic) {
        out = `*${out}*`
      }

      if (span.bold) {
        out = `**${out}**`
      }

      if (span.strike) {
        out = `~~${out}~~`
      }

      if (span.underline) {
        out = `<u>${out}</u>`
      }

      const style = styleOf(span)

      return style ? `<span style="${style}">${out}</span>` : out
    })
    .join('')
}

export const plainText = (spans: readonly Span[]) => spans.map(span => span.text).join('')

/** `**a**` → `a`: a block's words with no marks at all. */
export const stripInline = (source: string) => plainText(parseInline(source))
