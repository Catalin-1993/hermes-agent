import { type ReactNode, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Loader } from '@/components/ui/loader'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

/** A preview's frame: a quiet toolbar (the viewer's tools, then full screen) over the content. */
export function PreviewSurface({
  bodyClassName,
  children,
  tools,
  status
}: {
  bodyClassName?: string
  children: ReactNode
  /** Leading facts: "12 pages", "1,000 rows". */
  status?: ReactNode
  /** The viewer's own controls, before full screen. */
  tools?: ReactNode
}) {
  const { t } = useI18n()
  const copy = t.library.preview
  const ref = useRef<HTMLDivElement | null>(null)
  const [full, setFull] = useState(false)

  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === ref.current)

    document.addEventListener('fullscreenchange', sync)

    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggle = () => {
    if (full) {
      void document.exitFullscreen()
    } else {
      void ref.current?.requestFullscreen()
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-(--ui-bg-editor)',
        full ? 'rounded-none' : 'rounded-2xl border border-(--ui-stroke-tertiary)'
      )}
      data-slot="library-preview"
      ref={ref}
    >
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-(--ui-stroke-quaternary) px-2.5">
        <span className="min-w-0 truncate px-1 text-[0.6875rem] text-(--ui-text-tertiary)">{status}</span>
        <span className="ml-auto flex items-center gap-0.5">
          {tools}
          <Tip label={full ? copy.exitFullscreen : copy.fullscreen}>
            <Button
              aria-label={full ? copy.exitFullscreen : copy.fullscreen}
              onClick={toggle}
              size="icon-xs"
              variant="ghost"
            >
              <Codicon name={full ? 'screen-normal' : 'screen-full'} size="0.8125rem" />
            </Button>
          </Tip>
        </span>
      </div>
      <div className={cn('relative min-h-0 flex-1 overflow-auto', bodyClassName)}>{children}</div>
    </div>
  )
}

/** A segmented mode switch for the toolbar (Preview / Source). */
export function ModeSwitch<T extends string>({
  modes,
  onChange,
  value
}: {
  modes: readonly { id: T; label: string }[]
  onChange: (mode: T) => void
  value: T
}) {
  return (
    <span className="mr-1 flex items-center rounded-md bg-(--ui-bg-quaternary) p-0.5">
      {modes.map(mode => (
        <button
          className={cn(
            'h-5 cursor-pointer rounded px-2 text-[0.6875rem] text-(--ui-text-tertiary) transition-colors hover:text-(--ui-text-primary)',
            value === mode.id && 'bg-(--ui-bg-editor) text-(--ui-text-primary) shadow-sm'
          )}
          key={mode.id}
          onClick={() => onChange(mode.id)}
          type="button"
        >
          {mode.label}
        </button>
      ))}
    </span>
  )
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="grid size-full min-h-64 place-items-center p-8">{children}</div>
}

/** Bytes on their way: the loader, and once a big file shows progress, how far it has come. */
export function Loading({ progress }: { progress?: number }) {
  const { t } = useI18n()
  const percent = progress === undefined ? null : Math.round(progress * 100)

  return (
    <Centered>
      <div className="flex w-48 flex-col items-center gap-3">
        <Loader />
        {percent !== null && percent < 100 && (
          <>
            <div className="h-1 w-full overflow-hidden rounded-full bg-(--ui-bg-quaternary)">
              <div
                className="h-full rounded-full bg-(--ui-text-tertiary) transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)">
              {t.library.preview.loadingPercent(percent)}
            </span>
          </>
        )}
      </div>
    </Centered>
  )
}

/** A viewer that could not get its file: said plainly, with a way to try again. */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n()

  return (
    <Centered>
      <div className="flex flex-col items-center gap-3 text-center">
        <Codicon className="text-(--ui-text-tertiary)" name="warning" size="1.5rem" />
        <p className="m-0 text-sm text-(--ui-text-secondary)">{t.library.preview.openFailed}</p>
        <Button onClick={onRetry} size="sm" variant="secondary">
          <Codicon name="refresh" size="0.8125rem" />
          {t.library.preview.tryAgain}
        </Button>
      </div>
    </Centered>
  )
}
