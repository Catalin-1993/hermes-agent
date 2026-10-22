/**
 * An asset's own logo, in a box of fixed size so nothing moves when it arrives. Coins come from
 * `@web3icons/core`, bundled with the app (loaded one by one, only the ones on screen — no request
 * leaves the machine); stocks and ETFs from Financial Modeling Prep's public logo images. A coin or
 * stock with no logo, or one that fails to load, gets a calm monogram instead.
 */

import { cn } from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'

import type { WatchKind } from './api'

const COIN_SVGS = import.meta.glob<string>(
  '../../../../../node_modules/@web3icons/core/dist/svgs/tokens/branded/*.svg.js',
  { import: 'default' }
)

const COIN_LOADERS = new Map(
  Object.entries(COIN_SVGS).map(([path, load]) => [path.slice(path.lastIndexOf('/') + 1, -'.svg.js'.length), load])
)

const resolved = new Map<string, null | string>()

async function coinIcon(symbol: string): Promise<null | string> {
  if (resolved.has(symbol)) {
    return resolved.get(symbol) ?? null
  }

  const load = COIN_LOADERS.get(symbol.toUpperCase())
  const svg = load ? await load().catch(() => null) : null
  const url = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null
  resolved.set(symbol, url)

  return url
}

const stockLogo = (symbol: string) => `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`

function Monogram({ size, symbol }: { size: number; symbol: string }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-(--card-well) font-semibold text-(--ui-text-secondary)"
      style={{ fontSize: size * 0.42, height: size, width: size }}
    >
      {symbol
        .replace(/[^A-Z0-9]/gi, '')
        .slice(0, 2)
        .toUpperCase()}
    </span>
  )
}

export function AssetIcon({
  className,
  kind,
  size = 24,
  symbol
}: {
  className?: string
  kind: WatchKind
  size?: number
  symbol: string
}) {
  const [src, setSrc] = useState<null | string>(kind === 'stocks' ? stockLogo(symbol) : (resolved.get(symbol) ?? null))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (kind !== 'crypto') {
      return
    }

    let live = true
    void coinIcon(symbol).then(url => live && setSrc(url))

    return () => {
      live = false
    }
  }, [kind, symbol])

  return (
    <span className={cn('inline-grid shrink-0', className)} style={{ height: size, width: size }}>
      {src && !failed ? (
        <img
          alt=""
          className="col-start-1 row-start-1 rounded-full object-contain"
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          src={src}
          width={size}
        />
      ) : (
        <Monogram size={size} symbol={symbol} />
      )}
    </span>
  )
}
