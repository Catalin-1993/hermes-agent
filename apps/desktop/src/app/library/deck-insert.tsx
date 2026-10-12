import { useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import type { NewBlock } from './deck-blocks'
import { LibraryImages, parseCover, UploadCover } from './page-look'

/** What the canvas says in words. Handed to the slide as data: a slide is also drawn for exports, where
 *  there is no app around it to ask. */
export interface SlideUi {
  addBlock: string
  blocks: Record<NewBlock, string>
  moveDown: string
  moveUp: string
  pickImage: string
  removeBlock: string
  typeHere: string
}

const KINDS: { icon: string; id: NewBlock }[] = [
  { icon: 'symbol-text', id: 'heading' },
  { icon: 'whole-word', id: 'paragraph' },
  { icon: 'list-unordered', id: 'bullets' },
  { icon: 'list-ordered', id: 'numbered' },
  { icon: 'quote', id: 'quote' },
  { icon: 'code', id: 'code' },
  { icon: 'file-media', id: 'image' }
]

interface InsertMenuProps {
  children: React.ReactNode
  onOpenChange: (open: boolean) => void
  onPick: (kind: NewBlock) => void
  open: boolean
  ui: SlideUi
}

/** The "+" of a block: what to put on the slide next. Opens from its button, or from "/" in an empty block. */
export function InsertMenu({ children, onOpenChange, onPick, open, ui }: InsertMenuProps) {
  return (
    <DropdownMenu onOpenChange={onOpenChange} open={open}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48" onCloseAutoFocus={event => event.preventDefault()}>
        {KINDS.map(kind => (
          <DropdownMenuItem key={kind.id} onSelect={() => onPick(kind.id)}>
            <Codicon name={kind.icon} size="0.8125rem" />
            {ui.blocks[kind.id]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ImageDialogProps {
  itemId?: string
  onOpenChange: (open: boolean) => void
  onPick: (id: string) => void
  open: boolean
  title: string
}

/** An image for the slide: one already in the Library, or a new one saved beside the presentation. */
export function ImageDialog({ itemId, onOpenChange, onPick, open, title }: ImageDialogProps) {
  const copy = useI18n().t.library.pageLook
  const [tab, setTab] = useState<'library' | 'upload'>('library')

  const choose = (id: string) => {
    onPick(id)
    onOpenChange(false)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 rounded-lg bg-(--ui-row-hover-background) p-0.5" role="tablist">
          {(['library', 'upload'] as const).map(id => (
            <button
              aria-selected={tab === id}
              className={cn(
                'h-7 flex-1 cursor-pointer rounded-md text-xs font-medium transition-colors',
                tab === id
                  ? 'bg-(--ui-bg-elevated) text-(--ui-text-primary) shadow-sm'
                  : 'text-(--ui-text-tertiary) hover:text-(--ui-text-primary)'
              )}
              key={id}
              onClick={() => setTab(id)}
              role="tab"
              type="button"
            >
              {id === 'library' ? copy.fromLibrary : copy.upload}
            </button>
          ))}
        </div>
        <div className="max-h-72 min-h-40 overflow-y-auto">
          {tab === 'library' ? (
            <LibraryImages current="" onPick={choose} />
          ) : (
            <UploadCover
              onPick={cover => {
                const picked = parseCover(cover)

                if (picked?.kind === 'image') {
                  choose(picked.id)
                }
              }}
              pageId={itemId ?? ''}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
