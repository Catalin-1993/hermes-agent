import { useEffect, useState } from 'react'

import { MarkdownPreview, SourceView } from '@/app/chat/right-rail/preview-file'
import { Codicon } from '@/components/ui/codicon'
import { SandboxedFrame } from '@/components/ui/sandboxed-frame'
import { useI18n } from '@/i18n'

import { formatBytes, type LibraryItem, type LibraryPreview, readLibraryBlob } from '../data'
import { fileCategoryOf, ITEM_TYPE_ICON, ITEM_TYPE_TINT } from '../file-types'

import { sandboxedHtml } from './data-viewers'
import { LoadFailed, Loading, PreviewSurface } from './preview-surface'

function Header({ label, value }: { label: string; value?: null | string }) {
  return value ? (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2 text-xs">
      <span className="text-(--ui-text-tertiary)">{label}</span>
      <span className="min-w-0 break-words text-(--ui-text-primary)">{value}</span>
    </div>
  ) : null
}

/** A mail as Mail shows it: the headers, the body (HTML in the sealed frame, remote images blocked),
 *  then what came attached. */
export function EmailViewer({ preview }: { preview: LibraryPreview }) {
  const { t } = useI18n()
  const copy = t.library.preview
  const mail = preview.email
  const attachments = preview.entries ?? []

  return (
    <PreviewSurface bodyClassName="flex flex-col" status={mail?.date}>
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-(--ui-stroke-quaternary) px-5 py-4">
        <p className="m-0 mb-1 text-base font-semibold text-(--ui-text-primary)">{mail?.subject}</p>
        <Header label={copy.from} value={mail?.sender} />
        <Header label={copy.to} value={mail?.to} />
        <Header label={copy.cc} value={mail?.cc} />
      </div>
      <div className="relative min-h-64 flex-1 bg-white">
        {preview.html ? (
          <SandboxedFrame className="absolute inset-0" src={sandboxedHtml(preview.html)} title={mail?.subject ?? ''} />
        ) : (
          <pre className="m-0 whitespace-pre-wrap break-words p-5 font-sans text-sm text-neutral-900">
            {preview.text}
          </pre>
        )}
      </div>
      {attachments.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-(--ui-stroke-quaternary) px-5 py-3">
          <span className="mr-1 text-[0.6875rem] text-(--ui-text-tertiary)">
            {copy.attachments(attachments.length)}
          </span>
          {attachments.map(file => {
            const type = fileCategoryOf({ file_name: file.name, mime: null })

            return (
              <span
                className="flex items-center gap-1.5 rounded-md border border-(--ui-stroke-tertiary) px-2 py-1 text-xs text-(--ui-text-secondary)"
                key={file.name}
              >
                <Codicon name={ITEM_TYPE_ICON[type]} size="0.75rem" style={{ color: ITEM_TYPE_TINT[type] }} />
                {file.name}
                <span className="tabular-nums text-(--ui-text-tertiary)">{formatBytes(file.size)}</span>
              </span>
            )
          })}
        </div>
      )}
    </PreviewSurface>
  )
}

/** A Jupyter notebook read top to bottom: Markdown rendered, code highlighted, outputs beneath. */
export function NotebookViewer({ preview }: { preview: LibraryPreview }) {
  const { t } = useI18n()
  const cells = preview.cells ?? []

  return (
    <PreviewSurface status={preview.truncated ? t.library.preview.truncated : undefined}>
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-6">
        {cells.map((cell, index) =>
          cell.kind === 'markdown' ? (
            <MarkdownPreview key={index} text={cell.source} />
          ) : (
            <div className="flex flex-col gap-2" key={index}>
              <div className="overflow-hidden rounded-lg border border-(--ui-stroke-tertiary)">
                <SourceView
                  language={cell.kind === 'code' ? (preview.language ?? 'python') : 'text'}
                  text={cell.source}
                />
              </div>
              {(cell.outputs ?? []).map((output, at) =>
                output.image ? (
                  <img alt="" className="max-w-full self-start rounded-md" key={at} src={output.image} />
                ) : (
                  <pre
                    className="m-0 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-(--ui-bg-quinary) px-3 py-2 text-xs text-(--ui-text-secondary)"
                    key={at}
                  >
                    {output.text}
                  </pre>
                )
              )}
            </div>
          )
        )}
      </div>
    </PreviewSurface>
  )
}

const SIZES = [12, 16, 24, 36, 56] as const

/** A font as a specimen: the alphabet, figures, and a line to type into at several sizes. */
export function FontViewer({ item }: { item: LibraryItem }) {
  const { t } = useI18n()
  const [family, setFamily] = useState<null | string>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [sample, setSample] = useState('The quick brown fox jumps over the lazy dog')

  useEffect(() => {
    let live = true
    let face: FontFace | null = null
    const name = `library-font-${item.id}-${item.updated_at}`

    setFailed(false)
    readLibraryBlob(item.id)
      .then(blob => blob.arrayBuffer())
      .then(bytes => new FontFace(name, bytes).load())
      .then(
        loaded => {
          face = loaded
          document.fonts.add(loaded)

          if (live) {
            setFamily(name)
          }
        },
        () => live && setFailed(true)
      )

    return () => {
      live = false

      if (face) {
        document.fonts.delete(face)
      }
    }
  }, [attempt, item.id, item.updated_at])

  if (failed) {
    return (
      <PreviewSurface>
        <LoadFailed onRetry={() => setAttempt(n => n + 1)} />
      </PreviewSurface>
    )
  }

  if (!family) {
    return (
      <PreviewSurface>
        <Loading />
      </PreviewSurface>
    )
  }

  return (
    <PreviewSurface>
      <div
        className="mx-auto flex max-w-4xl flex-col gap-6 px-8 py-8 text-(--ui-text-primary)"
        style={{ fontFamily: `"${family}"` }}
      >
        <p className="m-0 text-[6rem] leading-none">Aa</p>
        <p className="m-0 break-words text-2xl leading-relaxed">
          ABCDEFGHIJKLMNOPQRSTUVWXYZ
          <br />
          abcdefghijklmnopqrstuvwxyz
          <br />
          0123456789 &amp; ! ? @ # % ( ) € $
        </p>
        <input
          aria-label={t.library.preview.fontSample}
          className="border-b border-(--ui-stroke-tertiary) bg-transparent py-1 font-sans text-sm text-(--ui-text-secondary) outline-none"
          onChange={event => setSample(event.target.value)}
          placeholder={t.library.preview.fontSample}
          value={sample}
        />
        {SIZES.map(size => (
          <div className="flex items-baseline gap-4" key={size}>
            <span className="w-8 shrink-0 font-sans text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)">
              {size}
            </span>
            <p className="m-0 min-w-0 truncate" style={{ fontSize: size }}>
              {sample}
            </p>
          </div>
        ))}
      </div>
    </PreviewSurface>
  )
}
