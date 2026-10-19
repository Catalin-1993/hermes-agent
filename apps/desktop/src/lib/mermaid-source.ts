/**
 * Mermaid source as the chat draws it. The app themes every diagram (mermaid-embed.tsx), so a model's own
 * colours — `style`, `classDef` and `linkStyle` lines, and a flowchart's `class` assignments — are left out:
 * they came back as pastel boxes that ignored dark mode. In a flowchart, a node opened with one bracket and
 * closed with another (`B{lead]`), the slip weaker models make most, is closed with the bracket it opened
 * with, so the diagram draws instead of failing to parse. Other diagram kinds keep `class` lines and
 * brackets as written: there `class Name {` declares a class and `Command[]` is a type.
 */
const STYLING_LINE = /^\s*(?:style|classDef|linkStyle)\s+\S/
const FLOWCHART_CLASS_LINE = /^\s*class\s+\S/
const FLOWCHART_HEADER = /^\s*(?:flowchart|graph)\b/
const CLOSERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const MISMATCHED_NODE = /(\b[A-Za-z][\w-]*)([[({])([^\][(){}\n|]*)([\])}])/g

/** The first line that is not blank, a comment or front matter / directive. */
function header(lines: readonly string[]): string {
  let inFrontMatter = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === '---') {
      inFrontMatter = !inFrontMatter

      continue
    }

    if (inFrontMatter || !trimmed || trimmed.startsWith('%%')) {
      continue
    }

    return trimmed
  }

  return ''
}

export function chatMermaidSource(code: string): string {
  const lines = code.split('\n')
  const flowchart = FLOWCHART_HEADER.test(header(lines))

  return lines
    .filter(line => !STYLING_LINE.test(line) && !(flowchart && FLOWCHART_CLASS_LINE.test(line)))
    .map(line =>
      flowchart
        ? line.replace(MISMATCHED_NODE, (match, id: string, open: string, label: string, close: string) =>
            CLOSERS[open] === close ? match : `${id}${open}${label}${CLOSERS[open]}`
          )
        : line
    )
    .join('\n')
}

/** The diagram kind a source declares (`pie`, `classDiagram`, `xychart-beta`…), lower-cased. */
export function mermaidKind(code: string): string {
  return header(code.split('\n')).split(/\s+/)[0]?.toLowerCase() ?? ''
}

const ERROR_LINE = /\bline (\d+)\b/i

/**
 * The source without the line mermaid's parse error names (`Parse error on line 6`), so one garbled line from a
 * model costs that line instead of the whole diagram. Null when the error names no line, or names the header.
 */
export function withoutErrorLine(source: string, message: string): null | string {
  const line = Number(ERROR_LINE.exec(message)?.[1])
  const lines = source.split('\n')

  if (!Number.isInteger(line) || line < 2 || line > lines.length) {
    return null
  }

  return [...lines.slice(0, line - 1), ...lines.slice(line)].join('\n')
}

const SIDEWAYS_FLOWCHART = /^(\s*(?:flowchart|graph))\s+(?:LR|RL)\b/m

/** A left-to-right flowchart turned top-down — for one too wide to read in the chat column. Null otherwise. */
export function topDownFlowchart(source: string): null | string {
  return SIDEWAYS_FLOWCHART.test(source) ? source.replace(SIDEWAYS_FLOWCHART, '$1 TD') : null
}
