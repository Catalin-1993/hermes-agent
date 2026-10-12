// YouTube's embedded player refuses to play (error 152/153, or "This video is unavailable" for most music)
// when the request names no embedding site, or a local one (file://, the dev server's 127.0.0.1). The chat's
// player frame therefore sends no Referer at all (youtube-embed.tsx), and its requests are given the
// project's own site here. It must be a real third-party site: YouTube rejects a Referer of its own.
const EMBED_REFERER = 'https://hermes-agent.nousresearch.com/'

const YOUTUBE_HOST_RE =
  /(^|\.)(youtube\.com|youtube-nocookie\.com|googlevideo\.com|ytimg\.com|youtubei\.googleapis\.com)$/i

export function stampEmbedReferer(requestUrl: string, headers: Record<string, string>): Record<string, string> {
  let host = ''

  try {
    host = new URL(requestUrl).hostname
  } catch {
    return headers
  }

  if (!YOUTUBE_HOST_RE.test(host) || Object.keys(headers).some(name => name.toLowerCase() === 'referer')) {
    return headers
  }

  return { ...headers, Referer: EMBED_REFERER }
}
