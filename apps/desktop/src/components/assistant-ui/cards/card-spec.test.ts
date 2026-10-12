import { describe, expect, it } from 'vitest'

import { LIBRARY_HOSTS } from '@/lib/frame-policy'

import { type CardSpec, directionsUrl, eventCalendar, parseCardSpec, safeUrl } from './card-spec'
import { MAP_STYLES, MAPLIBRE_WORKER } from './place-map'

const parse = (value: unknown): CardSpec => {
  const result = parseCardSpec(JSON.stringify(value))

  if ('error' in result) {
    throw new Error(result.error)
  }

  return result.spec
}

describe('reading a ```card fence', () => {
  it('reads a place from the names models use, and keeps only real coordinates', () => {
    const place = parse({ lat: 44.43, lon: 26.1, name: 'Piccolo', photo: 'https://x.test/p.jpg', type: 'place' })
    const nowhere = parse({ lat: 120, lng: 400, name: 'Nowhere', type: 'place' })

    expect(place.kind === 'place' && [place.place.lat, place.place.lng, place.place.image]).toEqual([
      44.43,
      26.1,
      'https://x.test/p.jpg'
    ])
    expect(nowhere.kind === 'place' && nowhere.place.lat).toBeNull()
  })

  it('puts on a map only the places it can draw', () => {
    const map = parse({ places: [{ lat: 1, lng: 2, name: 'A' }, { name: 'B' }], type: 'map' })

    expect(map.kind === 'map' && map.places.map(place => place.name)).toEqual(['A'])
    expect('error' in parseCardSpec(JSON.stringify({ places: [{ name: 'B' }], type: 'map' }))).toBe(true)
  })

  it('lets no link or image through that is not http(s)', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('')
    expect(safeUrl('file:///etc/passwd')).toBe('')
    expect(safeUrl('data:text/html,hi')).toBe('')
    expect(safeUrl('https://example.com/a b')).toBe('https://example.com/a%20b')

    const product = parse({ image: 'javascript:x', name: 'Thing', type: 'product', url: 'ftp://x' })

    expect(product.kind === 'product' && [product.image, product.url]).toEqual(['', ''])
  })

  it('refuses what cannot be drawn, with a reason', () => {
    for (const value of [
      { type: 'weather' },
      { type: 'event', title: 'No date' },
      { start: 'soon', title: 'Bad date', type: 'event' },
      { days: [], title: 'Trip', type: 'itinerary' },
      { type: 'link', url: 'mailto:a@b.c' },
      { type: 'product' }
    ]) {
      const result = parseCardSpec(JSON.stringify(value))

      expect('error' in result && result.error.length > 0).toBe(true)
    }
  })
})

describe('what a card hands to other apps', () => {
  it('turns an event into a calendar file a calendar app reads', () => {
    const event = parse({
      location: 'Studio B; 3rd floor',
      start: '2026-10-14T15:00:00Z',
      title: 'Review, design',
      type: 'event'
    })

    const ics = event.kind === 'event' ? eventCalendar(event, new Date('2026-10-01T00:00:00Z')) : ''

    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics).toContain('DTSTART:20261014T150000Z')
    expect(ics).toContain('DTEND:20261014T160000Z')
    expect(ics).toContain(String.raw`SUMMARY:Review\, design`)
    expect(ics).toContain(String.raw`LOCATION:Studio B\; 3rd floor`)
  })

  it('marks a date-only event as all day', () => {
    const event = parse({ start: '2026-12-24', title: 'Holiday', type: 'event' })
    const ics = event.kind === 'event' ? eventCalendar(event) : ''

    expect(event.kind === 'event' && event.allDay).toBe(true)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261224')
  })

  it('asks for directions to the point when it has one, by name when it does not', () => {
    expect(directionsUrl({ lat: 44.4, lng: 26.1, name: 'A' })).toContain('to=44.4%2C26.1')
    expect(directionsUrl({ lat: null, lng: null, name: 'Café Ô' })).toContain(encodeURIComponent('Café Ô'))
  })
})

describe('the map', () => {
  it('draws on OpenFreeMap over https, with a worker from a CDN the app already trusts', () => {
    for (const style of Object.values(MAP_STYLES)) {
      expect(new URL(style).host).toBe('tiles.openfreemap.org')
    }

    expect(LIBRARY_HOSTS).toContain(new URL(MAPLIBRE_WORKER).host)
  })

  it("opens only YouTube videos, with a poster of YouTube's own unless the agent gave one", () => {
    const video = parse({ channel: 'Rick', title: 'Song', type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ?t=90' })

    expect(video.kind === 'video' && [video.video.id, video.video.thumbnail, video.video.embedUrl]).toEqual([
      'dQw4w9WgXcQ',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?modestbranding=1&rel=0&start=90'
    ])
    expect('error' in parseCardSpec('{"type":"video","url":"https://vimeo.com/76979871"}')).toBe(true)
    expect('error' in parseCardSpec('{"type":"video","url":"javascript:alert(1)"}')).toBe(true)
  })

  it('writes durations and views the way a person reads them', () => {
    const read = (duration: unknown, views: unknown) => {
      const spec = parse({ duration, type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', views })

      return spec.kind === 'video' ? [spec.video.duration, spec.video.views] : []
    }

    expect(read(213, 1_234_567)).toEqual(['3:33', '1.2M'])
    expect(read('PT1H2M3S', '1.4M views')).toEqual(['1:02:03', '1.4M'])
    expect(read('12:34', undefined)).toEqual(['12:34', ''])
    expect(read('soon', -5)).toEqual(['', ''])
  })

  it('draws the videos of a list that are videos, and none of the rest', () => {
    const spec = parse({
      type: 'videos',
      videos: [{ url: 'https://youtu.be/dQw4w9WgXcQ' }, { url: 'https://example.com/clip' }, { title: 'no link' }]
    })

    expect(spec.kind === 'videos' && spec.videos.map(video => video.id)).toEqual(['dQw4w9WgXcQ'])
    expect('error' in parseCardSpec('{"type":"videos","videos":[{"url":"https://example.com"}]}')).toBe(true)
  })
})
