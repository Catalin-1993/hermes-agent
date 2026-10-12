import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { useSessionView } from '@/app/chat/session-view'
import { PreviewAttachment } from '@/components/chat/preview-attachment'
import { readDesktopFileText } from '@/lib/desktop-fs'
import { localPreviewTarget } from '@/lib/local-preview'

import { WidgetFrame } from './widget-frame'
import { MAX_HEIGHT, MIN_HEIGHT } from './widget-frame-doc'

/**
 * `::preview{file="…"}` — a workspace HTML file rendered LIVE inside the assistant message, in the
 * sealed, themed, self-sizing frame of `widget-frame.tsx`. A `height="480"` attribute only sets the
 * starting height — measurement always wins. Non-HTML targets and files that cannot be read fall back
 * to the standard preview-attachment card rather than a broken frame.
 */

const HTML_FILE_RE = /\.(?:html?|xhtml)$/i

export function directiveFrameHeight(raw: string | undefined): number | null {
  if (!raw) {
    return null
  }

  const parsed = Number(raw)

  if (!Number.isInteger(parsed)) {
    return null
  }

  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, parsed))
}

export function InlinePreviewDirective({
  attrs,
  streaming
}: {
  attrs: Readonly<Record<string, string>>
  streaming: boolean
}) {
  const file = attrs.file ?? ''

  // Not renderable inline: hand the leaf to the classic card. Non-HTML has
  // nothing to frame. (Remote gateways used to bail here too — that predates
  // the mode-aware fs bridge; the frame now reads through readDesktopFileText,
  // which fetches over the authenticated /api/fs bridge in remote mode, so a
  // URL connection — including a same-machine `hermes serve` — renders live.)
  if (!file || !HTML_FILE_RE.test(file)) {
    return file ? <PreviewAttachment target={file} /> : null
  }

  return <InlineHtmlFile file={file} initialHeight={directiveFrameHeight(attrs.height)} streaming={streaming} />
}

function InlineHtmlFile({
  file,
  initialHeight,
  streaming
}: {
  file: string
  /** `height` attribute — the starting height only; measurement overrides. */
  initialHeight: number | null
  streaming: boolean
}) {
  const cwd = useStore(useSessionView().$cwd)
  const [doc, setDoc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // Resolve against THIS session's cwd (the file was written by its agent).
  const path = localPreviewTarget(file, cwd || undefined)?.path ?? null

  useEffect(() => {
    // Wait for turn settle: mid-stream the file is often mid-write, and a
    // half-written srcdoc renders as garbage that never self-corrects.
    if (!path || streaming) {
      return
    }

    let alive = true

    void Promise.resolve(readDesktopFileText(path))
      .then(result => {
        if (!alive) {
          return
        }

        if (!result || result.binary || !result.text) {
          setFailed(true)
        } else {
          setDoc(result.text)
        }
      })
      .catch(() => alive && setFailed(true))

    return () => {
      alive = false
    }
  }, [path, streaming])

  if (!path || failed) {
    return <PreviewAttachment target={file} />
  }

  return <WidgetFrame approvalKey={path} doc={doc} initialHeight={initialHeight} title={file} />
}
