import { useStore } from '@nanostores/react'
import { lazy, Suspense, useRef, useState } from 'react'

import { requestComposerSubmit } from '@/app/chat/composer/focus'
import { useSessionView } from '@/app/chat/session-view'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { CARD_BUTTON_CLASS, CARD_SURFACE_CLASS, HermesCard } from '@/components/ui/hermes-card'
import { useI18n } from '@/i18n'
import { downloadTextFile } from '@/lib/download-text'
import { openExternalLink } from '@/lib/external-link'
import { cn } from '@/lib/utils'

import { useFigureArea } from '../use-figure-area'

import { Actions, Meta, Photo } from './card-parts'
import { type CardPlace, type CardSpec, directionsUrl, eventCalendar } from './card-spec'
import { VideoCard, VideosCard } from './video-card'

const PlaceMap = lazy(() => import('./place-map'))

type Spec<K extends CardSpec['kind']> = Extract<CardSpec, { kind: K }>

/** A card's buttons speak in the chat — as the user, visibly — or open the link the card names. */
function useSay() {
  const view = useSessionView()
  const storedId = useStore(view.$storedId)
  const target = view.kind === 'tile' ? `tile:${storedId}` : 'main'

  return (text: string) => requestComposerSubmit(text, { target })
}

function Rating({ rating, reviews }: { rating: null | number; reviews: null | number }) {
  const { t } = useI18n()

  if (rating === null) {
    return null
  }

  return (
    <span className="inline-flex items-center gap-1 text-[0.75rem] text-(--ui-text-secondary)">
      <span aria-hidden className="text-(--ui-yellow)">
        ★
      </span>
      <span className="font-semibold text-(--ui-text-primary) tabular-nums">{rating.toFixed(1)}</span>
      {reviews !== null && <span className="text-(--ui-text-tertiary)">· {t.agentCards.reviews(reviews)}</span>}
    </span>
  )
}

function OpenStatus({ place }: { place: CardPlace }) {
  const { t } = useI18n()

  if (place.open === null && !place.status) {
    return null
  }

  const tone =
    place.open === false
      ? 'bg-[color-mix(in_srgb,var(--ui-red)_12%,transparent)] text-(--ui-red)'
      : 'bg-[color-mix(in_srgb,var(--ui-green)_12%,transparent)] text-(--ui-green)'

  return (
    <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-(--ui-text-tertiary)">
      {place.open !== null && (
        <span className={cn('rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold', tone)}>
          {place.open ? t.agentCards.open : t.agentCards.closed}
        </span>
      )}
      {place.status}
    </span>
  )
}

function MapFallback({ height }: { height: number }) {
  return <div className="animate-pulse bg-(--card-well)" style={{ height }} />
}

function PlaceCard({ spec }: { spec: Spec<'place'> }) {
  const { t } = useI18n()
  const say = useSay()
  const { place } = spec
  const located = place.lat !== null

  return (
    <HermesCard className="not-prose my-3 max-w-xl" data-card="place">
      {located ? (
        <Suspense fallback={<MapFallback height={190} />}>
          <PlaceMap height={190} places={[place]} />
        </Suspense>
      ) : (
        <Photo className="h-44 w-full" src={place.image} />
      )}
      <div className="flex min-w-0 flex-col gap-1.5 px-4 pt-3.5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em]">{place.name}</div>
            <Meta>{[place.category, place.price]}</Meta>
          </div>
          {located && place.image && <Photo className="size-12 shrink-0 rounded-xl" src={place.image} />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Rating rating={place.rating} reviews={place.reviews} />
          <OpenStatus place={place} />
        </div>
        {place.address && (
          <span className="flex items-start gap-1.5 text-[0.75rem] text-(--ui-text-tertiary)">
            <Codicon className="mt-px shrink-0" name="location" size="0.75rem" />
            {place.address}
          </span>
        )}
        {place.note && <p className="m-0 text-[0.8125rem] leading-relaxed text-(--ui-text-secondary)">{place.note}</p>}
      </div>
      <Actions>
        <Button className={CARD_BUTTON_CLASS} onClick={() => openExternalLink(directionsUrl(place))} size="sm">
          <Codicon name="compass" size="0.8125rem" />
          {t.agentCards.directions}
        </Button>
        {place.url && (
          <Button
            className={CARD_BUTTON_CLASS}
            onClick={() => openExternalLink(place.url)}
            size="sm"
            variant="secondary"
          >
            {t.agentCards.website}
          </Button>
        )}
        <Button
          className={CARD_BUTTON_CLASS}
          onClick={() => say(t.agentCards.askAboutPrompt(place.name))}
          size="sm"
          variant="text"
        >
          {t.agentCards.askAbout}
        </Button>
      </Actions>
    </HermesCard>
  )
}

function MapCard({ spec }: { spec: Spec<'map'> }) {
  const { t } = useI18n()
  const outer = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const figure = useFigureArea(outer)
  const [active, setActive] = useState<number | undefined>(undefined)
  const room = figure ? Math.max(figure.area, figure.column) : 0
  const inset = figure ? (room - figure.column) / 2 : 0
  const height = Math.round(Math.min(440, Math.max(260, (room || 640) * 0.5)))

  const choose = (index: number) => {
    setActive(index)
    list.current?.children[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }

  return (
    <div
      className="my-3 min-w-0"
      data-figure=""
      ref={outer}
      style={figure ? { marginInline: -inset, width: room } : undefined}
    >
      <div className={cn(CARD_SURFACE_CLASS, 'not-prose overflow-hidden')} data-card="map">
        {(spec.title || spec.subtitle) && (
          <div className="px-5 pt-4 pb-3">
            {spec.title && (
              <div aria-level={3} className="text-[0.9375rem] font-semibold tracking-[-0.01em]" role="heading">
                {spec.title}
              </div>
            )}
            <div className="mt-0.5 text-[0.75rem] text-(--ui-text-tertiary)">
              {spec.subtitle || t.agentCards.places(spec.places.length)}
            </div>
          </div>
        )}
        <Suspense fallback={<MapFallback height={height} />}>
          <PlaceMap active={active} height={height} onSelect={choose} places={spec.places} />
        </Suspense>
        <div className="flex snap-x gap-2.5 overflow-x-auto px-4 py-3.5" ref={list}>
          {spec.places.map((place, index) => (
            <button
              className={cn(
                'flex w-64 shrink-0 snap-start items-center gap-3 rounded-2xl border p-2.5 text-left transition-[background-color,border-color] duration-150',
                index === active
                  ? 'border-[color-mix(in_srgb,var(--ui-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--ui-accent)_7%,transparent)]'
                  : 'border-(--card-well-stroke) bg-(--card-well) hover:border-(--card-stroke)'
              )}
              key={`${place.name}-${index}`}
              onClick={() => setActive(index)}
              type="button"
            >
              {place.image ? (
                <Photo className="size-12 shrink-0 rounded-xl" src={place.image} />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--ui-accent)_12%,transparent)] text-[0.8125rem] font-semibold text-(--ui-accent)">
                  {index + 1}
                </span>
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[0.8125rem] font-semibold text-(--ui-text-primary)">{place.name}</span>
                <Meta>{[place.category, place.price]}</Meta>
                <span className="flex items-center gap-2">
                  <Rating rating={place.rating} reviews={null} />
                  {place.open !== null && (
                    <span
                      className={cn(
                        'text-[0.6875rem] font-semibold',
                        place.open ? 'text-(--ui-green)' : 'text-(--ui-red)'
                      )}
                    >
                      {place.open ? t.agentCards.open : t.agentCards.closed}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ItineraryCard({ spec }: { spec: Spec<'itinerary'> }) {
  return (
    <HermesCard className="not-prose my-3 max-w-xl" data-card="itinerary">
      <Photo className="h-36 w-full" src={spec.image} />
      <div className="px-4 pt-4">
        <div aria-level={3} className="text-[0.9375rem] font-semibold tracking-[-0.01em]" role="heading">
          {spec.title}
        </div>
        {spec.subtitle && <div className="mt-0.5 text-[0.75rem] text-(--ui-text-tertiary)">{spec.subtitle}</div>}
      </div>
      <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
        {spec.days.map((day, dayIndex) => (
          <section className="flex flex-col gap-2" key={`${day.label}-${dayIndex}`}>
            {day.label && (
              <div className="text-[0.6875rem] font-semibold tracking-[0.04em] text-(--ui-accent) uppercase">
                {day.label}
              </div>
            )}
            <ol className="m-0 flex list-none flex-col p-0">
              {day.items.map((item, index) => (
                <li className="relative flex gap-3 pb-3 last:pb-0" key={`${item.title}-${index}`}>
                  <span className="w-12 shrink-0 pt-0.5 text-right text-[0.75rem] text-(--ui-text-tertiary) tabular-nums">
                    {item.time}
                  </span>
                  <span className="relative flex w-3 shrink-0 justify-center">
                    <span className="mt-1.5 size-2.5 rounded-full border-2 border-(--ui-accent) bg-(--card-surface)" />
                    {index < day.items.length - 1 && (
                      <span aria-hidden className="absolute top-4 bottom-[-0.25rem] w-px bg-(--card-stroke)" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[0.8125rem] font-semibold text-(--ui-text-primary)">{item.title}</span>
                    {item.place && (
                      <span className="flex items-center gap-1 text-[0.75rem] text-(--ui-text-tertiary)">
                        <Codicon name="location" size="0.6875rem" />
                        {item.place}
                      </span>
                    )}
                    {item.note && (
                      <span className="text-[0.75rem] leading-relaxed text-(--ui-text-secondary)">{item.note}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </HermesCard>
  )
}

function EventCard({ spec }: { spec: Spec<'event'> }) {
  const { t } = useI18n()
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

  const when = spec.allDay
    ? t.agentCards.allDay
    : `${time.format(spec.start)}${spec.end ? ` – ${time.format(spec.end)}` : ''}`

  const date = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', weekday: 'long' }).format(spec.start)

  return (
    <HermesCard className="not-prose my-3 max-w-xl" data-card="event">
      <Photo className="h-36 w-full" src={spec.image} />
      <div className="flex gap-4 px-4 pt-4">
        <div className="flex w-14 shrink-0 flex-col items-center self-start overflow-hidden rounded-2xl border border-(--card-well-stroke) bg-(--card-well)">
          <span className="w-full bg-(--ui-accent) py-0.5 text-center text-[0.625rem] font-semibold tracking-[0.06em] text-white uppercase">
            {new Intl.DateTimeFormat(undefined, { month: 'short' }).format(spec.start)}
          </span>
          <span className="py-1.5 text-[1.375rem] leading-none font-semibold tabular-nums">{spec.start.getDate()}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div aria-level={3} className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em]" role="heading">
            {spec.title}
          </div>
          <span className="text-[0.75rem] text-(--ui-text-secondary)">
            {date} · {when}
          </span>
          {spec.location && (
            <span className="flex items-start gap-1.5 text-[0.75rem] text-(--ui-text-tertiary)">
              <Codicon className="mt-px shrink-0" name="location" size="0.75rem" />
              {spec.location}
            </span>
          )}
          {spec.note && (
            <p className="m-0 mt-1 text-[0.8125rem] leading-relaxed text-(--ui-text-secondary)">{spec.note}</p>
          )}
        </div>
      </div>
      <Actions>
        <Button
          className={CARD_BUTTON_CLASS}
          onClick={() => downloadTextFile(`${spec.title.slice(0, 60)}.ics`, eventCalendar(spec), 'text/calendar')}
          size="sm"
        >
          <Codicon name="calendar" size="0.8125rem" />
          {t.agentCards.addToCalendar}
        </Button>
        {spec.url && (
          <Button
            className={CARD_BUTTON_CLASS}
            onClick={() => openExternalLink(spec.url)}
            size="sm"
            variant="secondary"
          >
            {t.agentCards.view}
          </Button>
        )}
      </Actions>
    </HermesCard>
  )
}

function ProductCard({ spec }: { spec: Spec<'product'> }) {
  const { t } = useI18n()
  const say = useSay()

  const money = (value: number) =>
    new Intl.NumberFormat(undefined, { currency: spec.currency, style: 'currency' }).format(value)

  return (
    <HermesCard className="not-prose my-3 max-w-md" data-card="product">
      {spec.image && (
        <div className="relative mx-3 mt-3 grid h-52 place-items-center overflow-hidden rounded-2xl bg-(--card-well)">
          <Photo alt={spec.name} className="max-h-full max-w-full object-contain p-4" src={spec.image} />
          {spec.badge && (
            <span className="absolute top-3 left-3 rounded-full bg-(--card-surface) px-2.5 py-1 text-[0.6875rem] font-semibold shadow-(--card-shadow)">
              {spec.badge}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5 px-4 pt-3.5">
        {spec.brand && (
          <span className="text-[0.6875rem] font-medium tracking-[0.01em] text-(--ui-text-tertiary)">{spec.brand}</span>
        )}
        <div aria-level={3} className="text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em]" role="heading">
          {spec.name}
        </div>
        <Rating rating={spec.rating} reviews={spec.reviews} />
        {spec.price !== null && (
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[1.375rem] font-semibold tracking-[-0.02em] tabular-nums">{money(spec.price)}</span>
            {spec.was !== null && spec.was > spec.price && (
              <span className="text-[0.8125rem] text-(--ui-text-tertiary) tabular-nums line-through">
                {money(spec.was)}
              </span>
            )}
          </div>
        )}
        <Meta>{[spec.merchant, spec.stock]}</Meta>
        {spec.features.length > 0 && (
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
            {spec.features.map(feature => (
              <li className="flex items-start gap-2 text-[0.8125rem] text-(--ui-text-secondary)" key={feature}>
                <Codicon className="mt-0.5 shrink-0 text-(--ui-green)" name="check" size="0.75rem" />
                {feature}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Actions>
        <Button
          className={CARD_BUTTON_CLASS}
          onClick={() => say(t.agentCards.buyPrompt(spec.name, spec.merchant))}
          size="sm"
        >
          {t.agentCards.buy}
        </Button>
        {spec.url && (
          <Button
            className={CARD_BUTTON_CLASS}
            onClick={() => openExternalLink(spec.url)}
            size="sm"
            variant="secondary"
          >
            {t.agentCards.view}
          </Button>
        )}
      </Actions>
    </HermesCard>
  )
}

function LinkCard({ spec }: { spec: Spec<'link'> }) {
  return (
    <button
      className={cn(
        CARD_SURFACE_CLASS,
        'not-prose my-3 flex w-full max-w-xl cursor-pointer items-stretch overflow-hidden text-left transition-transform duration-150 hover:-translate-y-px'
      )}
      data-card="link"
      onClick={() => openExternalLink(spec.url)}
      type="button"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3.5">
        <span className="flex items-center gap-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">
          <Codicon name="link-external" size="0.6875rem" />
          {spec.site}
        </span>
        <span className="line-clamp-2 text-[0.875rem] leading-snug font-semibold text-(--ui-text-primary)">
          {spec.title}
        </span>
        {spec.description && (
          <span className="line-clamp-2 text-[0.75rem] leading-relaxed text-(--ui-text-secondary)">
            {spec.description}
          </span>
        )}
      </span>
      <Photo className="w-28 shrink-0" src={spec.image} />
    </button>
  )
}

/** A ```card drawn by the app. */
export function AgentCard({ spec }: { spec: CardSpec }) {
  switch (spec.kind) {
    case 'event':
      return <EventCard spec={spec} />

    case 'itinerary':
      return <ItineraryCard spec={spec} />

    case 'link':
      return <LinkCard spec={spec} />

    case 'map':
      return <MapCard spec={spec} />

    case 'place':
      return <PlaceCard spec={spec} />

    case 'product':
      return <ProductCard spec={spec} />

    case 'video':
      return <VideoCard video={spec.video} />

    case 'videos':
      return <VideosCard spec={spec} />
  }
}

/** A card's place while its JSON is still arriving. */
export function AgentCardSkeleton() {
  return (
    <div className={cn(CARD_SURFACE_CLASS, 'my-3 flex max-w-xl flex-col gap-3 p-4')}>
      <div className="h-32 animate-pulse rounded-2xl bg-(--card-well)" />
      <div className="h-3.5 w-48 animate-pulse rounded-full bg-(--card-well-stroke)" />
      <div className="h-3 w-32 animate-pulse rounded-full bg-(--card-well)" />
    </div>
  )
}
