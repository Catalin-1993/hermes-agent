import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { SandboxedFrame } from '@/components/ui/sandboxed-frame'
import { useI18n } from '@/i18n'

import type { LibraryItem } from '../data'
import { editableDocument, readEdit } from '../html-edit'
import { useEditSession } from '../use-edit-session'

import { sandboxedHtml } from './data-viewers'
import { PreviewSurface } from './preview-surface'

interface HtmlVisualEditorProps {
  item: LibraryItem
  /** The file as it was when editing began. */
  text: string
  /** Editing is over; the last saved version of the file, if anything was changed. */
  onDone: (saved: LibraryItem | null) => void
}

/** An HTML file edited where it is seen: its own texts become editable in the running page, each change is
 *  written back into the file's markup a moment later (see html-edit.ts). Nobody sees code. */
export function HtmlVisualEditor({ item, onDone, text }: HtmlVisualEditorProps) {
  const { t } = useI18n()
  const frame = useRef<HTMLIFrameElement>(null)
  // The page as it was when editing began: it is not rebuilt while typing, so the frame never reloads.
  const [source] = useState(() => sandboxedHtml(editableDocument(text), { libraries: true }))
  const session = useEditSession(item.id, text)
  const { flush, record, saved, state } = session

  // Only the frame this editor made is believed.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const edit = event.source === frame.current?.contentWindow ? readEdit(event.data) : null

      if (edit) {
        record(edit)
      }
    }

    window.addEventListener('message', onMessage)

    return () => window.removeEventListener('message', onMessage)
  }, [record])

  const finish = async () => {
    await flush()
    onDone(saved())
  }

  return (
    <PreviewSurface
      bodyClassName="bg-white"
      status={state === 'saving' ? t.library.saving : state === 'saved' ? t.library.saved : undefined}
      tools={
        <>
          <Button onClick={() => void finish()} size="xs">
            {t.common.done}
          </Button>
          <span className="mx-1 h-4 w-px bg-(--ui-stroke-tertiary)" />
        </>
      }
    >
      <SandboxedFrame className="absolute inset-0" ref={frame} src={source} title={item.title} />
    </PreviewSurface>
  )
}
