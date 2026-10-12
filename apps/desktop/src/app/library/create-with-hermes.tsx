import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

/** The Library bar's lead action: a soft accent pill. */
export function CreateWithHermesButton({ onClick }: { onClick: () => void }) {
  const copy = useI18n().t.library.create

  return (
    <Button
      className="gap-1.5 bg-[color-mix(in_srgb,var(--ui-accent)_9%,transparent)] text-(--ui-accent) hover:bg-[color-mix(in_srgb,var(--ui-accent)_14%,transparent)] hover:text-(--ui-accent)"
      onClick={onClick}
      size="sm"
      variant="ghost"
    >
      <Codicon name="sparkle" size="0.8125rem" />
      {copy.button}
    </Button>
  )
}

export type CreateKind = 'deck' | 'document' | 'interactive' | 'plan' | 'research'

export interface CreateRequest {
  kind: CreateKind
  text: string
}

const KINDS: { icon: string; id: CreateKind }[] = [
  { icon: 'note', id: 'document' },
  { icon: 'checklist', id: 'plan' },
  { icon: 'search', id: 'research' },
  { icon: 'graph-line', id: 'interactive' },
  { icon: 'play-circle', id: 'deck' }
]

interface CreateWithHermesDialogProps {
  onCreate: (request: CreateRequest) => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
}

/** "Describe it, Hermes makes it": what to make, in the owner's words, and what kind of thing it is. */
export function CreateWithHermesDialog({ onCreate, onOpenChange, open }: CreateWithHermesDialogProps) {
  const copy = useI18n().t.library.create
  const [kind, setKind] = useState<CreateKind>('document')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const field = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (open) {
      setText('')
      setKind('document')
    }
  }, [open])

  const ready = text.trim().length > 0 && !busy

  const create = () => {
    if (!ready) {
      return
    }

    setBusy(true)
    void onCreate({ kind, text: text.trim() }).finally(() => setBusy(false))
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-w-xl gap-0 p-0"
        onOpenAutoFocus={event => {
          event.preventDefault()
          field.current?.focus()
        }}
      >
        <DialogHeader className="gap-1.5 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <span className="grid size-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--ui-accent)_11%,transparent)] text-(--ui-accent)">
              <Codicon name="sparkle" size="0.875rem" />
            </span>
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-[0.8125rem] leading-relaxed">{copy.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-6">
          <div aria-label={copy.kindLabel} className="grid grid-cols-5 gap-1.5" role="radiogroup">
            {KINDS.map(entry => (
              <button
                aria-checked={kind === entry.id}
                className={cn(
                  'flex min-w-0 cursor-pointer flex-col items-start gap-1.5 rounded-lg border px-2.5 py-2.5 text-left transition-colors',
                  kind === entry.id
                    ? 'border-[color-mix(in_srgb,var(--ui-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--ui-accent)_7%,transparent)] text-(--ui-text-primary)'
                    : 'border-(--ui-stroke-tertiary) text-(--ui-text-secondary) hover:border-(--ui-stroke-secondary) hover:bg-(--ui-row-hover-background)'
                )}
                key={entry.id}
                onClick={() => setKind(entry.id)}
                role="radio"
                type="button"
              >
                <Codicon
                  className={kind === entry.id ? 'text-(--ui-accent)' : 'text-(--ui-text-tertiary)'}
                  name={entry.icon}
                  size="0.9375rem"
                />
                <span className="max-w-full truncate text-xs font-medium">{copy.kinds[entry.id]}</span>
              </button>
            ))}
          </div>

          <textarea
            className="min-h-32 w-full resize-none rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-editor) px-3.5 py-3 text-sm leading-relaxed text-(--ui-text-primary) outline-none transition-colors placeholder:text-(--ui-text-quaternary) focus:border-[color-mix(in_srgb,var(--ui-accent)_55%,transparent)]"
            onChange={event => setText(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                create()
              }
            }}
            placeholder={copy.placeholders[kind]}
            ref={field}
            value={text}
          />

          <div className="flex flex-wrap gap-1.5">
            {copy.examples[kind].map(example => (
              <button
                className="cursor-pointer rounded-full border border-(--ui-stroke-tertiary) px-2.5 py-1 text-[0.6875rem] text-(--ui-text-secondary) transition-colors hover:border-(--ui-stroke-secondary) hover:text-(--ui-text-primary)"
                key={example}
                onClick={() => {
                  setText(example)
                  field.current?.focus()
                }}
                type="button"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-(--ui-stroke-tertiary) px-6 py-3.5">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">
            <Codicon name="shield" size="0.75rem" />
            <span className="truncate">{copy.consentHint}</span>
          </p>
          <Button onClick={() => onOpenChange(false)} size="sm" variant="ghost">
            {copy.cancel}
          </Button>
          <Button disabled={!ready} onClick={create} size="sm">
            {busy ? <Codicon name="loading" size="0.8125rem" spinning /> : <Codicon name="sparkle" size="0.8125rem" />}
            {copy.create}
            <Kbd className="ml-0.5 opacity-70" size="sm">
              ⌘↵
            </Kbd>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
