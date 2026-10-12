/**
 * The ```card fence: the fixed moments of a conversation — a place, a map of places, an itinerary, an
 * event, a product, a link, a video — described as data and drawn by the app in one design line (the agent
 * cards of components/ui/hermes-card.tsx). The agent says what; the app owns how it looks and what its
 * buttons may do: they open a link the card names or put a sentence in the chat — never act unasked.
 *
 * Forgiving where models drift (`lon`/`lng`, `image`/`photo`, `items`/`places`), strict about what
 * would mislead: only http(s) links and images, real coordinates, finite prices.
 */

import { youtube } from '../embeds/providers/youtube'

export const CARD_KINDS = ['place', 'map', 'itinerary', 'event', 'product', 'link', 'video', 'videos'] as const

export type CardKind = (typeof CARD_KINDS)[number]

/** One YouTube video: what the agent knows of it (never fetched), and the player the app can open. */
export interface CardVideo {
  channel: string
  /** m:ss or h:mm:ss, or empty. */
  duration: string
  /** The player's address, as the YouTube matcher builds it (privacy-friendly host, start time kept). */
  embedUrl: string
  id: string
  /** Where "Open on YouTube" goes. */
  sourceUrl: string
  /** The agent's picture, or the poster YouTube keeps for every video. */
  thumbnail: string
  title: string
  /** "1.2M" or "1.2M views" as written, or a count compacted. Empty when unknown. */
  views: string
  /** "2 years ago", as written. */
  published: string
}

export interface CardPlace {
  address: string
  category: string
  image: string
  lat: null | number
  lng: null | number
  name: string
  note: string
  /** Open now (true), closed (false), or not said (null). */
  open: boolean | null
  price: string
  rating: null | number
  reviews: null | number
  /** Free text about opening: "Open until 22:00". */
  status: string
  url: string
}

export interface ItineraryItem {
  note: string
  place: string
  time: string
  title: string
}

export interface ItineraryDay {
  items: ItineraryItem[]
  label: string
}

export type CardSpec =
  | { days: ItineraryDay[]; image: string; kind: 'itinerary'; subtitle: string; title: string }
  | {
      end: Date | null
      allDay: boolean
      image: string
      kind: 'event'
      location: string
      note: string
      start: Date
      title: string
      url: string
    }
  | { description: string; image: string; kind: 'link'; site: string; title: string; url: string }
  | { kind: 'map'; places: CardPlace[]; subtitle: string; title: string }
  | { kind: 'place'; place: CardPlace }
  | { kind: 'video'; video: CardVideo }
  | { kind: 'videos'; subtitle: string; title: string; videos: CardVideo[] }
  | {
      badge: string
      brand: string
      currency: string
      features: string[]
      image: string
      kind: 'product'
      merchant: string
      name: string
      price: null | number
      rating: null | number
      reviews: null | number
      stock: string
      url: string
      was: null | number
    }

export type CardParse = { error: string } | { spec: CardSpec }

export const CARD_LIMITS = { days: 14, features: 6, items: 12, places: 20, videos: 8 } as const

type Raw = Record<string, unknown>

const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max = 200): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const number = (value: unknown): null | number => (finite(value) ? value : null)

/** An http(s) URL as written, or nothing — no other scheme reaches a link or an image. */
export function safeUrl(value: unknown): string {
  const raw = text(value, 2000)

  try {
    const url = new URL(raw)

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''
  } catch {
    return ''
  }
}

function placeFrom(raw: Raw): CardPlace {
  const lat = number(raw.lat ?? raw.latitude)
  const lng = number(raw.lng ?? raw.lon ?? raw.longitude)
  const located = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  const rating = number(raw.rating)

  return {
    address: text(raw.address),
    category: text(raw.category ?? raw.kind, 60),
    image: safeUrl(raw.image ?? raw.photo),
    lat: located ? lat : null,
    lng: located ? lng : null,
    name: text(raw.name ?? raw.title, 120),
    note: text(raw.note ?? raw.description, 280),
    open: typeof raw.open === 'boolean' ? raw.open : null,
    price: text(raw.price, 8),
    rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
    reviews: number(raw.reviews),
    status: text(raw.status ?? raw.hours, 60),
    url: safeUrl(raw.url ?? raw.website)
  }
}

function dateFrom(value: unknown): Date | null {
  const raw = text(value, 40)
  const date = raw ? new Date(raw) : null

  return date && !Number.isNaN(date.getTime()) ? date : null
}

/** "PT3M33S" or 213 or "3:33" → "3:33"; anything else is not shown. */
function durationText(value: unknown): string {
  const clock = (total: number) => {
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = Math.floor(total % 60)
    const pad = (part: number) => String(part).padStart(2, '0')

    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
  }

  if (finite(value) && value > 0 && value < 360_000) {
    return clock(value)
  }

  const raw = text(value, 20)

  if (/^\d{1,2}(:\d{2}){1,2}$/.test(raw)) {
    return raw
  }

  const iso = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)

  return iso?.[0] && iso[0] !== 'PT'
    ? clock(Number(iso[1] || 0) * 3600 + Number(iso[2] || 0) * 60 + Number(iso[3] || 0))
    : ''
}

function viewsText(value: unknown): string {
  return finite(value) && value >= 0
    ? new Intl.NumberFormat('en', { maximumFractionDigits: 1, notation: 'compact' }).format(value)
    : text(value, 24).replace(/\s*views?$/i, '')
}

/** A YouTube address the player can open, or null — no other site becomes a video. */
function videoFrom(raw: Raw): CardVideo | null {
  const url = safeUrl(raw.url ?? raw.link)
  const embed = url ? youtube(new URL(url)) : null

  if (!embed || embed.renderer !== 'frame') {
    return null
  }

  const id = embed.id.replace('youtube:', '')

  return {
    channel: text(raw.channel ?? raw.author, 80),
    duration: durationText(raw.duration),
    embedUrl: embed.embedUrl,
    id,
    published: text(raw.published ?? raw.date, 40),
    sourceUrl: embed.sourceUrl,
    thumbnail: safeUrl(raw.thumbnail ?? raw.image) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    title: text(raw.title ?? raw.name, 160),
    views: viewsText(raw.views)
  }
}

const builders: Record<CardKind, (raw: Raw) => CardSpec | string> = {
  event(raw) {
    const start = dateFrom(raw.start ?? raw.date)
    const title = text(raw.title ?? raw.name, 160)

    if (!title || !start) {
      return 'an event needs "title" and an ISO "start"'
    }

    return {
      allDay: raw.allDay === true || /^\d{4}-\d{2}-\d{2}$/.test(text(raw.start ?? raw.date)),
      end: dateFrom(raw.end),
      image: safeUrl(raw.image),
      kind: 'event',
      location: text(raw.location ?? raw.place),
      note: text(raw.note ?? raw.description, 400),
      start,
      title,
      url: safeUrl(raw.url)
    }
  },

  itinerary(raw) {
    const days = (Array.isArray(raw.days) ? raw.days : [])
      .filter(isRecord)
      .slice(0, CARD_LIMITS.days)
      .map(day => ({
        items: (Array.isArray(day.items) ? day.items : [])
          .filter(isRecord)
          .slice(0, CARD_LIMITS.items)
          .map(item => ({
            note: text(item.note, 280),
            place: text(item.place ?? item.location, 120),
            time: text(item.time, 20),
            title: text(item.title ?? item.name, 160)
          }))
          .filter(item => item.title),
        label: text(day.label ?? day.title ?? day.date, 60)
      }))
      .filter(day => day.items.length > 0)

    if (!text(raw.title) || days.length === 0) {
      return 'an itinerary needs "title" and "days" with items'
    }

    return {
      days,
      image: safeUrl(raw.image),
      kind: 'itinerary',
      subtitle: text(raw.subtitle),
      title: text(raw.title, 160)
    }
  },

  link(raw) {
    const url = safeUrl(raw.url)

    if (!url) {
      return 'a link needs an http(s) "url"'
    }

    return {
      description: text(raw.description, 300),
      image: safeUrl(raw.image),
      kind: 'link',
      site: text(raw.site, 60) || new URL(url).hostname.replace(/^www\./, ''),
      title: text(raw.title, 160) || url,
      url
    }
  },

  map(raw) {
    const places = (Array.isArray(raw.places) ? raw.places : Array.isArray(raw.items) ? raw.items : [])
      .filter(isRecord)
      .slice(0, CARD_LIMITS.places)
      .map(placeFrom)
      .filter(place => place.name && place.lat !== null)

    if (places.length === 0) {
      return 'a map needs "places", each with a name, lat and lng'
    }

    return { kind: 'map', places, subtitle: text(raw.subtitle), title: text(raw.title, 160) }
  },

  video(raw) {
    const video = videoFrom(raw)

    return video ? { kind: 'video', video } : 'a video needs a YouTube "url"'
  },

  videos(raw) {
    const videos = (Array.isArray(raw.videos) ? raw.videos : Array.isArray(raw.items) ? raw.items : [])
      .filter(isRecord)
      .slice(0, CARD_LIMITS.videos)
      .map(videoFrom)
      .filter((video): video is CardVideo => video !== null)

    return videos.length > 0
      ? { kind: 'videos', subtitle: text(raw.subtitle), title: text(raw.title, 160), videos }
      : 'videos needs "videos", each with a YouTube "url"'
  },

  place(raw) {
    const place = placeFrom(raw)

    return place.name ? { kind: 'place', place } : 'a place needs a "name"'
  },

  product(raw) {
    const name = text(raw.name ?? raw.title, 160)

    if (!name) {
      return 'a product needs a "name"'
    }

    const rating = number(raw.rating)

    return {
      badge: text(raw.badge, 30),
      brand: text(raw.brand, 60),
      currency: /^[A-Z]{3}$/.test(text(raw.currency)) ? text(raw.currency) : 'USD',
      features: (Array.isArray(raw.features) ? raw.features : [])
        .map(feature => text(feature, 120))
        .filter(Boolean)
        .slice(0, CARD_LIMITS.features),
      image: safeUrl(raw.image),
      kind: 'product',
      merchant: text(raw.merchant ?? raw.store, 60),
      name,
      price: number(raw.price),
      rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
      reviews: number(raw.reviews),
      stock: text(raw.stock ?? raw.availability, 40),
      url: safeUrl(raw.url),
      was: number(raw.was ?? raw.compareAt)
    }
  }
}

/** The fence's JSON, checked and normalised — or why it cannot be drawn. */
export function parseCardSpec(source: string): CardParse {
  let raw: unknown

  try {
    raw = JSON.parse(source)
  } catch {
    return { error: 'not valid JSON' }
  }

  if (!isRecord(raw)) {
    return { error: 'expected a JSON object' }
  }

  const kind = text(raw.type ?? raw.kind).toLowerCase() as CardKind

  if (!CARD_KINDS.includes(kind)) {
    return { error: `"type" must be one of ${CARD_KINDS.join(', ')}` }
  }

  const built = builders[kind](raw)

  return typeof built === 'string' ? { error: built } : { spec: built }
}

/** An event as an .ics file the calendar app opens. */
export function eventCalendar(spec: Extract<CardSpec, { kind: 'event' }>, now = new Date()): string {
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')

  const day = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '')
  const escape = (value: string) => value.replace(/[\\;,]/g, match => `\\${match}`).replace(/\n/g, '\\n')
  const end = spec.end ?? new Date(spec.start.getTime() + (spec.allDay ? 86_400_000 : 3_600_000))

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Brain//Agent cards//EN',
    'BEGIN:VEVENT',
    `UID:${stamp(spec.start)}-${Math.abs(hash(spec.title))}@hermes`,
    `DTSTAMP:${stamp(now)}`,
    spec.allDay ? `DTSTART;VALUE=DATE:${day(spec.start)}` : `DTSTART:${stamp(spec.start)}`,
    spec.allDay ? `DTEND;VALUE=DATE:${day(end)}` : `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(spec.title)}`,
    ...(spec.location ? [`LOCATION:${escape(spec.location)}`] : []),
    ...(spec.note ? [`DESCRIPTION:${escape(spec.note)}`] : []),
    ...(spec.url ? [`URL:${spec.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
}

function hash(value: string): number {
  let result = 0

  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0
  }

  return result
}

/** Directions to a point in OpenStreetMap — the same open data the maps are drawn from. */
export const directionsUrl = (place: Pick<CardPlace, 'lat' | 'lng' | 'name'>) =>
  place.lat !== null && place.lng !== null
    ? `https://www.openstreetmap.org/directions?to=${place.lat}%2C${place.lng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(place.name)}`
