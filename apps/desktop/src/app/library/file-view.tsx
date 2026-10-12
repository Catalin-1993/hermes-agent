import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'

import { askHermesBesideAbout } from './chat-bridge'
import { parseDelimited } from './csv'
import { type LibraryItem, type LibraryPreview, previewLibraryItem, readLibraryBlob } from './data'
import { extensionOf, fileCategoryOf } from './file-types'
import {
  ArchiveViewer,
  FileMenu,
  HtmlDocumentViewer,
  NoPreview,
  SheetViewer,
  TextViewer
} from './previews/data-viewers'
import { EmailViewer, FontViewer, NotebookViewer } from './previews/format-viewers'
import { IMAGE_EDIT_MIME, ImageEditor } from './previews/image-editor'
import { ImageViewer } from './previews/image-viewer'
import { AudioViewer, DocxViewer, PdfViewer, useLibraryFile, VideoViewer } from './previews/media-viewers'
import { LoadFailed, Loading, PreviewSurface } from './previews/preview-surface'
import { TableEditor } from './previews/table-editor'

// CSV past this opens as its grid only; the editor needs the whole text in the window.
const CSV_EDIT_MAX_BYTES = 2 * 1024 * 1024

function LibraryImage({
  item,
  onSaved,
  rendition
}: {
  item: LibraryItem
  onSaved?: (item: LibraryItem) => void
  rendition?: boolean
}) {
  const file = useLibraryFile(item, { rendition })
  const [editing, setEditing] = useState(false)
  // Only formats an editor can write back; a HEIC or an office rendition is looked at, not edited.
  const editable = !rendition && extensionOf(item.file_name) in IMAGE_EDIT_MIME

  if (file.url && editing) {
    return (
      <ImageEditor
        item={item}
        onClose={saved => {
          setEditing(false)

          if (saved) {
            onSaved?.(saved)
          }
        }}
        src={file.url}
      />
    )
  }

  if (file.url) {
    return <ImageViewer alt={item.title} onEdit={editable ? () => setEditing(true) : undefined} src={file.url} />
  }

  return (
    <PreviewSurface>
      {file.error ? <LoadFailed onRetry={file.retry} /> : <Loading progress={file.progress} />}
    </PreviewSurface>
  )
}

/** A table's own tools: Hermes beside it to analyze it, and the file's ⋯ menu. */
function TableActions({
  item,
  onEditText,
  onRestored
}: {
  item: LibraryItem
  onEditText?: () => void
  onRestored?: (item: LibraryItem) => void
}) {
  const { t } = useI18n()

  return (
    <>
      <Button
        className="mr-0.5 h-7 gap-1.5 rounded-full px-2.5 text-xs font-medium text-(--ui-accent) hover:bg-[color-mix(in_srgb,var(--ui-accent)_10%,transparent)] hover:text-(--ui-accent)"
        onClick={() =>
          void askHermesBesideAbout(item, t.library.table.analyzePrompt(item.title || item.file_name || ''))
        }
        variant="ghost"
      >
        <Codicon name="sparkle" size="0.75rem" />
        {t.library.table.analyze}
      </Button>
      <FileMenu
        editable={Boolean(onEditText)}
        item={item}
        onEdit={() => onEditText?.()}
        onRestored={restored => onRestored?.(restored)}
      />
    </>
  )
}

/** CSV / TSV: a sheet to work in (table-editor.tsx), with its text a menu away. */
function CsvViewer({
  item,
  onSaved,
  preview
}: {
  item: LibraryItem
  onSaved?: (item: LibraryItem) => void
  preview: LibraryPreview
}) {
  const ext = extensionOf(item.file_name)
  const [text, setText] = useState<null | string>(null)
  const [asText, setAsText] = useState(false)
  // Bumped when an earlier version comes back: the sheet starts again from the file.
  const [round, setRound] = useState(0)

  // Read once per item and per return from the text editor: the sheet keeps its own state while it
  // saves, so its own writes never reload it under the caret.
  useEffect(() => {
    let live = true

    readLibraryBlob(item.id)
      .then(blob => blob.text())
      .then(
        next => live && setText(next),
        () => live && setText(null)
      )

    return () => {
      live = false
    }
  }, [item.id, asText, round])

  if (text === null) {
    return <SheetViewer item={item} preview={preview} />
  }

  if (asText) {
    return (
      <TextViewer
        initialEditing
        item={item}
        onExitEdit={() => setAsText(false)}
        onSaved={onSaved}
        preview={{ ...preview, text, truncated: false }}
      />
    )
  }

  return (
    <TableEditor
      actions={
        <TableActions
          item={item}
          onEditText={() => setAsText(true)}
          onRestored={restored => {
            onSaved?.(restored)
            setRound(n => n + 1)
          }}
        />
      }
      initial={parseDelimited(text, ext === 'tsv' ? '\t' : undefined)}
      item={item}
      key={`${item.id}:${round}:${asText}:${text.length}`}
      onSaved={onSaved}
    />
  )
}

/**
 * A saved file, shown in the Library itself — never "download to view". Images, PDFs, media and
 * Word documents render here directly, read in slices so any size opens; sheets, text, archives and
 * office renditions come from the backend's preview (`library.preview`); anything else is a card
 * with a way out.
 */
export function LibraryFileView({
  item,
  onOpenFolder,
  onSaved
}: {
  item: LibraryItem
  /** Where an extracted archive's folder opens; omitted (Quick Look) it stays put. */
  onOpenFolder?: (folderId: string) => void
  onSaved?: (item: LibraryItem) => void
}) {
  const { t } = useI18n()
  const copy = t.library.preview
  const category = fileCategoryOf(item)
  const ext = extensionOf(item.file_name)
  const [preview, setPreview] = useState<LibraryPreview | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const checkAgain = () => setAttempt(n => n + 1)

  // Another item starts blank; the same item saved again keeps showing (an editor stays mounted, its
  // selection and caret with it) until the fresh preview arrives.
  useEffect(() => {
    setPreview(null)
    setFailed(false)
  }, [item.id])

  useEffect(() => {
    let live = true

    previewLibraryItem(item.id).then(
      next => live && setPreview(next),
      () => live && setFailed(true)
    )

    return () => {
      live = false
    }
  }, [attempt, item.id, item.updated_at])

  if (!item.path || failed) {
    return <NoPreview item={item} />
  }

  if (!preview) {
    return (
      <PreviewSurface>
        <Loading />
      </PreviewSurface>
    )
  }

  const pages = typeof item.meta?.pages === 'number' ? copy.pages(item.meta.pages) : undefined

  if (preview.type === 'image') {
    return <LibraryImage item={item} rendition />
  }

  if (preview.type === 'pdf') {
    return <PdfViewer item={item} rendition />
  }

  if (preview.type === 'video' && preview.path) {
    return <VideoViewer item={item} path={preview.path} />
  }

  if (preview.type === 'email') {
    return <EmailViewer preview={preview} />
  }

  if (preview.type === 'notebook') {
    return <NotebookViewer preview={preview} />
  }

  if (preview.type === 'html' && preview.html) {
    return <HtmlDocumentViewer html={preview.html} title={item.title} />
  }

  if (preview.type === 'native') {
    if (category === 'image') {
      return <LibraryImage item={item} onSaved={onSaved} />
    }

    if (category === 'pdf') {
      return <PdfViewer item={item} status={pages} />
    }

    if (category === 'video') {
      return <VideoViewer item={item} />
    }

    if (category === 'audio') {
      return <AudioViewer item={item} />
    }

    if (ext === 'docx') {
      return <DocxViewer item={item} />
    }

    if (category === 'font') {
      return <FontViewer item={item} />
    }
  }

  if (preview.type === 'sheet') {
    return (ext === 'csv' || ext === 'tsv') && (item.size ?? 0) <= CSV_EDIT_MAX_BYTES ? (
      <CsvViewer item={item} onSaved={onSaved} preview={preview} />
    ) : (
      <SheetViewer actions={<TableActions item={item} onRestored={onSaved} />} item={item} preview={preview} />
    )
  }

  if (preview.type === 'archive') {
    return (
      <ArchiveViewer item={item} onExtracted={onOpenFolder && (folder => onOpenFolder(folder.id))} preview={preview} />
    )
  }

  if (preview.type === 'text') {
    return (
      <TextViewer
        item={item}
        key={`${item.id}:${item.updated_at}`}
        onCheckAgain={checkAgain}
        onSaved={onSaved}
        preview={preview}
      />
    )
  }

  return (
    <NoPreview
      converter={preview.converter}
      converterMissing={preview.converter_missing}
      item={item}
      onCheckAgain={checkAgain}
    />
  )
}
