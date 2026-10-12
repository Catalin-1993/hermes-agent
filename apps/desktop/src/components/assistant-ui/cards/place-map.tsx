import 'maplibre-gl/dist/maplibre-gl.css'

import { LngLatBounds, Map as MapLibre, Marker, setWorkerUrl } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { useIsDark } from '../embeds/use-is-dark'

import type { CardPlace } from './card-spec'

/** OpenFreeMap: open vector tiles, no key. Positron for light, its dark sibling for dark. */
export const MAP_STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron'
} as const

// The worker comes from the same CDN release as the bundled library: a map needs the network for its
// tiles anyway, and a cross-origin worker is wrapped in a blob by MapLibre — so it loads the same way
// from the dev server and from the packaged app's file:// page.
export const MAPLIBRE_WORKER = 'https://cdn.jsdelivr.net/npm/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs'

setWorkerUrl(MAPLIBRE_WORKER)

const PIN_CLASS =
  'grid cursor-pointer place-items-center overflow-hidden rounded-full border-[3px] border-white bg-(--ui-accent) text-[0.6875rem] font-semibold text-white shadow-[0_6px_16px_-4px_rgba(11,21,48,0.45)] transition-transform duration-200'

const PIN_ACTIVE_CLASS = 'scale-115 border-(--ui-accent) z-10'

function pinElement(place: CardPlace, index: number, onSelect: () => void): HTMLButtonElement {
  const pin = document.createElement('button')

  pin.type = 'button'
  pin.setAttribute('aria-label', place.name)
  pin.className = cn(PIN_CLASS, place.image ? 'size-11' : 'size-8')

  if (place.image) {
    const photo = document.createElement('img')

    photo.src = place.image
    photo.alt = ''
    photo.referrerPolicy = 'no-referrer'
    photo.className = 'size-full object-cover'

    photo.onerror = () => {
      photo.remove()
      pin.textContent = String(index + 1)
    }

    pin.append(photo)
  } else {
    pin.textContent = String(index + 1)
  }

  pin.addEventListener('click', event => {
    event.stopPropagation()
    onSelect()
  })

  return pin
}

interface PlaceMapProps {
  /** The place shown as chosen — its pin grows and the map eases to it. */
  active?: number
  className?: string
  height: number | string
  onSelect?: (index: number) => void
  places: CardPlace[]
}

/** A calm map of one or more places: their pins, framed together; Ctrl/⌘-scroll zooms, the plain wheel
 *  scrolls the chat. */
export default function PlaceMap({ active, className, height, onSelect, places }: PlaceMapProps) {
  const host = useRef<HTMLDivElement>(null)
  const dark = useIsDark()
  const [map, setMap] = useState<MapLibre | null>(null)
  const [pins, setPins] = useState<HTMLButtonElement[]>([])
  const located = places.filter(place => place.lat !== null && place.lng !== null)

  useEffect(() => {
    if (!host.current) {
      return
    }

    const instance = new MapLibre({
      attributionControl: { compact: true },
      container: host.current,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      style: MAP_STYLES.light
    })

    const observer = new ResizeObserver(() => instance.resize())

    observer.observe(host.current)
    setMap(instance)

    return () => {
      observer.disconnect()
      instance.remove()
    }
  }, [])

  useEffect(() => {
    map?.setStyle(dark ? MAP_STYLES.dark : MAP_STYLES.light)
  }, [dark, map])

  // Pins and framing follow the places.
  useEffect(() => {
    if (!map || located.length === 0) {
      return
    }

    const markers = located.map((place, index) => {
      const element = pinElement(place, index, () => onSelect?.(index))

      return { element, marker: new Marker({ element }).setLngLat([place.lng!, place.lat!]).addTo(map) }
    })

    setPins(markers.map(entry => entry.element))

    if (located.length === 1) {
      map.jumpTo({ center: [located[0]!.lng!, located[0]!.lat!], zoom: 14 })
    } else {
      const bounds = new LngLatBounds()

      for (const place of located) {
        bounds.extend([place.lng!, place.lat!])
      }

      map.fitBounds(bounds, { animate: false, maxZoom: 15, padding: 56 })
    }

    return () => {
      for (const entry of markers) {
        entry.marker.remove()
      }
    }
    // `located` is derived from `places`; `onSelect` is a fresh closure each render and only read on click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, places])

  useEffect(() => {
    pins.forEach((pin, index) => {
      for (const name of PIN_ACTIVE_CLASS.split(' ')) {
        pin.classList.toggle(name, index === active)
      }
    })

    const chosen = active === undefined ? null : located[active]

    if (map && chosen && located.length > 1) {
      map.easeTo({ center: [chosen.lng!, chosen.lat!], duration: 500 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, map, pins])

  return <div className={cn('w-full overflow-hidden', className)} ref={host} style={{ height }} />
}
