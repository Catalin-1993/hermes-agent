/**
 * The data behind the chart's analysis views, from public endpoints that need no key and no account:
 * Binance's futures market for Derivatives (funding, open interest, who is long and who is short),
 * CryptoCompare for News, alternative.me's Fear & Greed index for Community. Each parser takes the rows as
 * the source sends them and is tested; the fetchers only add the request.
 */

export const FUTURES = 'https://fapi.binance.com'
export const NEWS_API = 'https://min-api.cryptocompare.com'
export const FEAR_GREED_API = 'https://api.alternative.me'

export interface Timed {
  time: number
  value: number
}

export interface Derivatives {
  /** Mark price over index price, in percent: how far the perpetual trades from spot. */
  basisPct: number
  funding: Timed[]
  /** The latest funding rate, per 8 hours, in percent. */
  fundingRate: number
  indexPrice: number
  longShort: { long: number; ratio: number; short: number; time: number }[]
  markPrice: number
  nextFundingTime: number
  /** Open interest in USDT, oldest first. */
  openInterest: Timed[]
}

const num = (value: unknown) => Number(value)

interface Row {
  [key: string]: unknown
}

async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(String(response.status))
  }

  return (await response.json()) as T
}

export function parseDerivatives(premium: Row, funding: Row[], interest: Row[], ratios: Row[]): Derivatives {
  const mark = num(premium.markPrice)
  const index = num(premium.indexPrice)

  return {
    basisPct: index ? ((mark - index) / index) * 100 : 0,
    funding: funding.map(row => ({ time: num(row.fundingTime) / 1000, value: num(row.fundingRate) * 100 })),
    fundingRate: num(premium.lastFundingRate) * 100,
    indexPrice: index,
    longShort: ratios.map(row => ({
      long: num(row.longAccount) * 100,
      ratio: num(row.longShortRatio),
      short: num(row.shortAccount) * 100,
      time: num(row.timestamp) / 1000
    })),
    markPrice: mark,
    nextFundingTime: num(premium.nextFundingTime) / 1000,
    openInterest: interest.map(row => ({ time: num(row.timestamp) / 1000, value: num(row.sumOpenInterestValue) }))
  }
}

export async function fetchDerivatives(coin: string, signal?: AbortSignal): Promise<Derivatives> {
  const symbol = `${coin.toUpperCase()}USDT`

  const [premium, funding, interest, ratios] = await Promise.all([
    json<Row>(`${FUTURES}/fapi/v1/premiumIndex?symbol=${symbol}`, signal),
    json<Row[]>(`${FUTURES}/fapi/v1/fundingRate?symbol=${symbol}&limit=90`, signal),
    json<Row[]>(`${FUTURES}/futures/data/openInterestHist?symbol=${symbol}&period=4h&limit=120`, signal),
    json<Row[]>(`${FUTURES}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=4h&limit=120`, signal)
  ])

  return parseDerivatives(premium, funding, interest, ratios)
}

export interface Article {
  body: string
  id: string
  source: string
  time: number
  title: string
  url: string
}

export function parseNews(answer: { Data?: Row[] }): Article[] {
  return (Array.isArray(answer.Data) ? answer.Data : [])
    .filter(row => typeof row.title === 'string' && /^https?:\/\//.test(String(row.url)))
    .map(row => ({
      body: String(row.body ?? '').slice(0, 220),
      id: String(row.id ?? row.url),
      source: String(
        row.source_info && (row.source_info as Row).name ? (row.source_info as Row).name : (row.source ?? '')
      ),
      time: num(row.published_on),
      title: String(row.title),
      url: String(row.url)
    }))
}

export async function fetchNews(coin: string, signal?: AbortSignal): Promise<Article[]> {
  return parseNews(
    await json<{ Data?: Row[] }>(`${NEWS_API}/data/v2/news/?lang=EN&categories=${encodeURIComponent(coin)}`, signal)
  ).slice(0, 20)
}

export interface FearGreed {
  /** 0 (extreme fear) to 100 (extreme greed), newest first. */
  history: Timed[]
  label: string
  value: number
}

export function parseFearGreed(answer: { data?: Row[] }): FearGreed | null {
  const rows = Array.isArray(answer.data) ? answer.data : []

  if (!rows.length) {
    return null
  }

  return {
    history: rows.map(row => ({ time: num(row.timestamp), value: num(row.value) })),
    label: String(rows[0].value_classification ?? ''),
    value: num(rows[0].value)
  }
}

export async function fetchFearGreed(signal?: AbortSignal): Promise<FearGreed | null> {
  return parseFearGreed(await json<{ data?: Row[] }>(`${FEAR_GREED_API}/fng/?limit=30`, signal))
}
