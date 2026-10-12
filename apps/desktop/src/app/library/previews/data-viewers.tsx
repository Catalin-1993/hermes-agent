import { lazy, type ReactNode, Suspense, useState } from 'react'

import { MarkdownPreview, SourceView } from '@/app/chat/right-rail/preview-file'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Loader } from '@/components/ui/loader'
import { SandboxedFrame } from '@/components/ui/sandboxed-frame'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { isDesktopFsRemoteMode } from '@/lib/desktop-fs'
import { openExternalLink } from '@/lib/external-link'
import { type FramePolicy, sealedHtml } from '@/lib/frame-policy'
import { shikiLanguageForFilename } from '@/lib/markdown-code'
import { cn } from '@/lib/utils'
import { downloadRemoteFile, revealFile } from '@/store/file-actions'
import { notify, notifyError } from '@/store/notifications'

import { askHermesAbout } from '../chat-bridge'
import { serializeDelimited } from '../csv'
import {
  bumpLibraryRevision,
  extractLibraryArchive,
  formatBytes,
  importLibraryFile,
  type LibraryItem,
  type LibraryPreview,
  writeLibraryText
} from '../data'
import { extensionOf, fileCategoryOf, ITEM_TYPE_ICON, ITEM_TYPE_TINT } from '../file-types'
import { $organizeDialog } from '../organize'
import { columnName } from '../table-view'

import { HtmlVisualEditor } from './html-visual-editor'
import { Centered, ModeSwitch, PreviewSurface } from './preview-surface'

// CodeMirror is its own chunk: reading a file never pays for the editor.
const CodeEditor = lazy(async () => ({ default: (await import('@/components/chat/code-editor')).CodeEditor }))

/** Rows as a grid: column letters and row numbers stay put while it scrolls. */
function SheetTable({ rows }: { rows: readonly (readonly string[])[] }) {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)

  return (
    <table className="border-separate border-spacing-0 text-xs text-(--ui-text-primary)">
      <thead>
        <tr>
          <th className="sticky left-0 top-0 z-20 w-10 border-b border-r border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary)" />
          {Array.from({ length: width }, (_, col) => (
            <th
              className="sticky top-0 z-10 min-w-24 border-b border-r border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) px-3 py-1.5 text-center text-[0.6875rem] font-medium text-(--ui-text-tertiary)"
              key={col}
            >
              {columnName(col)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr className="hover:bg-(--ui-row-hover-background)" key={index}>
            <td className="sticky left-0 z-10 border-b border-r border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) px-2 py-1.5 text-right text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)">
              {index + 1}
            </td>
            {Array.from({ length: width }, (_, col) => (
              <td
                className={cn(
                  'max-w-80 truncate border-b border-r border-(--ui-stroke-quaternary) px-3 py-1.5',
                  /^-?[\d.,]+%?$/.test(row[col] ?? '') && 'text-right tabular-nums'
                )}
                key={col}
                title={row[col]}
              >
                {row[col]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Workbooks as a grid, one sheet at a time — and, when the whole sheet is here, a copy of it as a CSV
 *  to work in (the workbook itself stays as it is). */
export function SheetViewer({
  actions,
  item,
  preview
}: {
  actions?: ReactNode
  item: LibraryItem
  preview: LibraryPreview
}) {
  const { t } = useI18n()
  const copy = t.library.preview
  const sheets = preview.sheets ?? []
  const [active, setActive] = useState(0)
  const sheet = sheets[Math.min(active, sheets.length - 1)]
  const rows = sheet?.rows ?? []
  const [copying, setCopying] = useState(false)
  const copyable = extensionOf(item.file_name) === 'xlsx' && !preview.truncated && rows.length > 0

  const editCopy = async () => {
    setCopying(true)

    try {
      const name =
        sheets.length > 1 ? `${item.title || 'Sheet'} – ${sheet?.name}` : item.title || sheet?.name || 'Sheet'

      const file = new File([serializeDelimited({ delimiter: ',', rows: rows.map(row => [...row]) })], `${name}.csv`, {
        type: 'text/csv'
      })

      const made = await importLibraryFile(file, item.parent_id ?? undefined)

      bumpLibraryRevision()
      notify({
        action: {
          label: t.library.chat.open,
          onClick: () => {
            window.location.hash = `#/artifacts?item=${made.id}`
          }
        },
        durationMs: 6000,
        kind: 'info',
        message: t.library.table.copyMade
      })
    } catch (error) {
      notifyError(error, t.library.errors.save)
    } finally {
      setCopying(false)
    }
  }

  return (
    <PreviewSurface
      status={
        <>
          {copy.rows(rows.length)}
          {preview.truncated && ` · ${copy.truncated}`}
        </>
      }
      tools={
        <>
          {sheets.length > 1 && (
            <ModeSwitch
              modes={sheets.map((s, index) => ({ id: String(index), label: s.name }))}
              onChange={id => setActive(Number(id))}
              value={String(active)}
            />
          )}
          {copyable && (
            <Button
              className="h-7 gap-1.5 px-2.5 text-xs"
              disabled={copying}
              onClick={() => void editCopy()}
              variant="ghost"
            >
              <Codicon name="edit" size="0.75rem" />
              {t.library.table.editCopy}
            </Button>
          )}
          {actions}
        </>
      }
    >
      <SheetTable rows={rows} />
    </PreviewSurface>
  )
}

/** An archive's entries as a quiet tree, and Extract: unpacked into a folder beside it. */
export function ArchiveViewer({
  item,
  onExtracted,
  preview
}: {
  item: LibraryItem
  onExtracted?: (folder: LibraryItem) => void
  preview: LibraryPreview
}) {
  const { t } = useI18n()
  const copy = t.library.preview
  const entries = preview.entries ?? []
  const [busy, setBusy] = useState(false)

  const extract = async () => {
    setBusy(true)

    try {
      const { folder } = await extractLibraryArchive(item.id)

      bumpLibraryRevision()
      notify({ durationMs: 3000, kind: 'info', message: copy.extracted(folder.title) })
      onExtracted?.(folder)
    } catch (error) {
      notifyError(error, t.library.errors.save)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PreviewSurface
      status={t.library.preview.entries(entries.length)}
      tools={
        entries.length > 0 && (
          <Button disabled={busy} onClick={() => void extract()} size="xs" variant="secondary">
            <Codicon name="folder-opened" size="0.75rem" />
            {copy.extract}
          </Button>
        )
      }
    >
      <ul className="m-0 list-none p-2">
        {entries.map(entry => {
          const depth = entry.name.replace(/\/$/, '').split('/').length - 1
          const name = entry.name.replace(/\/$/, '').split('/').pop() || entry.name
          const type = entry.dir ? 'folder' : fileCategoryOf({ file_name: name, mime: null })

          return (
            <li
              className="flex h-7 items-center gap-2 rounded-md pr-2 text-xs text-(--ui-text-secondary) hover:bg-(--ui-row-hover-background)"
              key={entry.name}
              style={{ paddingLeft: `${0.5 + depth * 1.125}rem` }}
            >
              <Codicon name={ITEM_TYPE_ICON[type]} size="0.8125rem" style={{ color: ITEM_TYPE_TINT[type] }} />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              {!entry.dir && <span className="tabular-nums text-(--ui-text-tertiary)">{formatBytes(entry.size)}</span>}
            </li>
          )
        })}
      </ul>
    </PreviewSurface>
  )
}

// Page content cannot reach the network, the app, or its storage: the sealed frame of `@/lib/frame-policy`.
// An HTML file opened in the Library may load code from the public CDNs it names; a mail or an
// office document may not load anything.
export const sandboxedHtml = (html: string, policy: FramePolicy = {}): string =>
  `data:text/html;charset=utf-8,${encodeURIComponent(sealedHtml(html, policy))}`

/** An office document as macOS Quick Look lays it out — self-contained HTML, in the same sealed frame. */
export function HtmlDocumentViewer({ html, title }: { html: string; title: string }) {
  return (
    <PreviewSurface bodyClassName="bg-white">
      <SandboxedFrame className="absolute inset-0" src={sandboxedHtml(html)} title={title} />
    </PreviewSurface>
  )
}

const CONVERTERS = {
  ffmpeg: 'https://ffmpeg.org/download.html',
  libreoffice: 'https://www.libreoffice.org/download/download-libreoffice/'
} as const

type Converter = keyof typeof CONVERTERS

/** For a file only an outside tool can show (LibreOffice, ffmpeg): get it, then look again — no
 *  restart needed. */
function ConverterActions({ converter, onCheckAgain }: { converter: Converter; onCheckAgain: () => void }) {
  const { t } = useI18n()
  const copy = t.library.preview

  return (
    <>
      <Button onClick={() => openExternalLink(CONVERTERS[converter])} size="xs" variant="secondary">
        <Codicon name="cloud-download" size="0.75rem" />
        {converter === 'ffmpeg' ? copy.downloadFfmpeg : copy.downloadLibreOffice}
      </Button>
      <Button onClick={onCheckAgain} size="xs" variant="ghost">
        {copy.checkAgain}
      </Button>
    </>
  )
}

/** What can be done with an opened file, kept to one small menu beside Full screen: edit it, have Hermes
 *  change it, go back to an earlier version. */
export function FileMenu({
  editable,
  item,
  onEdit,
  onEditVisually,
  onRestored
}: {
  editable: boolean
  item: LibraryItem
  /** The code editor. */
  onEdit: () => void
  /** Given for an HTML file: editing it as it is seen. */
  onEditVisually?: () => void
  onRestored: (item: LibraryItem) => void
}) {
  const { t } = useI18n()

  return (
    <DropdownMenu>
      <Tip label={t.library.actions.more}>
        <DropdownMenuTrigger asChild>
          <Button aria-label={t.library.actions.more} size="icon-xs" variant="ghost">
            <Codicon name="kebab-vertical" size="0.8125rem" />
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="end" className="min-w-44">
        {onEditVisually && (
          <DropdownMenuItem onSelect={onEditVisually}>
            <Codicon name="edit" size="0.8125rem" />
            {t.library.preview.edit}
          </DropdownMenuItem>
        )}
        {editable && (
          <DropdownMenuItem onSelect={onEdit}>
            <Codicon name={onEditVisually ? 'code' : 'edit'} size="0.8125rem" />
            {onEditVisually ? t.library.preview.editCode : t.library.preview.edit}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => askHermesAbout(item)}>
          <Codicon name="sparkle" size="0.8125rem" />
          {t.library.chat.askHermes}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => $organizeDialog.set({ item, kind: 'versions', onRestored })}>
          <Codicon name="history" size="0.8125rem" />
          {t.library.organize.versionHistory}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Text, code, Markdown and HTML: rendered where that means something, highlighted source, and an
 *  editor that saves back into the Library (⌘S). */
export function TextViewer({
  initialEditing = false,
  item,
  onCheckAgain,
  onExitEdit,
  onSaved,
  preview,
  table
}: {
  /** Open straight in the code editor (a table's "Edit as text"). */
  initialEditing?: boolean
  item: LibraryItem
  /** Shown with the converter notice: look for LibreOffice again. */
  onCheckAgain?: () => void
  /** The editor was closed — saved or discarded. */
  onExitEdit?: () => void
  onSaved?: (item: LibraryItem) => void
  preview: LibraryPreview
  /** CSV / TSV: the rows, shown as the rendered view. */
  table?: readonly (readonly string[])[]
}) {
  const { t } = useI18n()
  const copy = t.library.preview
  const ext = extensionOf(item.file_name)
  const rendered = Boolean(table) || ext === 'md' || ext === 'markdown' || ext === 'html' || ext === 'htm'
  const notice = preview.converter_missing ? copy.converterMissing : undefined
  const editable = !preview.truncated && !preview.converter_missing
  const [text, setText] = useState(preview.text ?? '')
  const [editing, setEditing] = useState(initialEditing)
  // An HTML file can also be edited as it is seen (html-visual-editor.tsx), without its code.
  const [visual, setVisual] = useState(false)
  const isHtml = ext === 'html' || ext === 'htm'
  // A file is seen as what it is — the page, the document, the table — or, plain, as its text.
  const mode = editing ? 'edit' : rendered ? 'preview' : 'source'
  const [draft, setDraft] = useState<null | string>(null)
  const [saving, setSaving] = useState(false)
  const dirty = draft !== null && draft !== text

  const save = async () => {
    if (draft === null || !dirty) {
      return
    }

    setSaving(true)

    try {
      const saved = await writeLibraryText(item.id, draft)

      setText(draft)
      setDraft(null)
      setEditing(false)
      bumpLibraryRevision()
      onSaved?.(saved)
      onExitEdit?.()
    } catch (error) {
      notifyError(error, t.library.errors.save)
    } finally {
      setSaving(false)
    }
  }

  if (visual) {
    return (
      <HtmlVisualEditor
        item={item}
        onDone={saved => {
          setVisual(false)

          if (saved) {
            onSaved?.(saved)
          }
        }}
        text={text}
      />
    )
  }

  const tools =
    mode === 'edit' ? (
      <>
        {dirty && <span className="mr-2 text-[0.6875rem] text-(--ui-text-tertiary)">{copy.unsaved}</span>}
        <Button
          onClick={() => {
            setDraft(null)
            setEditing(false)
            onExitEdit?.()
          }}
          size="xs"
          variant="ghost"
        >
          {copy.discard}
        </Button>
        <Button disabled={!dirty || saving} onClick={() => void save()} size="xs">
          {saving ? copy.saving : copy.save}
        </Button>
        <span className="mx-1 h-4 w-px bg-(--ui-stroke-tertiary)" />
      </>
    ) : (
      <>
        {notice && onCheckAgain && <ConverterActions converter="libreoffice" onCheckAgain={onCheckAgain} />}
        <FileMenu
          editable={editable}
          item={item}
          onEdit={() => setEditing(true)}
          onEditVisually={isHtml && editable ? () => setVisual(true) : undefined}
          onRestored={restored => onSaved?.(restored)}
        />
      </>
    )

  return (
    <PreviewSurface
      bodyClassName={cn(mode === 'preview' && (ext === 'html' || ext === 'htm') && 'bg-white')}
      status={notice ?? (preview.truncated ? copy.truncated : undefined)}
      tools={tools}
    >
      {mode === 'preview' && (ext === 'html' || ext === 'htm') && (
        <SandboxedFrame
          className="absolute inset-0"
          src={sandboxedHtml(text, { libraries: true })}
          title={item.title}
        />
      )}
      {mode === 'preview' && (ext === 'md' || ext === 'markdown') && <MarkdownPreview text={text} />}
      {mode === 'preview' && table && <SheetTable rows={table} />}
      {mode === 'source' && (
        <SourceView language={shikiLanguageForFilename(item.file_name ?? '') || 'text'} text={text} />
      )}
      {mode === 'edit' && (
        <Suspense
          fallback={
            <Centered>
              <Loader />
            </Centered>
          }
        >
          <CodeEditor
            className="absolute inset-0"
            filePath={item.file_name ?? item.title}
            initialValue={draft ?? text}
            onChange={setDraft}
            onSave={() => void save()}
          />
        </Suspense>
      )}
    </PreviewSurface>
  )
}

/** No viewer for this format: the file as a card, and the way to open it elsewhere. */
export function NoPreview({
  converter,
  converterMissing,
  item,
  onCheckAgain
}: {
  converter?: Converter | null
  converterMissing?: boolean
  item: LibraryItem
  onCheckAgain?: () => void
}) {
  const { t } = useI18n()
  const copy = t.library
  const type = fileCategoryOf(item)
  const remote = isDesktopFsRemoteMode()

  return (
    <Centered>
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span
          className="grid size-16 place-items-center rounded-2xl bg-(--ui-bg-editor) shadow-(--composer-float-shadow)"
          style={{ color: ITEM_TYPE_TINT[type] }}
        >
          <Codicon name={ITEM_TYPE_ICON[type]} size="1.75rem" />
        </span>
        <div>
          <p className="m-0 text-sm font-medium text-(--ui-text-primary)">{item.file_name ?? item.title}</p>
          <p className="m-0 mt-0.5 text-xs text-(--ui-text-tertiary)">
            {copy.types[type]} · {formatBytes(item.size)}
          </p>
        </div>
        <p className="m-0 text-xs text-(--ui-text-tertiary)">
          {converterMissing
            ? converter === 'ffmpeg'
              ? copy.preview.videoConverterMissing
              : copy.preview.converterMissingShort
            : copy.preview.noPreviewBody}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {converterMissing && onCheckAgain && (
            <ConverterActions converter={converter ?? 'libreoffice'} onCheckAgain={onCheckAgain} />
          )}
          {item.path && (
            <Button
              onClick={() => void (remote ? downloadRemoteFile(item.path!) : revealFile(item.path!))}
              size="xs"
              variant="secondary"
            >
              <Codicon name={remote ? 'cloud-download' : 'folder-opened'} size="0.75rem" />
              {copy.actions.download}
            </Button>
          )}
        </div>
      </div>
    </Centered>
  )
}
