import { type ReactNode, useState } from 'react'

import { cn } from '@/lib/utils'

/** A card's picture; when it will not load, it is simply not there. */
export function Photo({ alt = '', className, src }: { alt?: string; className?: string; src: string }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return null
  }

  return (
    <img
      alt={alt}
      className={cn('block object-cover', className)}
      loading="lazy"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={src}
    />
  )
}

/** The small line of facts under a title, dot-separated, skipping what is empty. */
export function Meta({ children }: { children: ReactNode[] }) {
  const parts = children.filter(Boolean)

  return parts.length ? (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.75rem] text-(--ui-text-tertiary)">
      {parts.map((part, index) => (
        <span className="inline-flex items-center gap-1.5" key={index}>
          {index > 0 && <span aria-hidden>·</span>}
          {part}
        </span>
      ))}
    </span>
  ) : null
}

/** A card's row of buttons. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3.5 pb-4">{children}</div>
}
