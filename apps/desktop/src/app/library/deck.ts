/** A presentation is a Library page whose text starts with a marker and holds its slides between `---`
 *  lines. It stays ordinary Markdown: Hermes writes and edits it with the Library tool (consent, versions
 *  and Undo included), and it reads fine as text anywhere else. */

export const DECK_THEMES = ['paper', 'ink', 'sand', 'ocean'] as const

export type DeckTheme = (typeof DECK_THEMES)[number]

export interface Deck {
  slides: string[]
  theme: DeckTheme
}

const MARKER = /^\s*<!--\s*hermes:deck\b([^>]*)-->[ \t]*(?:\r?\n|$)/
const THEME = /\btheme=(\w+)/
const RULE = /^\s*---\s*$/
const FENCE = /^\s*(```|~~~)/

export const isDeck = (markdown: null | string | undefined): boolean => MARKER.test(markdown ?? '')

const themeOf = (attributes: string): DeckTheme => {
  const named = THEME.exec(attributes)?.[1]

  return DECK_THEMES.find(theme => theme === named) ?? 'paper'
}

/** Slides split on `---` lines that are not inside a code fence; an empty deck is one empty slide. */
export function parseDeck(markdown: string): Deck {
  const marker = MARKER.exec(markdown)
  const body = marker ? markdown.slice(marker[0].length) : markdown
  const slides: string[] = []
  let current: string[] = []
  let fenced = false

  for (const line of body.split(/\r?\n/)) {
    if (FENCE.test(line)) {
      fenced = !fenced
    }

    if (!fenced && RULE.test(line)) {
      slides.push(current.join('\n').trim())
      current = []
    } else {
      current.push(line)
    }
  }

  slides.push(current.join('\n').trim())

  return {
    slides: slides.length > 1 && slides.at(-1) === '' ? slides.slice(0, -1) : slides,
    theme: themeOf(marker?.[1] ?? '')
  }
}

export function serializeDeck({ slides, theme }: Deck): string {
  return `<!-- hermes:deck theme=${theme} -->\n\n${slides.map(slide => slide.trim()).join('\n\n---\n\n')}\n`
}

/** A deck to start from: a title slide and two to fill in. */
export const starterDeck = (title: string, slideLabels: { agenda: string; body: string; subtitle: string }): string =>
  serializeDeck({
    slides: [
      `# ${title}\n\n${slideLabels.subtitle}`,
      `## ${slideLabels.agenda}\n\n- ${slideLabels.body}\n- ${slideLabels.body}\n- ${slideLabels.body}`,
      `## ${slideLabels.body}\n\n> ${slideLabels.body}`
    ],
    theme: 'paper'
  })

export type SlideLayout = 'content' | 'title'

/** A slide that is one big heading, with at most a line or two beneath, is a title slide. */
export function slideLayout(slide: string): SlideLayout {
  const lines = slide.split('\n').filter(line => line.trim())

  return lines.length > 0 &&
    lines.length <= 3 &&
    lines[0].startsWith('# ') &&
    lines.slice(1).every(line => !/^\s*([-*>]|\d+\.|#)/.test(line))
    ? 'title'
    : 'content'
}

export function replaceSlide(deck: Deck, index: number, text: string): Deck {
  return { ...deck, slides: deck.slides.map((slide, i) => (i === index ? text : slide)) }
}

export function insertSlide(deck: Deck, at: number, text = ''): Deck {
  const slides = [...deck.slides]

  slides.splice(at, 0, text)

  return { ...deck, slides }
}

export function removeSlide(deck: Deck, index: number): Deck {
  return deck.slides.length <= 1
    ? { ...deck, slides: [''] }
    : { ...deck, slides: deck.slides.filter((_, i) => i !== index) }
}

export function moveSlide(deck: Deck, from: number, to: number): Deck {
  const slides = [...deck.slides]
  const [moved] = slides.splice(from, 1)

  slides.splice(to, 0, moved)

  return { ...deck, slides }
}

/** A slide with lines `start`..`end` (inclusive) replaced by `lines` (none: removed) — what editing text on
 *  the canvas writes back. */
export function replaceLines(slide: string, start: number, end: number, lines: readonly string[]): string {
  const all = slide.split('\n')

  all.splice(start, end - start + 1, ...lines)

  return all.join('\n')
}

/** The slides (by index in `after`) that differ from `before`: what Hermes just changed, for the editor to show. */
export function changedSlides(before: string, after: string): number[] {
  const was = parseDeck(before)
  const now = parseDeck(after)
  const changed: number[] = []

  now.slides.forEach((slide, index) => {
    if (slide !== was.slides[index]) {
      changed.push(index)
    }
  })

  return changed
}
