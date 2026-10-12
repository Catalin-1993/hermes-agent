import { sealedHtml } from '@/lib/frame-policy'

import { sandboxedHtml } from './previews/data-viewers'

/** Largest document the block takes: it travels to its frame as a `data:` URL, and Chromium refuses
 *  navigations past a couple of megabytes. */
export const INTERACTIVE_MAX_CHARS = 1_500_000

/** The frame's height while the content decides it, and the bounds it keeps. */
export const INTERACTIVE_DEFAULT_HEIGHT = 320
export const INTERACTIVE_MIN_HEIGHT = 120
export const INTERACTIVE_MAX_HEIGHT = 1200

/** What the frame sends up: how tall its content is, and the data it wants kept. */
const HEIGHT_MESSAGE = 'hermes-interactive-height'
const STATE_MESSAGE = 'hermes-interactive-state'
/** What the page sends down: the app's colours, now and whenever the theme changes. */
export const THEME_MESSAGE = 'hermes-interactive-theme'

/** The most data one block keeps (JSON text) — it rides in the page's own document. */
export const STATE_MAX_CHARS = 65_536

/** The app's colours as the block sees them: the theme's own, resolved to plain values. */
export interface BlockPalette {
  accent: string
  bg: string
  border: string
  fg: string
  muted: string
  scheme: 'dark' | 'light'
}

const LIGHT_PALETTE: BlockPalette = {
  accent: '#2563eb',
  bg: '#ffffff',
  border: '#d4d4d8',
  fg: '#1d1d1f',
  muted: '#6b7280',
  scheme: 'light'
}

/** What a block with nothing of its own looks like: the app's page colours in the system face. The
 *  author's CSS comes after this and wins; `--hermes-*` follow the theme for those who want them. */
const BASE_STYLE =
  '<style>html{background:var(--hermes-bg,#fff);color:var(--hermes-fg,#1d1d1f);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}</style>'

/** JSON that is safe to sit inside a `<script>`: it cannot close it, nor break a line. */
const scriptJson = (value: unknown) =>
  JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

/** `window.hermes` inside the frame — what a block may ask of its page, and all it can:
 *  `state` (what it saved last, or null) and `save(value)` (JSON, kept with the page, up to 64 KB),
 *  `theme` (the app's colours, mirrored as `--hermes-bg|fg|muted|border|accent` and `color-scheme`)
 *  and `onTheme(fn)` (told when they change). The theme is also mirrored under the names a chat widget
 *  is written against (`--foreground`, `--muted-foreground`, `--accent`, `--border`, `--card`), and
 *  `send` is there but answers undelivered — a block has no conversation to speak into — so a widget
 *  saved to the Library runs as it did in the chat. */
const runtime = (state: unknown, palette: BlockPalette) =>
  `<script>(function(){var h=window.hermes={state:${scriptJson(state)},theme:${scriptJson(palette)},save:function(v){var s;try{s=JSON.stringify(v)}catch(e){return false}if(s===undefined||s.length>${STATE_MAX_CHARS}){console.warn('hermes.save: the value must be JSON of at most ${STATE_MAX_CHARS} characters');return false}h.state=v;parent.postMessage({type:'${STATE_MESSAGE}',state:s},'*');return true},onTheme:function(f){fs.push(f)},send:function(){return Promise.resolve({ok:false,error:'undelivered'})}},fs=[],al={fg:'foreground',muted:'muted-foreground',accent:'accent',border:'border',bg:'card'};function apply(t){var r=document.documentElement;r.dataset.theme=t.scheme;r.style.colorScheme=t.scheme;for(var k in t)if(k!=='scheme'){r.style.setProperty('--hermes-'+k,t[k]);if(al[k])r.style.setProperty('--'+al[k],t[k])}}addEventListener('message',function(e){var d=e.data;if(e.source===parent&&d&&d.type==='${THEME_MESSAGE}'&&d.theme){h.theme=d.theme;apply(d.theme);fs.forEach(function(f){f(d.theme)})}});apply(h.theme)})()</script>`

/** Reports the document's height to the page so the block fits its content. A document that sizes
 *  itself to the frame (`height:100%`) reports the frame's own height, so it settles instead of growing. */
const HEIGHT_REPORTER = `<script>(function(){var last=0;function send(){var h=Math.ceil(document.documentElement.getBoundingClientRect().height);if(h&&h!==last){last=h;parent.postMessage({type:'${HEIGHT_MESSAGE}',height:h},'*')}}new ResizeObserver(send).observe(document.documentElement);addEventListener('load',send);send()})()</script>`

/** The `src` for a block's frame: the author's HTML, sealed (no network, no app, no storage) and
 *  wired to report its height. */
interface BlockOptions {
  /** Public https hosts the owner approved this block to reach (see `activeHosts`). */
  hosts?: readonly string[]
  palette?: BlockPalette
  state?: unknown
}

/** The author's document as a block runs it, before the policy goes on: `hermes`, the theme and the
 *  height report in front of its own scripts. */
function withRuntime(html: string, { palette = LIGHT_PALETTE, state = null }: BlockOptions) {
  const injected = `${BASE_STYLE}${runtime(state, palette)}${HEIGHT_REPORTER}`

  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, match => `${match}${injected}`) : `${injected}${html}`
}

const policy = ({ hosts }: BlockOptions) => ({ hosts, libraries: true })

export const interactiveSrc = (html: string, options: BlockOptions = {}): string =>
  sandboxedHtml(withRuntime(html, options), policy(options))

/** The same sealed document as plain HTML — for an exported page, where it sits in an `srcdoc`. */
export const interactiveDocument = (html: string, options: BlockOptions = {}): string =>
  sealedHtml(withRuntime(html, options), policy(options))

/** The data a frame asked to keep, as JSON text — or null when it is not ours, not JSON, or too big. */
export function reportedState(data: unknown): null | string {
  const message = data as { state?: unknown; type?: unknown } | null

  if (message?.type !== STATE_MESSAGE || typeof message.state !== 'string' || message.state.length > STATE_MAX_CHARS) {
    return null
  }

  try {
    JSON.parse(message.state)
  } catch {
    return null
  }

  return message.state
}

/** The saved data as the block holds it (JSON text), back to a value for the frame. */
export function parseState(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

/** The theme's colours, resolved: a token can be a `color-mix(...)` of other variables, which the
 *  frame cannot see — so each is read back as the colour it paints. */
export function readPalette(scheme: 'dark' | 'light'): BlockPalette {
  const probe = document.createElement('span')

  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;transition:none'
  document.body.append(probe)

  const paint = (token: string, fallback: string) => {
    probe.style.color = `var(${token})`

    return getComputedStyle(probe).color || fallback
  }

  const palette: BlockPalette = {
    accent: paint('--ui-accent', LIGHT_PALETTE.accent),
    bg: paint('--ui-bg-editor', LIGHT_PALETTE.bg),
    border: paint('--ui-stroke-secondary', LIGHT_PALETTE.border),
    fg: paint('--ui-text-primary', LIGHT_PALETTE.fg),
    muted: paint('--ui-text-secondary', LIGHT_PALETTE.muted),
    scheme
  }

  probe.remove()

  return palette
}

/** The height a frame message reports, or null when it is not ours (or not a sane number). */
export function reportedHeight(data: unknown): null | number {
  const message = data as { height?: unknown; type?: unknown } | null

  if (message?.type !== HEIGHT_MESSAGE || typeof message.height !== 'number' || !Number.isFinite(message.height)) {
    return null
  }

  return clampHeight(message.height)
}

export const clampHeight = (height: number) =>
  Math.min(INTERACTIVE_MAX_HEIGHT, Math.max(INTERACTIVE_MIN_HEIGHT, Math.round(height)))

const ENTITIES: Record<string, string> = { '&amp;': '&', '&gt;': '>', '&lt;': '<', '&nbsp;': ' ', '&quot;': '"' }

/** The document's own `<title>`, when it has one. */
export function htmlTitle(html: string): string {
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ''

  return raw
    .replace(/&(?:amp|gt|lt|nbsp|quot);/g, entity => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()
}

/** A file name for the block's document: its title, else the block's name — never a path. */
export function htmlFileName(html: string, fallback: string): string {
  const printable = [...(htmlTitle(html) || fallback)].filter(char => char.charCodeAt(0) >= 32).join('')

  const base =
    printable
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || fallback

  return `${base}.html`
}
