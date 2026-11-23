/**
 * Brain: what a pasted profile link is — which platform, and the handle to show — for the Identity section of the
 * profile menu (app/chat/sidebar/identity-menu.tsx). Pure: no storage, no network.
 *
 * Accepts what people paste: a full address, one without `https://`, or `@handle` style paths. Only web links are
 * accepted; anything that is not `http(s)` (a `javascript:` or `file:` address) is refused, so a saved row can only
 * ever open a web page.
 */

export interface SocialPlatform {
  /** Codicon for the row. */
  icon: string
  id: string
  name: string
}

export interface SocialLink {
  /** What follows the platform's address, as a person writes it (`@cata`, `+49 151…`), or the site's host. */
  handle: string
  platform: SocialPlatform
  url: string
}

const PLATFORMS: readonly (SocialPlatform & { hosts: readonly string[] })[] = [
  { hosts: ['instagram.com', 'instagr.am'], icon: 'device-camera', id: 'instagram', name: 'Instagram' },
  { hosts: ['wa.me', 'whatsapp.com'], icon: 'comment-discussion', id: 'whatsapp', name: 'WhatsApp' },
  { hosts: ['facebook.com', 'fb.com', 'fb.me'], icon: 'account', id: 'facebook', name: 'Facebook' },
  { hosts: ['m.me', 'messenger.com'], icon: 'comment-discussion', id: 'messenger', name: 'Messenger' },
  { hosts: ['threads.net', 'threads.com'], icon: 'mention', id: 'threads', name: 'Threads' },
  { hosts: ['x.com', 'twitter.com'], icon: 'twitter', id: 'x', name: 'X' },
  { hosts: ['linkedin.com'], icon: 'briefcase', id: 'linkedin', name: 'LinkedIn' },
  { hosts: ['tiktok.com'], icon: 'play-circle', id: 'tiktok', name: 'TikTok' },
  { hosts: ['youtube.com', 'youtu.be'], icon: 'play-circle', id: 'youtube', name: 'YouTube' },
  { hosts: ['t.me', 'telegram.me', 'telegram.org'], icon: 'comment-discussion', id: 'telegram', name: 'Telegram' },
  { hosts: ['github.com'], icon: 'github', id: 'github', name: 'GitHub' },
  { hosts: ['discord.gg', 'discord.com'], icon: 'comment-discussion', id: 'discord', name: 'Discord' },
  { hosts: ['reddit.com'], icon: 'comment-discussion', id: 'reddit', name: 'Reddit' },
  { hosts: ['bsky.app'], icon: 'mention', id: 'bluesky', name: 'Bluesky' },
  { hosts: ['snapchat.com'], icon: 'device-camera', id: 'snapchat', name: 'Snapchat' },
  { hosts: ['pinterest.com'], icon: 'heart', id: 'pinterest', name: 'Pinterest' },
  { hosts: ['twitch.tv'], icon: 'play-circle', id: 'twitch', name: 'Twitch' }
]

const WEBSITE: SocialPlatform = { icon: 'globe', id: 'website', name: 'Website' }

/** Path segments that name a page of the platform, not a person. */
const NOT_A_HANDLE = new Set(['in', 'company', 'channel', 'c', 'user', 'u', 'profile.php', 'pages', 'people'])

function platformOf(host: string): SocialPlatform {
  const bare = host.replace(/^(www|m|mobile)\./, '')
  const hit = PLATFORMS.find(platform => platform.hosts.some(h => bare === h || bare.endsWith(`.${h}`)))

  return hit ? { icon: hit.icon, id: hit.id, name: hit.name } : WEBSITE
}

function handleOf(url: URL, platform: SocialPlatform): string {
  if (platform.id === 'website') {
    return url.host.replace(/^www\./, '')
  }

  if (platform.id === 'whatsapp' && url.host.endsWith('wa.me')) {
    const number = url.pathname.replace(/\//g, '')

    return number ? `+${number.replace(/^\+/, '')}` : 'WhatsApp'
  }

  const segments = url.pathname.split('/').filter(Boolean)
  const name = segments.find(segment => !NOT_A_HANDLE.has(segment.toLowerCase())) ?? url.searchParams.get('id') ?? ''

  if (!name) {
    return platform.name
  }

  const clean = decodeURIComponent(name)

  return clean.startsWith('@') ? clean : `@${clean}`
}

/** The link `input` names, or null when it is not a web address. */
export function parseSocialLink(input: string): null | SocialLink {
  const raw = input.trim()

  if (!raw || /\s/.test(raw)) {
    return null
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`

  let url: URL

  try {
    url = new URL(withScheme)
  } catch {
    return null
  }

  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.')) {
    return null
  }

  const platform = platformOf(url.hostname.toLowerCase())

  return { handle: handleOf(url, platform), platform, url: url.toString() }
}
