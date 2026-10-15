/**
 * The document an inline widget runs as, and what it may say back — shared by the `::preview{file}`
 * directive (a workspace HTML file) and the ```widget fence (HTML written in the reply itself).
 *
 * A sandboxed iframe with an opaque origin (`sandbox="allow-scripts"`, deliberately no
 * `allow-same-origin`): scripts run and the widget is fully interactive, but the document cannot reach
 * the app, its cookies, storage, or the bridge. The doc arrives via `srcdoc`, so single-file HTML is
 * fully live; relative sibling assets don't resolve in an opaque origin.
 *
 * SIZE IS CONTENT-DRIVEN. The opaque origin means the parent can't measure the document, but we own
 * the srcdoc string — an injected script posts the content's size up via postMessage (tagged with a
 * per-mount token). Height tracks live within the clamp band; width adopts ONCE from the first report
 * of the finished document, so a fixed-size widget shrink-wraps and sits left in the message flow like
 * an image, while a fluid page measures the full viewport and stays column-wide.
 *
 * NATIVE BY DEFAULT. A theme prelude injects first: the app's resolved theme tokens under friendly
 * names (--foreground, --muted-foreground, --accent, --border, --card), the app's color scheme, the app
 * font, zero body margin/padding, and a transparent background — so widget-shaped content reads as part
 * of the app. The page's own styles override all of it, so a full page keeps its own design.
 *
 * WIDGETS TALK BACK OFF-SCREEN. `window.hermes.send(prompt)` (or declarative `data-hermes-send` on any
 * clickable element) routes the prompt through the composer's send path as a user turn typed
 * `display_kind=hidden`: the agent wakes and the durable row exists (context, resume, audit via the
 * DB), but no bubble renders — the widget updating is the visible response. Token-gated, length-capped,
 * throttled to human speed. Nothing is lost silently: `send()` resolves a delivery ack, and an
 * over-length, throttled, or undeliverable intent resolves `{ ok: false, error }` instead of being
 * truncated or dropped behind the widget's back (#118973).
 *
 * WHILE IT IS BEING WRITTEN a widget shows only its markup and styles, poured into an already-loaded
 * frame (`partialShell` + `partialHtml`): scripts wait for the finished document, so a half-written
 * program never runs.
 */

export const MIN_HEIGHT = 120
export const MAX_HEIGHT = 1200
export const DEFAULT_HEIGHT = 280
/** How wide a figure may grow on a wide window (56rem), and the margin it keeps from the pane edges. */
export const FIGURE_MAX_WIDTH = 896
export const FIGURE_PANE_GUTTER = 24
/** Ignore sub-pixel/rounding churn so a vh-sized page can't oscillate. */
export const RESIZE_TOLERANCE = 4

const SIZE_MESSAGE_TYPE = 'hermes-inline-preview-size'
const INTENT_MESSAGE_TYPE = 'hermes-inline-preview-intent'
const INTENT_ACK_MESSAGE_TYPE = 'hermes-inline-preview-intent-ack'

/** Prompt length cap for a widget intent — a sentence, not a payload dump.
 *  Over-length intents are REJECTED back to the widget, never truncated: a
 *  sliced JSON payload reaches the agent as garbage while the widget thinks
 *  it sent. */
export const MAX_INTENT_LENGTH = 500
/** One intent per frame per second; clicks are human-speed. A faster intent
 *  is rejected with `retryAfterMs`, not dropped silently. */
export const INTENT_THROTTLE_MS = 1000
/** How long `hermes.send()` waits for the parent's ack before resolving
 *  `timeout` (the parent acks synchronously; this only fires if it's gone). */
const INTENT_ACK_TIMEOUT_MS = 5000

export type IntentError = 'invalid' | 'too_long' | 'throttled' | 'undelivered'

/** What `hermes.send()` resolves to inside the frame. `ok` means the prompt
 *  was handed to the owning composer's send path — not that the agent has
 *  answered. */
export type IntentAck = { ok: true } | { error: IntentError; maxLength?: number; ok: false; retryAfterMs?: number }

/** The script that gives the widget its ONE voice: `hermes.send(prompt)`.
 *  Posts the prompt up tagged with the mount token and a per-call id; the
 *  parent validates, throttles, routes it through the composer, and posts an
 *  ack back, so `send()` returns a Promise of an `IntentAck` — a widget can
 *  show "saved" only when it was. Also wires `data-hermes-send` so
 *  declarative HTML works with zero script:
 *  `<button data-hermes-send="get-price eth">ETH</button>`. */
export function intentScript(token: string): string {
  return (
    '<script>(function(){var t=' +
    JSON.stringify(token) +
    ';var n=0,w={};' +
    'addEventListener("message",function(e){var d=e.data;' +
    'if(e.source!==parent||!d||d.type!==' +
    JSON.stringify(INTENT_ACK_MESSAGE_TYPE) +
    '||d.token!==t||!w[d.id])return;' +
    'var r=w[d.id];delete w[d.id];r(d.ack)});' +
    'function send(p){if(typeof p!=="string"||!p.trim())return Promise.resolve({ok:false,error:"invalid"});' +
    'var id=++n;return new Promise(function(res){' +
    'var done=function(a){clearTimeout(k);res(a)};' +
    'var k=setTimeout(function(){if(w[id]){delete w[id];res({ok:false,error:"undelivered"})}},' +
    String(INTENT_ACK_TIMEOUT_MS) +
    ');w[id]=done;' +
    'parent.postMessage({type:' +
    JSON.stringify(INTENT_MESSAGE_TYPE) +
    ',token:t,id:id,prompt:p},"*")})}' +
    'window.hermes={send:send,maxLength:' +
    String(MAX_INTENT_LENGTH) +
    '};' +
    'addEventListener("click",function(e){var el=e.target&&e.target.closest?' +
    'e.target.closest("[data-hermes-send]"):null;' +
    'if(el)send(el.getAttribute("data-hermes-send")||"")},true)})()</script>'
  )
}

export type IntentDecision =
  | { id: number | null; kind: 'accept'; prompt: string }
  | { ack: Extract<IntentAck, { ok: false }>; id: number | null; kind: 'reject' }

/** The pure intent gate. Null unless it is OUR type with OUR token — same
 *  trust boundary as size reports, because an accepted intent turns into a
 *  user message; anything else is ignored without a reply. For our own
 *  messages every outcome is explicit: accept (trimmed, never truncated) or
 *  reject with a reason the frame gets back. `lastAcceptedAt` is the time
 *  of this frame's previous accepted intent (0 for none). */
export function evaluateIntent(
  data: unknown,
  token: string,
  now: number,
  lastAcceptedAt: number
): IntentDecision | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }

  const message = data as { id?: unknown; prompt?: unknown; token?: unknown; type?: unknown }

  if (message.type !== INTENT_MESSAGE_TYPE || message.token !== token) {
    return null
  }

  const id = typeof message.id === 'number' && Number.isSafeInteger(message.id) ? message.id : null
  const prompt = typeof message.prompt === 'string' ? message.prompt.trim() : ''

  if (!prompt) {
    return { ack: { error: 'invalid', ok: false }, id, kind: 'reject' }
  }

  if (prompt.length > MAX_INTENT_LENGTH) {
    return { ack: { error: 'too_long', maxLength: MAX_INTENT_LENGTH, ok: false }, id, kind: 'reject' }
  }

  const elapsed = now - lastAcceptedAt

  if (lastAcceptedAt > 0 && elapsed < INTENT_THROTTLE_MS) {
    return { ack: { error: 'throttled', ok: false, retryAfterMs: INTENT_THROTTLE_MS - elapsed }, id, kind: 'reject' }
  }

  return { id, kind: 'accept', prompt }
}

/** The ack posted back into the frame for intent `id`. */
export function intentAckMessage(token: string, id: number, ack: IntentAck) {
  return { ack, id, token, type: INTENT_ACK_MESSAGE_TYPE }
}

/** Semantic tokens handed into the frame, resolved to concrete values from
 *  the LIVE theme. Friendly names, not internal ones — this is the contract
 *  reference HTML / skills write against (`var(--foreground)` etc.). */
const THEME_BRIDGE_TOKENS: Record<string, string> = {
  '--foreground': '--ui-text-primary',
  '--muted-foreground': '--ui-text-tertiary',
  '--accent': '--ui-accent',
  '--border': '--ui-stroke-tertiary',
  '--card': '--ui-bg-editor'
}

/** The app's resolved light/dark appearance, read from the SAME attribute
 *  `applyTheme` (themes/context.tsx) sets the token values from — not the
 *  `.dark` class via `useIsDark()`, which is React state and can still hold
 *  the previous render's value for one paint after a real theme change. A
 *  direct read here means the tokens collected below and the color-scheme
 *  the frame is built with can never disagree (#123048). Mirrors the same
 *  fallback as `lib/selection-copy-colors.ts`'s `renderedMode()`. */
function resolvedColorScheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') {
    return 'light'
  }

  const mode = document.documentElement.dataset.hermesMode

  if (mode === 'light' || mode === 'dark') {
    return mode
  }

  try {
    return document.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Resolve the bridge tokens + app font + color scheme against the current
 *  document, all from one synchronous read so they can't drift apart. */
export function collectThemeBridge(): { vars: Record<string, string>; font: string; colorScheme: 'light' | 'dark' } {
  const vars: Record<string, string> = {}

  if (typeof document !== 'undefined') {
    const root = getComputedStyle(document.documentElement)

    for (const [alias, source] of Object.entries(THEME_BRIDGE_TOKENS)) {
      const value = root.getPropertyValue(source).trim()

      if (value) {
        vars[alias] = value
      }
    }
  }

  const font = typeof document === 'undefined' ? '' : getComputedStyle(document.body).fontFamily

  return { vars, font, colorScheme: resolvedColorScheme() }
}

/**
 * The style prelude that makes an inline widget read as NATIVE: the app's
 * resolved theme tokens as CSS vars, the app's color scheme (so UA controls,
 * scrollbars, form defaults, and `prefers-color-scheme` inside the frame
 * follow the app instead of the UA light default — a transparent background
 * alone does not do this, #95814), the app font, no margin, and a
 * transparent background so the widget sits directly on the chat surface.
 * Injected FIRST, so the page's own styles override every default here — a
 * full page that wants its own look keeps it, including its own
 * `color-scheme` declaration.
 */
export function themePrelude(vars: Record<string, string>, font: string, colorScheme: 'light' | 'dark'): string {
  const tokens = Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(';')

  const fontRule = font ? `font-family:${font};` : ''

  return (
    `<style>:root{color-scheme:${colorScheme};${tokens}}` +
    `html{scrollbar-width:none}html,body{margin:0;padding:0;background:transparent;color:var(--foreground,inherit);${fontRule}}` +
    // A sub-tolerance overshoot (the frame ignores size changes of a few px) must not show a scrollbar.
    '</style>'
  )
}

/** The script injected into the srcdoc that reports content size to the
 *  parent. Runs inside the opaque origin, so postMessage is its only door —
 *  it can say "I am N pixels" and nothing else. Height and width are the
 *  union of the body children's boxes (with the body's own scrollHeight as the
 *  floor). The document itself always fills the frame, so its scrollHeight
 *  never reports less than the frame's current height: a widget shorter than
 *  the 280px starting height kept an empty band below it for good. */
export function measurementScript(token: string): string {
  return (
    '<script>(function(){var t=' +
    JSON.stringify(token) +
    ';var lastH=0,lastW=0,lastV=0;function post(){var d=document.documentElement;var b=document.body;' +
    'var h=b?b.scrollHeight:d?d.scrollHeight:0;' +
    'var w=0;if(b){var kids=b.children;var L=Infinity,R=0,B=0;for(var i=0;i<kids.length;i++){' +
    'var r=kids[i].getBoundingClientRect();if(r.width===0&&r.height===0)continue;' +
    'if(r.left<L)L=r.left;if(r.right>R)R=r.right;if(r.bottom+scrollY>B)B=r.bottom+scrollY}' +
    'if(R>L)w=R-L;h=Math.max(h,Math.ceil(B))}' +
    'w=Math.ceil(w);var v=innerWidth;' +
    'if(Math.abs(h-lastH)>1||Math.abs(w-lastW)>1||v!==lastV){lastH=h;lastW=w;lastV=v;parent.postMessage({type:' +
    JSON.stringify(SIZE_MESSAGE_TYPE) +
    ',token:t,height:h,width:w,viewport:v},"*")}}' +
    'if(typeof ResizeObserver==="function"){var ro=new ResizeObserver(post);' +
    'ro.observe(document.documentElement);if(document.body)ro.observe(document.body)}' +
    'addEventListener("load",post);post()})()</script>'
  )
}

/** Assemble the srcdoc: theme prelude first (so the page's own styles win),
 *  then the measuring + intent scripts before `</body>` when present so they
 *  run after the page's own markup, appended otherwise. */
export function withInlineChrome(doc: string, token: string, prelude: string): string {
  const script = measurementScript(token) + intentScript(token)
  const bodyClose = /<\/body\s*>/i.exec(doc)
  const framed = bodyClose ? doc.slice(0, bodyClose.index) + script + doc.slice(bodyClose.index) : doc + script

  return prelude + framed
}

export interface FrameSizeReport {
  height: number
  /** Intrinsic content width, 0 when unmeasurable. */
  width: number
  /** The frame's own width when it measured — what the content width is only meaningful against. */
  viewport: number
}

/** Parse a size report from the frame. Null unless it is OUR message type,
 *  carries OUR token, and holds a sane finite height — anything inside the
 *  sandbox can postMessage, so everything is validated before it moves the
 *  layout. Height clamped to the band; width sanitized but uncapped (the
 *  frame caps it against the column at render). */
export function frameSizeFromMessage(data: unknown, token: string): FrameSizeReport | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }

  const message = data as { type?: unknown; token?: unknown; height?: unknown; viewport?: unknown; width?: unknown }

  if (message.type !== SIZE_MESSAGE_TYPE || message.token !== token || typeof message.height !== 'number') {
    return null
  }

  if (!Number.isFinite(message.height) || message.height <= 0) {
    return null
  }

  const width =
    typeof message.width === 'number' && Number.isFinite(message.width) && message.width > 0
      ? Math.round(message.width)
      : 0

  return {
    height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(message.height))),
    viewport:
      typeof message.viewport === 'number' && Number.isFinite(message.viewport) ? Math.round(message.viewport) : 0,
    width
  }
}

const PARTIAL_MESSAGE_TYPE = 'hermes-widget-partial'

/** The empty frame a half-written widget is poured into: it keeps the theme, reports its size, and
 *  swaps its body for whatever markup its parent sends — nothing it receives is ever run as script. */
export function partialShell(token: string, prelude: string): string {
  const receive =
    '<script>(function(){var t=' +
    JSON.stringify(token) +
    ';addEventListener("message",function(e){var d=e.data;' +
    'if(e.source===parent&&d&&d.type===' +
    JSON.stringify(PARTIAL_MESSAGE_TYPE) +
    '&&d.token===t&&typeof d.html==="string"&&document.body)document.body.innerHTML=d.html})})()</script>'

  return withInlineChrome('<body></body>' + receive, token, prelude)
}

export function partialMessage(token: string, html: string) {
  return { html, token, type: PARTIAL_MESSAGE_TYPE }
}

/** What of a half-written document can be shown: its markup and styles up to the last whole tag. Scripts
 *  — finished or still open — are left out; they run only once the document is complete. */
export function partialHtml(code: string): string {
  const closed = code.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
  const unopened = closed.replace(/<script\b[\s\S]*$/i, '')
  const lastOpen = unopened.lastIndexOf('<')

  return lastOpen > unopened.lastIndexOf('>') ? unopened.slice(0, lastOpen) : unopened
}

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0

/** Does this look like a finished document — every script and style closed, nothing cut mid-tag, a
 *  page that opened `<body>`/`<html>` closing it? A reply keeps streaming after its widget ends, so
 *  this (not the end of the reply) is what lets the widget come alive early. */
export function isCompleteWidget(code: string): boolean {
  const text = code.trim()

  if (!text || !text.endsWith('>')) {
    return false
  }

  return (
    count(text, /<script\b/gi) === count(text, /<\/script\s*>/gi) &&
    count(text, /<style\b/gi) === count(text, /<\/style\s*>/gi) &&
    count(text, /<body\b/gi) <= count(text, /<\/body\s*>/gi) &&
    count(text, /<html\b/gi) <= count(text, /<\/html\s*>/gi)
  )
}

/** A short stable name for a widget's text — what its network approval is filed under. */
export function widgetKey(code: string): string {
  let hash = 5381

  for (let index = 0; index < code.length; index += 1) {
    hash = ((hash << 5) + hash + code.charCodeAt(index)) | 0
  }

  return `widget:${(hash >>> 0).toString(36)}:${code.length}`
}

export interface FigurePlacement {
  /** Left edge of the frame, measured from the figure area's left edge. */
  offset: number
  width: number
}

/** Where a widget sits. The figure area is the text column, widened on a wide window up to
 *  `FIGURE_MAX_WIDTH` and centred on it. The frame is as wide as its content — all of the area while
 *  fluid or not yet measured. One that fits the column lines up with the text, like an image; one that
 *  needs more is centred on the column. */
export function placeFigure({
  area,
  column,
  content
}: {
  area: number
  column: number
  content: null | number
}): FigurePlacement {
  const room = Math.max(area, column)
  const width = Math.round(content === null ? room : Math.min(content, room))
  const offset = width <= column ? (room - column) / 2 : (room - width) / 2

  return { offset: Math.round(offset), width }
}

/** The figure area for a column inside a pane of `pane` px: wider than the column only when the pane
 *  has the room. */
export const figureArea = (column: number, pane: number): number =>
  Math.max(column, Math.min(FIGURE_MAX_WIDTH, pane - 2 * FIGURE_PANE_GUTTER))
