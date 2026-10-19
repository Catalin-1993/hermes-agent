/**
 * Two slips models make with the fences the chat draws (` ```card `, ` ```chart `, ` ```mermaid `…), repaired
 * before the markdown is read. Left alone, both show the block as plain text with its JSON spilled into it.
 *
 * - The opener glued to the end of a sentence: `…în calendarul tău:```card` — a fence only opens at the start
 *   of a line, so the opener is moved onto its own line.
 * - The whole block on one line: ```` ```card {"type": "event", …} ``` ````.
 */
const DRAWN = 'card|chart|mermaid|widget|svg|listing'
const GLUED_OPENER = new RegExp(`^([^\\n\`]*\\S)[ \\t]*(\`{3,})(${DRAWN})[ \\t]*$`, 'gim')
const ONE_LINE_BLOCK = new RegExp(`(\`{3,})(${DRAWN})[ \\t]+([[{][^\\n]*[\\]}])[ \\t]*\\1`, 'gi')

export function repairDrawnFences(text: string): string {
  if (!text.includes('```')) {
    return text
  }

  return text
    .replace(
      ONE_LINE_BLOCK,
      (_match, ticks: string, language: string, body: string) => `\n\n${ticks}${language}\n${body}\n${ticks}\n\n`
    )
    .replace(
      GLUED_OPENER,
      (_match, before: string, ticks: string, language: string) => `${before}\n\n${ticks}${language}`
    )
}

/**
 * JSON as a model writes it into a card or chart: strict first, then — only if that fails — with the slips that
 * leave the meaning plain repaired: a value broken across lines (a URL wrapped onto its own line), a trailing
 * comma, typographic quotes around keys and values. Throws like `JSON.parse` when it still cannot be read.
 */
export function parseLooseJson(source: string): unknown {
  try {
    return JSON.parse(source)
  } catch (error) {
    const repaired = source
      .replace(/[\u201c\u201d\u201e]/g, '"')
      .replace(/\s*\r?\n\s*/g, ' ')
      .replace(/,\s*([}\]])/g, '$1')

    if (repaired === source) {
      throw error
    }

    return JSON.parse(repaired)
  }
}
