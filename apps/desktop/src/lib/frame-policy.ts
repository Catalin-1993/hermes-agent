// What a sealed HTML frame may reach. Agent-written pages run in an opaque, script-only frame —
// Library interactive blocks and the widgets drawn inline in chat share this one policy:
//
//   · no app, no storage, no network by default;
//   · LIBRARY_HOSTS (well-known public CDNs) may serve code, styles and fonts, so a chart or diagram
//     can load Chart.js or D3 without asking — never data, images or a connection;
//   · any other host must be named in the page itself and approved by its owner (`networkAccess`).
//
// Only public https hosts, spelled out: no wildcards, no addresses, no local names, so an approval
// cannot be a door to the owner's machine or network.

/** Public CDNs a page may load code, styles and fonts from without asking. */
export const LIBRARY_HOSTS: readonly string[] = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'esm.sh']

export const NETWORK_MAX_HOSTS = 8

const HOST = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/
const LOCAL_SUFFIX = /\.(?:local|localhost|internal|intranet|lan|home|corp|private|test|invalid|example)$/

/** Is this a name the owner could reasonably be asked to approve? */
export const isPublicHost = (host: string): boolean => HOST.test(host) && !LOCAL_SUFFIX.test(host)

const META_TAG = /<meta\b[^>]*\bname\s*=\s*["']hermes:network["'][^>]*>/i
const META_CONTENT = /\bcontent\s*=\s*(["'])([\s\S]*?)\1/i

/** What a document names in its `<meta name="hermes:network" content="api.example.com …">`: the valid
 *  hosts (lower-cased, once each, up to the limit) and anything it wrote that is not one. A CDN from
 *  LIBRARY_HOSTS needs no naming. */
export function networkRequest(html: string): { hosts: string[]; invalid: string[] } {
  const content = META_CONTENT.exec(META_TAG.exec(html)?.[0] ?? '')?.[2] ?? ''
  const hosts: string[] = []
  const invalid: string[] = []

  for (const word of content
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter(Boolean)) {
    if (!isPublicHost(word) || hosts.length >= NETWORK_MAX_HOSTS) {
      invalid.push(word)
    } else if (!hosts.includes(word)) {
      hosts.push(word)
    }
  }

  return { hosts, invalid }
}

/** The hosts an owner stored as approved (JSON text), re-checked: anything else in it is ignored. */
export function parseApprovedHosts(text: string): string[] {
  try {
    const value: unknown = text ? JSON.parse(text) : []

    return Array.isArray(value)
      ? [...new Set(value.filter((host): host is string => typeof host === 'string' && isPublicHost(host)))]
      : []
  } catch {
    return []
  }
}

/** What a page may reach now (named by its document AND approved), and what waits on the owner. */
export function networkAccess(html: string, approvedText: string) {
  const approved = parseApprovedHosts(approvedText)
  const { hosts, invalid } = networkRequest(html)

  return {
    active: hosts.filter(host => approved.includes(host)),
    invalid,
    pending: hosts.filter(host => !approved.includes(host))
  }
}

export interface FramePolicy {
  /** Public https hosts the owner approved (already validated by the caller). */
  hosts?: readonly string[]
  /** Admit LIBRARY_HOSTS for code, styles and fonts. */
  libraries?: boolean
}

export function contentPolicy({ hosts = [], libraries = false }: FramePolicy = {}): string {
  const origins = (list: readonly string[]) => list.map(host => `https://${host}`).join(' ')
  const approved = origins(hosts)
  const shared = libraries ? origins(LIBRARY_HOSTS) : ''
  const allow = (base: string, ...extra: string[]) => [base, ...extra.filter(Boolean)].join(' ')

  return [
    "default-src 'none'",
    allow("script-src 'unsafe-inline'", shared, approved),
    allow("style-src 'unsafe-inline'", shared, approved),
    allow('img-src data: blob:', approved),
    allow('media-src data: blob:', approved),
    allow('font-src data:', shared, approved),
    ...(approved ? [`connect-src ${approved} ${hosts.map(host => `wss://${host}`).join(' ')}`] : [])
  ].join('; ')
}

/** The document with the policy first, before any script of its own can run. */
export function sealedHtml(html: string, policy: FramePolicy = {}): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentPolicy(policy)}">`

  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, match => `${match}${meta}`) : `${meta}${html}`
}
