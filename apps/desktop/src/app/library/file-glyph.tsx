import { cn } from '@/lib/utils'

import { extensionOf, fileCategoryOf, ITEM_TYPE_TINT, type LibraryFileCategory } from './file-types'

/** A file drawn the way its own app draws it: a sheet with a folded corner, a few marks of what is inside it
 *  (text lines, a grid of cells, a slide, a waveform…) and its format on a coloured tab — PDF, DOCX, XLSX — so
 *  what a file is reads at a glance, in the chat and in the Library alike. One drawing, scaled to its place. */

interface FileGlyphProps {
  category: LibraryFileCategory
  className?: string
  /** The extension on the tab; the category's own short name when the file has none. */
  ext?: string
}

const FALLBACK_TAB: Record<LibraryFileCategory, string> = {
  archive: 'ZIP',
  audio: 'AUDIO',
  code: 'CODE',
  document: 'DOC',
  email: 'MAIL',
  file: 'FILE',
  font: 'FONT',
  image: 'IMG',
  pdf: 'PDF',
  presentation: 'SLIDES',
  spreadsheet: 'SHEET',
  video: 'VIDEO',
  web: 'WEB'
}

const SHEET = 'M9 2 H31 L44 15 V53 a5 5 0 0 1 -5 5 H9 a5 5 0 0 1 -5 -5 V7 a5 5 0 0 1 5 -5 Z'
const FOLD = 'M31 2 V11 a4 4 0 0 0 4 4 H44 Z'

/** What the sheet shows of its contents, in the type's tint. */
function Marks({ category, tint }: { category: LibraryFileCategory; tint: string }) {
  const soft = `color-mix(in srgb, ${tint} 26%, transparent)`
  const mid = `color-mix(in srgb, ${tint} 42%, transparent)`

  if (category === 'spreadsheet') {
    return (
      <g fill="none" stroke={mid} strokeWidth="1.2">
        <rect height="22" rx="2" width="30" x="9" y="14" />
        <path d="M9 21.3 H39 M9 28.6 H39 M19 14 V36 M29 14 V36" />
      </g>
    )
  }

  if (category === 'presentation') {
    return (
      <g>
        <rect fill={soft} height="16" rx="2" stroke={mid} strokeWidth="1.2" width="30" x="9" y="14" />
        <path d="M14 26 L19 21 L23 25 L27 20 L34 27" fill="none" stroke={mid} strokeLinecap="round" strokeWidth="1.4" />
        <rect fill={soft} height="2.4" rx="1.2" width="20" x="9" y="35" />
      </g>
    )
  }

  if (category === 'audio') {
    return (
      <g fill={mid}>
        {[18, 26, 14, 30, 20, 12].map((h, i) => (
          <rect height={h} key={i} rx="1.2" width="2.6" x={10 + i * 5} y={26 - h / 2 + 2} />
        ))}
      </g>
    )
  }

  if (category === 'video') {
    return (
      <g>
        <rect fill={soft} height="18" rx="3" stroke={mid} strokeWidth="1.2" width="30" x="9" y="14" />
        <path d="M21 19 L29 23 L21 27 Z" fill={mid} />
      </g>
    )
  }

  if (category === 'image') {
    return (
      <g>
        <rect fill={soft} height="22" rx="2" stroke={mid} strokeWidth="1.2" width="30" x="9" y="14" />
        <circle cx="17" cy="21" fill={mid} r="2.6" />
        <path d="M9 34 L19 25 L26 31 L31 27 L39 34 V34 Z" fill={mid} />
      </g>
    )
  }

  if (category === 'archive') {
    return (
      <g fill={mid}>
        {[0, 1, 2, 3, 4].map(i => (
          <g key={i}>
            <rect height="2.6" rx="0.8" width="5" x="19" y={9 + i * 6} />
            <rect height="2.6" rx="0.8" width="5" x="24" y={12 + i * 6} />
          </g>
        ))}
      </g>
    )
  }

  if (category === 'font') {
    return (
      <text fill={mid} fontFamily="Georgia, serif" fontSize="22" fontWeight="700" x="9" y="31">
        Aa
      </text>
    )
  }

  if (category === 'code') {
    return (
      <g fill="none" stroke={mid} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M18 18 L11 24.5 L18 31" />
        <path d="M30 18 L37 24.5 L30 31" />
        <path d="M26 15 L22 34" />
      </g>
    )
  }

  // Text on a page: a heading line and a few lines of body.
  return (
    <g fill={soft}>
      <rect fill={mid} height="2.8" rx="1.4" width="16" x="9" y="14" />
      <rect height="2.2" rx="1.1" width="30" x="9" y="21" />
      <rect height="2.2" rx="1.1" width="26" x="9" y="26" />
      <rect height="2.2" rx="1.1" width="30" x="9" y="31" />
    </g>
  )
}

export function FileGlyph({ category, className, ext }: FileGlyphProps) {
  const tint = ITEM_TYPE_TINT[category]
  const tab = (ext || FALLBACK_TAB[category]).slice(0, 5).toUpperCase()
  const width = 6 + tab.length * 5.4
  const small = tab.length > 3

  return (
    <svg aria-hidden className={cn('shrink-0 overflow-visible', className)} viewBox="0 0 48 60">
      <path
        d={SHEET}
        style={{
          fill: `color-mix(in srgb, ${tint} 5%, var(--ui-bg-editor))`,
          stroke: `color-mix(in srgb, ${tint} 38%, var(--ui-stroke-secondary))`,
          strokeWidth: 1.2
        }}
      />
      <path d={FOLD} style={{ fill: `color-mix(in srgb, ${tint} 20%, var(--ui-bg-editor))` }} />
      <Marks category={category} tint={tint} />
      <rect fill={tint} height="14" rx="3.2" width={width} x="0" y="40" />
      <text
        fill="#fff"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize={small ? 7.4 : 8.6}
        fontWeight="800"
        letterSpacing="0.03em"
        textAnchor="middle"
        x={width / 2}
        y="49.6"
      >
        {tab}
      </text>
    </svg>
  )
}

/** The glyph of a file by its name (and MIME type, when known). */
export function FileGlyphFor({
  className,
  mime,
  name
}: {
  className?: string
  mime?: null | string
  name: null | string | undefined
}) {
  return (
    <FileGlyph
      category={fileCategoryOf({ file_name: name ?? '', mime: mime ?? '' })}
      className={className}
      ext={extensionOf(name)}
    />
  )
}
