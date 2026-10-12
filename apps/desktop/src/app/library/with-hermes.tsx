import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import type { LibraryItem } from './data'
import { diffLines } from './page-diff'

/** Hermes beside a Library item, and what it leaves behind: the button that opens a chat next to the
 *  item, and — once Hermes has changed the page — a quiet note to review or undo the change. */

const PILL =
  'h-7 gap-1.5 rounded-full px-3 text-xs font-medium text-(--ui-accent) bg-[color-mix(in_srgb,var(--ui-accent)_9%,transparent)] hover:bg-[color-mix(in_srgb,var(--ui-accent)_14%,transparent)] hover:text-(--ui-accent)'

interface HermesButtonProps {
  item: LibraryItem
  /** Private items first need the owner's leave: they are invisible to Hermes. */
  onAllow: () => Promise<void>
  onOpen: () => void
}

/** "Hermes" in an item's header. A private item asks first — allowing moves it to "Ask", where every
 *  read and change still waits for the owner's yes. */
export function HermesButton({ item, onAllow, onOpen }: HermesButtonProps) {
  const copy = useI18n().t.library.withHermes
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  const button = (
    <Button className={PILL} onClick={item.visibility === 'private' ? undefined : onOpen} variant="ghost">
      <Codicon name="sparkle" size="0.8125rem" />
      {copy.open}
    </Button>
  )

  if (item.visibility !== 'private') {
    return <Tip label={copy.openTip}>{button}</Tip>
  }

  return (
    <Popover onOpenChange={setAsking} open={asking}>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4" sideOffset={8}>
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] text-(--ui-accent)">
            <Codicon name="sparkle" size="0.9375rem" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-medium text-(--ui-text-primary)">{copy.allowTitle}</p>
            <p className="text-xs leading-relaxed text-(--ui-text-tertiary)">{copy.allowBody}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setAsking(false)} size="sm" variant="ghost">
            {copy.notNow}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void onAllow()
                .then(() => {
                  setAsking(false)
                  onOpen()
                })
                .finally(() => setBusy(false))
            }}
            size="sm"
          >
            {copy.allow}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export interface AgentEdit {
  after: string
  before: string
}

interface AgentEditNoteProps {
  edit: AgentEdit
  onDismiss: () => void
  onUndo: () => Promise<void>
}

/** A floating note at the top of a page Hermes just changed: what happened, and the two ways back. */
export function AgentEditNote({ edit, onDismiss, onUndo }: AgentEditNoteProps) {
  const copy = useI18n().t.library.withHermes
  const [reviewing, setReviewing] = useState(false)
  const [undoing, setUndoing] = useState(false)

  return (
    <>
      <div className="pointer-events-none sticky top-3 z-20 flex h-0 justify-center" data-slot="library-agent-edit">
        <div className="pointer-events-auto flex h-9 items-center gap-1 rounded-full border border-(--ui-stroke-tertiary) bg-[color-mix(in_srgb,var(--ui-bg-elevated)_92%,transparent)] py-1 pr-1 pl-3.5 text-xs shadow-[0_8px_28px_-12px_rgb(0_0_0/0.28)] backdrop-blur-md animate-in fade-in-0 slide-in-from-top-1">
          <Codicon className="text-(--ui-accent)" name="sparkle" size="0.8125rem" />
          <span className="pr-2 pl-1 font-medium text-(--ui-text-primary)">{copy.edited}</span>
          <Button
            className="h-7 rounded-full px-2.5 text-xs font-normal"
            onClick={() => setReviewing(true)}
            variant="ghost"
          >
            {copy.viewChanges}
          </Button>
          <Button
            className="h-7 rounded-full px-2.5 text-xs font-normal"
            disabled={undoing}
            onClick={() => {
              setUndoing(true)
              void onUndo().finally(() => setUndoing(false))
            }}
            variant="ghost"
          >
            <Codicon name="discard" size="0.75rem" />
            {copy.undo}
          </Button>
          <Tip label={copy.dismiss}>
            <Button
              aria-label={copy.dismiss}
              className="size-7 rounded-full"
              onClick={onDismiss}
              size="icon"
              variant="ghost"
            >
              <Codicon name="close" size="0.75rem" />
            </Button>
          </Tip>
        </div>
      </div>
      <ChangesDialog edit={edit} onOpenChange={setReviewing} open={reviewing} />
    </>
  )
}

function ChangesDialog({
  edit,
  onOpenChange,
  open
}: {
  edit: AgentEdit
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const copy = useI18n().t.library.withHermes
  const lines = useMemo(() => (open ? diffLines(edit.before, edit.after) : []), [edit, open])
  const changed = lines.some(line => line.kind !== 'same')

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Codicon className="text-(--ui-accent)" name="sparkle" size="0.9375rem" />
            {copy.changesTitle}
          </DialogTitle>
        </DialogHeader>
        {changed ? (
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-(--ui-stroke-tertiary) py-1.5 font-mono text-[0.75rem] leading-relaxed">
            {lines.map((line, index) => (
              <div
                className={cn(
                  'flex gap-3 px-3 py-0.5 whitespace-pre-wrap',
                  line.kind === 'added' && 'bg-[color-mix(in_srgb,var(--ui-green)_11%,transparent)]',
                  line.kind === 'removed' &&
                    'bg-[color-mix(in_srgb,var(--ui-red)_9%,transparent)] text-(--ui-text-tertiary) line-through decoration-[color-mix(in_srgb,var(--ui-red)_45%,transparent)]',
                  line.kind === 'same' && 'text-(--ui-text-tertiary)'
                )}
                key={index}
              >
                <span
                  aria-hidden
                  className={cn(
                    'w-3 shrink-0 select-none text-center',
                    line.kind === 'added' && 'text-(--ui-green)',
                    line.kind === 'removed' && 'text-(--ui-red) no-underline'
                  )}
                >
                  {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ''}
                </span>
                <span className="min-w-0 flex-1">{line.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-(--ui-text-tertiary)">{copy.noChanges}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
