/** The views that read public coin data: Derivatives (Binance futures), News and Community (Fear & Greed,
 *  who is long and who is short, and the owner's own notes). Coins only; a stock says so. */

import { cn, useQuery } from '@hermes/plugin-sdk'
import type { ReactNode } from 'react'

import { fetchDerivatives, fetchFearGreed, fetchNews } from './analysis-data'
import { Message, ViewShell } from './analysis-views'
import type { WatchKind } from './api'
import { COPY } from './copy'
import { quotePrice } from './format'
import { AreaLine, Gauge, SignedBars } from './mini-charts'
import { useChartDoc } from './use-chart-doc'

const clock = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' })
const when = (seconds: number) => clock.format(new Date(seconds * 1000))
const compact = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2, notation: 'compact' })
const percent = (value: number, digits = 4) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`

function Card({ children, hint, title, value }: { children?: ReactNode; hint?: string; title: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-(--card-well) px-4 py-3.5">
      <span className="text-[0.78125rem] text-(--ui-text-tertiary)">{title}</span>
      <span className="text-[1.375rem] font-medium tabular-nums text-(--ui-text-primary)">{value}</span>
      {hint && <span className="text-[0.75rem] text-(--ui-text-tertiary)">{hint}</span>}
      {children}
    </div>
  )
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-(--card-well-stroke) px-4 py-3.5">
      <span className="text-[0.84375rem] font-medium text-(--ui-text-secondary)">{title}</span>
      {children}
    </div>
  )
}

const stocksOnly = (view: 'derivatives' | 'news' | 'community', note: string) => (
  <ViewShell title={COPY.analysis[view].title} view={view}>
    <Message>{note}</Message>
  </ViewShell>
)

export function DerivativesView({ kind, symbol }: { kind: WatchKind; symbol: string }) {
  const copy = COPY.analysis.derivatives

  const { data, error, isLoading } = useQuery({
    enabled: kind === 'crypto',
    queryFn: ({ signal }) => fetchDerivatives(symbol, signal),
    queryKey: ['portfolio', 'derivatives', symbol],
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 30_000
  })

  if (kind !== 'crypto') {
    return stocksOnly('derivatives', COPY.analysis.cryptoOnly)
  }

  const lastRatio = data?.longShort[data.longShort.length - 1]
  const lastInterest = data?.openInterest[data.openInterest.length - 1]

  return (
    <ViewShell note={copy.note} title={copy.title} view="derivatives">
      {isLoading ? (
        <Message>{COPY.analysis.loading}</Message>
      ) : error || !data ? (
        <Message>{copy.none(symbol)}</Message>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
            <Card
              hint={`${copy.fundingHint(percent(data.fundingRate))} · ${copy.fundingNext(when(data.nextFundingTime))}`}
              title={copy.funding}
              value={`${percent(data.fundingRate)}%`}
            />
            <Card title={copy.interest} value={lastInterest ? `${compact.format(lastInterest.value)} USDT` : '—'} />
            <Card
              hint={lastRatio ? copy.longShortHint(lastRatio.long.toFixed(1), lastRatio.short.toFixed(1)) : undefined}
              title={copy.longShort}
              value={lastRatio ? lastRatio.ratio.toFixed(2) : '—'}
            />
            <Card
              hint={copy.basisHint(quotePrice(data.markPrice), quotePrice(data.indexPrice))}
              title={copy.basis}
              value={`${percent(data.basisPct, 3)}%`}
            />
          </div>
          <p className={cn('m-0 text-[0.8125rem]', data.fundingRate >= 0 ? 'text-(--ui-green)' : 'text-(--ui-red)')}>
            {data.fundingRate >= 0 ? copy.positive : copy.negative}
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
            <Panel title={copy.fundingHistory}>
              <SignedBars label={copy.fundingHistory} values={data.funding.map(point => point.value)} />
            </Panel>
            <Panel title={copy.interestHistory}>
              <AreaLine
                color="var(--ui-accent, #60a5fa)"
                label={copy.interestHistory}
                values={data.openInterest.map(point => point.value)}
              />
            </Panel>
            <Panel title={copy.longShortHistory}>
              <AreaLine
                color="var(--ui-yellow, #fbbf24)"
                label={copy.longShortHistory}
                values={data.longShort.map(point => point.ratio)}
              />
            </Panel>
          </div>
        </>
      )}
    </ViewShell>
  )
}

export function NewsView({ kind, symbol }: { kind: WatchKind; symbol: string }) {
  const copy = COPY.analysis.news

  const { data, error, isLoading } = useQuery({
    enabled: kind === 'crypto',
    queryFn: ({ signal }) => fetchNews(symbol, signal),
    queryKey: ['portfolio', 'news', symbol],
    retry: 1,
    staleTime: 300_000
  })

  if (kind !== 'crypto') {
    return stocksOnly('news', copy.stocks)
  }

  return (
    <ViewShell note={copy.note} title={copy.title} view="news">
      {isLoading ? (
        <Message>{COPY.analysis.loading}</Message>
      ) : error ? (
        <Message>{COPY.analysis.failed}</Message>
      ) : !data?.length ? (
        <Message>{copy.none}</Message>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {data.map(article => (
            <li className="border-t border-(--card-well-stroke) first:border-t-0" key={article.id}>
              <a
                className="flex flex-col gap-1 rounded-lg px-2 py-3 text-inherit no-underline hover:bg-(--card-well)"
                href={article.url}
                rel="noreferrer"
                target="_blank"
              >
                <span className="text-[0.9375rem] font-medium text-(--ui-text-primary)">{article.title}</span>
                {article.body && (
                  <span className="line-clamp-2 text-[0.8125rem] text-(--ui-text-secondary)">{article.body}</span>
                )}
                <span className="text-[0.75rem] text-(--ui-text-tertiary)">
                  {article.source} · {when(article.time)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </ViewShell>
  )
}

export function CommunityView({ kind, symbol }: { kind: WatchKind; symbol: string }) {
  const copy = COPY.analysis.community
  const { doc } = useChartDoc(kind, symbol)

  const fear = useQuery({
    enabled: kind === 'crypto',
    queryFn: ({ signal }) => fetchFearGreed(signal),
    queryKey: ['portfolio', 'fear-greed'],
    retry: 1,
    staleTime: 600_000
  })

  const crowd = useQuery({
    enabled: kind === 'crypto',
    queryFn: ({ signal }) => fetchDerivatives(symbol, signal),
    queryKey: ['portfolio', 'derivatives', symbol],
    retry: 1,
    staleTime: 30_000
  })

  const ratio = crowd.data?.longShort[crowd.data.longShort.length - 1]

  return (
    <ViewShell note={copy.note} title={copy.title} view="community">
      {kind === 'crypto' ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
          <Panel title={copy.fear}>
            {fear.data ? (
              <>
                <Gauge className="mx-auto max-w-56" score={(fear.data.value - 50) / 50} title={copy.fear} />
                <span className="text-center text-[0.9375rem] font-medium text-(--ui-text-primary)">
                  {copy.fearHint(fear.data.value, fear.data.label)}
                </span>
                <span className="pt-1 text-[0.71875rem] text-(--ui-text-tertiary)">{copy.fearHistory}</span>
                <AreaLine
                  color="var(--ui-accent, #60a5fa)"
                  height={70}
                  label={copy.fearHistory}
                  values={[...fear.data.history].reverse().map(point => point.value)}
                />
              </>
            ) : (
              <Message>{fear.isLoading ? COPY.analysis.loading : COPY.analysis.failed}</Message>
            )}
          </Panel>
          <Panel title={copy.crowd}>
            {ratio ? (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-(--card-well)">
                  <span className="bg-(--ui-green)" style={{ width: `${ratio.long}%` }} />
                  <span className="bg-(--ui-red)" style={{ width: `${ratio.short}%` }} />
                </div>
                <span className="text-[0.84375rem] text-(--ui-text-secondary)">
                  {copy.crowdHint(ratio.long.toFixed(1), ratio.short.toFixed(1))}
                </span>
                <AreaLine
                  color="var(--ui-yellow, #fbbf24)"
                  height={70}
                  label={copy.crowd}
                  values={(crowd.data?.longShort ?? []).map(point => point.ratio)}
                />
              </>
            ) : (
              <Message>{crowd.isLoading ? COPY.analysis.loading : COPY.analysis.derivatives.none(symbol)}</Message>
            )}
          </Panel>
        </div>
      ) : (
        <p className="m-0 text-[0.8125rem] text-(--ui-text-tertiary)">{copy.stocks}</p>
      )}
      <Panel title={copy.notes}>
        {doc.notes.length ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {doc.notes.map(note => (
              <li className="text-[0.84375rem] text-(--ui-text-primary)" key={note.id}>
                {note.text}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[0.8125rem] text-(--ui-text-tertiary)">{copy.noNotes}</span>
        )}
      </Panel>
    </ViewShell>
  )
}
