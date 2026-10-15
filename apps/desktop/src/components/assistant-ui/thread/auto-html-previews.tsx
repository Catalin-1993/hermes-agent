import { useAuiState } from '@assistant-ui/react'
import type { FC } from 'react'

import { InlinePreviewDirective } from '../inline-preview-directive'
import { parseMaybeObject } from '../tool/fallback-model/format'

const HTML_PATH = /\.(?:html?|xhtml)$/i
const WRITING_TOOLS = new Set(['write_file', 'patch'])
const PATCH_FILE_LINE = /^\*\*\* (?:Add|Update) File: (.+?)\s*$/gm
const PREVIEW_FILE = /::preview\{[^}\n]*\bfile="([^"\n]+)"/g

interface MessagePart {
  args?: unknown
  text?: string
  toolName?: string
  type: string
}

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path

/**
 * The HTML files this message's tools wrote that its text did not already show with `::preview` — a page or
 * dashboard the agent saved to disk and never put in front of the user. The chat draws them at the end of the
 * reply, in the same frame `::preview` uses. Newline-joined so the selector stays a stable primitive.
 */
export function writtenHtmlFiles(parts: readonly MessagePart[]): string {
  const shown = new Set<string>()
  const written: string[] = []

  for (const part of parts) {
    if (part.type === 'text' && part.text?.includes('::preview')) {
      for (const match of part.text.matchAll(PREVIEW_FILE)) {
        shown.add(baseName(match[1]))
      }
    }

    if (part.type !== 'tool-call' || !WRITING_TOOLS.has(part.toolName ?? '')) {
      continue
    }

    const args = parseMaybeObject(part.args)
    const paths = typeof args.path === 'string' ? [args.path] : []

    if (typeof args.patch === 'string') {
      paths.push(...Array.from(args.patch.matchAll(PATCH_FILE_LINE), match => match[1]))
    }

    for (const path of paths) {
      if (HTML_PATH.test(path) && !written.includes(path)) {
        written.push(path)
      }
    }
  }

  return written.filter(path => !shown.has(baseName(path))).join('\n')
}

/** Settled replies only: mid-turn the file is often half-written, and the frame would draw a broken page. */
export const AutoHtmlPreviews: FC = () => {
  const files = useAuiState(s =>
    s.message.status?.type === 'running' ? '' : writtenHtmlFiles(s.message.content as readonly MessagePart[])
  )

  if (!files) {
    return null
  }

  return (
    <div className="mt-2 flex flex-col gap-2" data-slot="aui_auto-html-previews">
      {files.split('\n').map(file => (
        <InlinePreviewDirective attrs={{ file }} key={file} streaming={false} />
      ))}
    </div>
  )
}
