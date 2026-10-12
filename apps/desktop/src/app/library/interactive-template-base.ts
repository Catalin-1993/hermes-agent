/** The scaffold every starting template shares: a tidy page in the app's own colours (`--hermes-*`). */

export type InteractiveTemplateId =
  | 'budget'
  | 'chart'
  | 'currency'
  | 'decision'
  | 'flashcards'
  | 'focus'
  | 'invoice'
  | 'kanban'
  | 'kpi'
  | 'quiz'
  | 'roi'
  | 'timeline'

export interface InteractiveTemplate {
  /** The tile's glyph (codicon). */
  icon: string
  id: InteractiveTemplateId
  html: string
  /** The document's own title, which names its file. */
  title: string
}

export const BASE = `*{box-sizing:border-box}body{margin:0;padding:20px 22px 24px;line-height:1.5}
h2{margin:0 0 2px;font-size:1.125rem;font-weight:650;letter-spacing:-.01em}
.sub{margin:0 0 16px;color:var(--hermes-muted);font-size:.875rem}
.muted{color:var(--hermes-muted)}
label{display:block;margin:12px 0 4px;color:var(--hermes-muted);font-size:.8125rem}
input,select,button,textarea{font:inherit;color:inherit}
input,select{width:100%;padding:8px 10px;border:1px solid var(--hermes-border);border-radius:8px;background:transparent}
button{padding:7px 12px;border:1px solid var(--hermes-border);border-radius:8px;background:transparent;cursor:pointer}
button:hover{border-color:var(--hermes-accent)}
button.primary{border-color:transparent;background:var(--hermes-accent);color:#fff}
:is(input,select,button):focus-visible{outline:2px solid var(--hermes-accent);outline-offset:1px}
.card{padding:14px 16px;border:1px solid var(--hermes-border);border-radius:12px}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.big{font-size:2.25rem;font-weight:700;letter-spacing:-.02em;color:var(--hermes-accent);line-height:1.1}`

export const doc = (title: string, css: string, body: string, script: string, head = '') =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}<title>${title}</title>
<style>
${BASE}
${css}
</style>
</head>
<body>
${body}
<script>
${script}
</script>
</body>
</html>
`
