/**
 * Mermaid source as the chat draws it. The app themes every diagram (mermaid-embed.tsx), so a model's own
 * colours — `style`, `classDef`, `class` and `linkStyle` lines — are left out: they came back as pastel boxes
 * that ignored dark mode. A node opened with one bracket and closed with another (`B{lead]`), the slip weaker
 * models make most, is closed with the bracket it opened with, so the diagram draws instead of failing to parse.
 */
const STYLING_LINE = /^\s*(?:style|classDef|class|linkStyle)\s+\S/
const CLOSERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const MISMATCHED_NODE = /(\b[A-Za-z][\w-]*)([[({])([^\][(){}\n|]*)([\])}])/g

export function chatMermaidSource(code: string): string {
  return code
    .split('\n')
    .filter(line => !STYLING_LINE.test(line))
    .map(line =>
      line.replace(MISMATCHED_NODE, (match, id: string, open: string, label: string, close: string) =>
        CLOSERS[open] === close ? match : `${id}${open}${label}${CLOSERS[open]}`
      )
    )
    .join('\n')
}
